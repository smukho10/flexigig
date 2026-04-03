const cron = require("node-cron");
const db = require("../database/connection.js");
const user_queries = require("../database/queries/user_queries.js");

/**
 * Returns accepted applications where the job starts in approximately
 * `hoursAhead` hours, within a ±windowMinutes tolerance.
 * Uses interval multiplication instead of make_interval to avoid type inference issues.
 */
const getShiftsStartingIn = async (hoursAhead, windowMinutes) => {
    const result = await db.query(`
        SELECT
            ga.job_id,
            w.user_id   AS worker_user_id,
            jp.jobtitle,
            jp.jobstart,
            jp.user_id  AS employer_id
        FROM gig_applications ga
        JOIN workers w ON ga.worker_profile_id = w.id
        JOIN jobPostings jp ON ga.job_id = jp.job_id
        WHERE ga.status = 'ACCEPTED'
          AND jp.jobstart IS NOT NULL
          AND jp.jobstart BETWEEN
              NOW() + ($1::int * INTERVAL '1 hour') - ($2::int * INTERVAL '1 minute')
          AND NOW() + ($1::int * INTERVAL '1 hour') + ($2::int * INTERVAL '1 minute')
    `, [hoursAhead, windowMinutes]);
    return result.rows;
};

/**
 * Returns true if a reminder with `label` text has already been sent
 * to this worker for this job (prevents duplicate notifications).
 */
const reminderAlreadySent = async (workerUserId, jobId, label) => {
    const result = await db.query(`
        SELECT 1 FROM messages
        WHERE receiver_id = $1
          AND job_id = $2
          AND content LIKE $3
        LIMIT 1
    `, [workerUserId, jobId, `%${label}%`]);
    return result.rows.length > 0;
};

/**
 * Sends 24-hour and 2-hour shift reminders to workers with accepted applications.
 */
const sendShiftReminders = async () => {
    try {
        // 24-hour reminder (±30 min window)
        const shifts24h = await getShiftsStartingIn(24, 30);
        console.log(`[Notifications] 24h check: found ${shifts24h.length} upcoming shift(s)`);
        for (const shift of shifts24h) {
            const label = "24-hour reminder";
            if (await reminderAlreadySent(shift.worker_user_id, shift.job_id, label)) continue;

            const content = `⏰ ${label}: Your shift for "${shift.jobtitle}" starts in 24 hours!`;
            await user_queries.sendMessage(
                shift.employer_id,
                shift.worker_user_id,
                content,
                shift.job_id,
                false
            );
            console.log(`[Notifications] Sent 24h reminder → user ${shift.worker_user_id}, job ${shift.job_id}`);
        }

        // 2-hour reminder (±15 min window)
        const shifts2h = await getShiftsStartingIn(2, 15);
        console.log(`[Notifications] 2h check: found ${shifts2h.length} upcoming shift(s)`);
        for (const shift of shifts2h) {
            const label = "2-hour reminder";
            if (await reminderAlreadySent(shift.worker_user_id, shift.job_id, label)) continue;

            const content = `⏰ ${label}: Your shift for "${shift.jobtitle}" starts in 2 hours!`;
            await user_queries.sendMessage(
                shift.employer_id,
                shift.worker_user_id,
                content,
                shift.job_id,
                false
            );
            console.log(`[Notifications] Sent 2h reminder → user ${shift.worker_user_id}, job ${shift.job_id}`);
        }
    } catch (err) {
        console.error("[Notifications] Error sending shift reminders:", err);
    }
};

/**
 * Finds all open jobs posted in the last `windowMinutes` minutes.
 */
const getRecentlyOpenedJobs = async (windowMinutes) => {
    const result = await db.query(`
        SELECT job_id, required_skills, required_experience, user_id AS employer_id, jobtitle
        FROM jobPostings
        WHERE status ILIKE 'open'
          AND jobposteddate >= NOW() - ($1::int * INTERVAL '1 minute')
          AND (
              COALESCE(array_length(required_skills, 1), 0) > 0
              OR COALESCE(array_length(required_experience, 1), 0) > 0
          )
    `, [windowMinutes]);
    return result.rows;
};

/**
 * Finds workers whose skills or experience match a newly published job,
 * who haven't applied yet, and haven't already been notified for this job.
 */
const findMatchingWorkers = async (jobId) => {
    const result = await db.query(`
        WITH job_info AS (
            SELECT job_id, required_skills, required_experience, user_id AS employer_id, jobtitle
            FROM jobPostings
            WHERE job_id = $1
        )
        SELECT DISTINCT w.user_id, ji.employer_id, ji.jobtitle
        FROM job_info ji
        CROSS JOIN workers w
        WHERE (
            EXISTS (
                SELECT 1
                FROM workers_skills ws
                JOIN skills s ON ws.skill_id = s.skill_id
                WHERE ws.workers_id = w.id
                  AND lower(s.skill_name) IN (
                      SELECT lower(v) FROM unnest(COALESCE(ji.required_skills, '{}')) AS t(v)
                  )
            )
            OR EXISTS (
                SELECT 1
                FROM workers_experiences we
                JOIN experiences e ON we.experience_id = e.experience_id
                WHERE we.workers_id = w.id
                  AND lower(e.experience_name) IN (
                      SELECT lower(v) FROM unnest(COALESCE(ji.required_experience, '{}')) AS t(v)
                  )
            )
        )
        AND NOT EXISTS (
            SELECT 1 FROM gig_applications ga
            WHERE ga.job_id = ji.job_id AND ga.worker_profile_id = w.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM messages m
            WHERE m.receiver_id = w.user_id
              AND m.job_id = ji.job_id
              AND m.content LIKE '%new gig%'
        )
    `, [jobId]);
    return result.rows;
};

/**
 * Sends a "new gig available" notification to all workers who match
 * the job's required skills/experience. Called when a job is published.
 */
const notifyWorkersOfNewGig = async (jobId) => {
    try {
        const workers = await findMatchingWorkers(jobId);
        console.log(`[Notifications] New gig job ${jobId}: found ${workers.length} matching worker(s)`);
        for (const worker of workers) {
            const content = `🆕 New gig matching your profile: "${worker.jobtitle}". Check it out!`;
            await user_queries.sendMessage(
                worker.employer_id,
                worker.user_id,
                content,
                jobId,
                false
            );
            console.log(`[Notifications] Sent new gig notification → user ${worker.user_id}, job ${jobId}`);
        }
    } catch (err) {
        console.error("[Notifications] Error sending new gig notifications:", err);
    }
};

/**
 * Checks for jobs opened in the last 15 minutes and notifies matching workers.
 */
const sendNewGigNotifications = async () => {
    try {
        const recentJobs = await getRecentlyOpenedJobs(15);
        console.log(`[Notifications] New gig check: found ${recentJobs.length} recently opened job(s)`);
        for (const job of recentJobs) {
            await notifyWorkersOfNewGig(job.job_id);
        }
    } catch (err) {
        console.error("[Notifications] Error in new gig scan:", err);
    }
};

/**
 * Starts all notification cron jobs. Runs every 15 minutes.
 */
const scheduleShiftReminders = () => {
    cron.schedule("*/15 * * * *", () => {
        console.log("[Notifications] Running shift reminder check...");
        sendShiftReminders();
        console.log("[Notifications] Running new gig check...");
        sendNewGigNotifications();
    });
    console.log("[Notifications] Notification scheduler started.");
};

module.exports = { scheduleShiftReminders };

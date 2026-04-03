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

            const content = `24-hour reminder: Your shift starts in 24 hours!`;
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

            const content = `2-hour reminder: Your shift starts in 2 hours!`;
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

const job_queries = require("../database/queries/job_queries.js");

/**
 * For each worker, fetch their recommended jobs and send a one-time notification
 * for any job that hasn't been notified about yet.
 */
const sendNewGigNotifications = async () => {
    try {
        const workersResult = await db.query(`SELECT DISTINCT user_id FROM workers`);
        const workerIds = workersResult.rows.map(r => r.user_id);
        console.log(`[Notifications] New gig check: scanning ${workerIds.length} worker(s)`);

        for (const userId of workerIds) {
            const recommendedJobs = await job_queries.fetchRecommendedJobs(userId);

            for (const job of recommendedJobs) {
                // Check if already notified about this job
                const alreadyNotified = await db.query(`
                    SELECT 1 FROM messages
                    WHERE receiver_id = $1 AND job_id = $2 AND content ILIKE '%recommended gig%'
                    LIMIT 1
                `, [userId, job.job_id]);

                if (alreadyNotified.rows.length === 0) {
                    // Get employer user_id as sender
                    const employerRes = await db.query(
                        `SELECT user_id FROM jobPostings WHERE job_id = $1`,
                        [job.job_id]
                    );
                    const employerId = employerRes.rows[0]?.user_id;
                    if (!employerId) continue;

                    const content = `New recommended gig available. Check it out!`;
                    await user_queries.sendMessage(employerId, userId, content, job.job_id, false);
                    console.log(`[Notifications] Sent new gig notification → user ${userId}, job ${job.job_id}`);
                }
            }
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

module.exports = { scheduleShiftReminders, sendNewGigNotifications };

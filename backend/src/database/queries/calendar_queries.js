const db = require('../connection.js');

// Fetch schedule by user ID
const getScheduleByUserId = (user_id) => {
  const query = `
    SELECT 
      id, 
      to_char(startDate, 'YYYY-MM-DD') AS startDate, 
      to_char(endDate, 'YYYY-MM-DD') AS endDate, 
      startTime, 
      endTime, 
      title
    FROM schedule 
    WHERE user_id = $1;
  `;

  return db
    .query(query, [user_id])
    .then((result) => result.rows)
    .catch((err) => {
      console.error('Error fetching schedule:', err);
      throw err;
    });
};

// Insert a new schedule
const setSchedule = (user_id, startDate, endDate, startTime, endTime, title) => {
  const query = `
    INSERT INTO schedule (user_id, startDate, endDate, startTime, endTime, title) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING id, startDate, endDate, startTime, endTime, title;
  `;
  const values = [user_id, startDate, endDate, startTime, endTime, title];

  return db
    .query(query, values)
    .then((result) => result.rows[0])
    .catch((err) => {
      console.error('Error inserting schedule:', err);
      throw err;
    });
};

// Delete an event by its ID
const deleteEvent = (eventId) => {
  const query = 'DELETE FROM schedule WHERE id = $1';

  return db
    .query(query, [eventId])
    .then(() => {
      console.log('Event deleted successfully');
    })
    .catch((err) => {
      console.error('Error deleting event:', err);
      throw err;
    });
};

// Fetch schedule entries for a specific worker profile
const getScheduleByWorkerId = (worker_id) => {
  const query = `
    SELECT
      id,
      user_id,
      worker_id,
      to_char(startDate, 'YYYY-MM-DD') AS startDate,
      to_char(endDate, 'YYYY-MM-DD') AS endDate,
      startTime,
      endTime,
      title
    FROM schedule
    WHERE worker_id = $1;
  `;

  return db
    .query(query, [worker_id])
    .then((result) => result.rows)
    .catch((err) => {
      console.error('Error fetching worker schedule:', err);
      throw err;
    });
};

// Insert a new schedule entry linked to a specific worker profile
const setWorkerSchedule = (user_id, worker_id, startDate, endDate, startTime, endTime, title) => {
  const query = `
    INSERT INTO schedule (user_id, worker_id, startDate, endDate, startTime, endTime, title)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id, worker_id, startDate, endDate, startTime, endTime, title;
  `;
  const values = [user_id, worker_id, startDate, endDate, startTime, endTime, title];

  return db
    .query(query, values)
    .then((result) => result.rows[0])
    .catch((err) => {
      console.error('Error inserting worker schedule:', err);
      throw err;
    });
};

module.exports = {
  getScheduleByUserId,
  setSchedule,
  deleteEvent,
  getScheduleByWorkerId,
  setWorkerSchedule,
};
const db = require("../config/db");

// Helpers to normalize room/program/subject metadata
const buildRoomLabel = (record) => {
  if (!record) return null;
  const number = record.room_number || '';
  const name = record.room_name || '';
  if (number && name) return `${number} - ${name}`;
  if (number || name) return number || name;
  return null;
};

const validatePositiveInt = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
};

const getActiveAcademicContext = (cb) => {
  const ctxSql = `
    SELECT ay.academic_year_id, t.term_id
    FROM academic_year ay
    CROSS JOIN term t
    WHERE ay.is_active = 1 AND t.is_active = 1
    LIMIT 1
  `;
  db.query(ctxSql, (err, rows) => {
    if (err) return cb(err);
    if (!rows || !rows.length) return cb(new Error('No active academic year/term set.'));
    cb(null, rows[0]);
  });
};

const getRoomProgramSubjectMeta = (roomId, programId, subjectId, cb) => {
  const tasks = [];
  const meta = {};

  if (roomId) {
    tasks.push((done) => {
      db.query(
        'SELECT room_id, room_number, room_name FROM campus_room WHERE room_id = ? LIMIT 1',
        [roomId],
        (err, rows) => {
          if (err) return done(err);
          if (!rows || !rows.length) return done(new Error('Room not found.'));
          meta.room = rows[0];
          done();
        }
      );
    });
  }

  if (programId) {
    tasks.push((done) => {
      db.query(
        'SELECT program_id, program_code, program_name FROM campus_program WHERE program_id = ? LIMIT 1',
        [programId],
        (err, rows) => {
          if (err) return done(err);
          if (!rows || !rows.length) return done(new Error('Program not found.'));
          meta.program = rows[0];
          done();
        }
      );
    });
  }

  if (subjectId) {
    tasks.push((done) => {
      db.query(
        'SELECT subject_id, subject_code, subject_name FROM campus_subject WHERE subject_id = ? LIMIT 1',
        [subjectId],
        (err, rows) => {
          if (err) return done(err);
          if (!rows || !rows.length) return done(new Error('Subject not found.'));
          meta.subject = rows[0];
          done();
        }
      );
    });
  }

  if (!tasks.length) return cb(null, meta);

  let remaining = tasks.length;
  let failed = false;
  tasks.forEach((task) => {
    task((err) => {
      if (failed) return;
      if (err) {
        failed = true;
        return cb(err);
      }
      remaining -= 1;
      if (!remaining) cb(null, meta);
    });
  });
};

const mapScheduleRow = (row) => {
  // Always enforce number-first formatting when both fields exist
  const roomLabel = buildRoomLabel({
    room_number: row.room_number,
    room_name: row.room_name
  }) || row.room_label || buildRoomLabel(row);
  return {
    schedule_id: row.schedule_id,
    room_id: row.room_id,
    lab_room: roomLabel || row.lab_room || null,
    faculty_id: row.faculty_id,
    faculty_name: row.faculty_name,
    program_id: row.program_id,
    program_code: row.program_code,
    program_name: row.program_name,
    program: row.program_name || row.program_code || null,
    year_level: row.year_level,
    subject_id: row.subject_id,
    subject_code: row.subject_code,
    subject_name: row.subject_name,
    subject: row.subject_name || row.subject_code || null,
    day_of_week: row.day_of_week,
    schedule_date: row.schedule_date,
    borrow_request_id: row.borrow_request_id,
    time_start: row.time_start,
    time_end: row.time_end,
    academic_year_id: row.academic_year_id,
    term_id: row.term_id,
    is_expired: row.is_expired,
    location: roomLabel || null
  };
};

// Create a new lab schedule using canonical foreign keys
exports.createLabSchedule = (req, res) => {
  try {
    const {
      room_id,
      faculty_id,
      program_id,
      year_level,
      subject_id,
      day_of_week,
      schedule_date,
      borrow_request_id,
      time_start,
      time_end,
      created_by
    } = req.body;

    if (!faculty_id || !day_of_week || !time_start || !time_end || !created_by) {
      return res.status(400).json({ message: "room_id, faculty_id, day_of_week, time_start, time_end, created_by are required" });
    }

    const normalizedRoomId = validatePositiveInt(room_id, 'room_id');
    const normalizedProgramId = program_id ? validatePositiveInt(program_id, 'program_id') : null;
    const normalizedSubjectId = subject_id ? validatePositiveInt(subject_id, 'subject_id') : null;
    const normalizedFacultyId = validatePositiveInt(faculty_id, 'faculty_id');
    const normalizedCreatedBy = validatePositiveInt(created_by, 'created_by');
    const normalizedBorrowRequestId = borrow_request_id ? validatePositiveInt(borrow_request_id, 'borrow_request_id') : null;

    if (!normalizedRoomId) {
      return res.status(400).json({ message: "room_id is required" });
    }

    if (String(time_end) <= String(time_start)) {
      return res.status(400).json({ message: "End time must be after start time." });
    }

    getActiveAcademicContext((ctxErr, context) => {
      if (ctxErr) {
        console.error('createLabSchedule context Error:', ctxErr);
        return res.status(500).json({ message: ctxErr.message || "Error reading academic context" });
      }

      getRoomProgramSubjectMeta(normalizedRoomId, normalizedProgramId, normalizedSubjectId, (metaErr) => {
        if (metaErr) {
          return res.status(400).json({ message: metaErr.message || 'Invalid room/program/subject selection.' });
        }

        const insertSql = `
          INSERT INTO lab_schedule
          (room_id, faculty_id, program_id, year_level, subject_id, day_of_week, schedule_date, borrow_request_id, time_start, time_end, academic_year_id, term_id, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const payload = [
          normalizedRoomId,
          normalizedFacultyId,
          normalizedProgramId,
          year_level ?? null,
          normalizedSubjectId,
          day_of_week,
          schedule_date || null,
          normalizedBorrowRequestId,
          time_start,
          time_end,
          context.academic_year_id,
          context.term_id,
          normalizedCreatedBy
        ];

        db.query(insertSql, payload, (err, result) => {
          if (err) {
            console.error('createLabSchedule Error:', err);
            return res.status(500).json({ message: "Error creating lab schedule" });
          }

          return res.status(201).json({
            message: "Lab schedule created successfully",
            schedule_id: result.insertId,
            academic_year_id: context.academic_year_id,
            term_id: context.term_id
          });
        });
      });
    });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid payload' });
  }
};

exports.getLabSchedules = (req, res) => {
  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  // If explicit IDs provided, filter by them; otherwise filter by active context
  const contextFilter = (ayId && tId)
    ? 'ls.academic_year_id = ? AND ls.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const params = (ayId && tId) ? [ayId, tId] : [];

  const labOnlyCondition = `(
    IFNULL(cr.is_computer_lab, 0) = 1
    OR (
      IFNULL(cr.is_computer_lab, 0) = 0
      AND (
        LOWER(CONCAT_WS(' ', IFNULL(cr.room_name, ''), IFNULL(cr.room_number, ''))) LIKE '%computer lab%'
        OR LOWER(CONCAT_WS(' ', IFNULL(cr.room_name, ''), IFNULL(cr.room_number, ''))) LIKE '%computer laboratory%'
      )
    )
  )`;

  const sql = `
    SELECT
      ls.schedule_id,
      ls.room_id,
      cr.room_number,
      cr.room_name,
      ls.faculty_id,
      COALESCE(fp.full_name, u.gmail, 'Unknown') AS faculty_name,
      ls.program_id,
      cp.program_code,
      cp.program_name,
      ls.year_level,
      ls.subject_id,
      cs.subject_code,
      cs.subject_name,
      ls.day_of_week,
      ls.schedule_date,
      ls.borrow_request_id,
      FIELD(UPPER(ls.day_of_week),
        'MON','TUE','WED','THU','FRI','SAT','SUN',
        'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'
      ),
      ls.time_start,
      ls.time_end,
      ls.academic_year_id,
      ls.term_id,
      CASE WHEN ls.schedule_date IS NOT NULL AND ls.schedule_date < CURDATE() THEN 1 ELSE 0 END AS is_expired
    FROM lab_schedule ls
    LEFT JOIN campus_room cr ON ls.room_id = cr.room_id
    LEFT JOIN campus_program cp ON ls.program_id = cp.program_id
    LEFT JOIN campus_subject cs ON ls.subject_id = cs.subject_id
    LEFT JOIN faculty_profile fp ON ls.faculty_id = fp.faculty_id
    JOIN user u ON u.user_id = ls.faculty_id
    JOIN academic_year ay ON ay.academic_year_id = ls.academic_year_id
    JOIN term t ON t.term_id = ls.term_id
    WHERE ${contextFilter}
      AND ${labOnlyCondition}
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getLabSchedules Error:', err);
      return res.status(500).json({
        message: "Error retrieving lab schedules"
      });
    }
    res.json(rows.map(mapScheduleRow));
  });
};

// Get a lab schedule by ID
exports.getLabScheduleById = (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT
      ls.schedule_id,
      ls.room_id,
      cr.room_number,
      cr.room_name,
      TRIM(CONCAT_WS(' - ', cr.room_number, cr.room_name)) AS room_label,
      ls.faculty_id,
      COALESCE(fp.full_name, u.gmail, 'Unknown') AS faculty_name,
      ls.program_id,
      cp.program_code,
      cp.program_name,
      ls.year_level,
      ls.subject_id,
      cs.subject_code,
      cs.subject_name,
      ls.day_of_week,
      ls.schedule_date,
      ls.borrow_request_id,
      ls.time_start,
      ls.time_end,
      ls.academic_year_id,
      ls.term_id,
      CASE WHEN ls.schedule_date IS NOT NULL AND ls.schedule_date < CURDATE() THEN 1 ELSE 0 END AS is_expired
    FROM lab_schedule ls
    LEFT JOIN campus_room cr ON ls.room_id = cr.room_id
    LEFT JOIN campus_program cp ON ls.program_id = cp.program_id
    LEFT JOIN campus_subject cs ON ls.subject_id = cs.subject_id
    LEFT JOIN faculty_profile fp ON ls.faculty_id = fp.faculty_id
    JOIN user u ON u.user_id = ls.faculty_id
    WHERE ls.schedule_id = ?
    LIMIT 1
  `;

  db.query(query, [Number(id)], (err, results) => {
    if (err) {
      console.error('getLabScheduleById Error:', err);
      return res.status(500).json({
        message: "Error retrieving lab schedule"
      });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Lab schedule not found" });
    }
    res.status(200).json(mapScheduleRow(results[0]));
  });
};

// Update a lab schedule
exports.updateLabSchedule = (req, res) => {
  const { id } = req.params;
  const {
    room_id,
    faculty_id,
    program_id,
    year_level,
    subject_id,
    day_of_week,
    schedule_date,
    time_start,
    time_end,
    academic_year_id,
    term_id
  } = req.body;

  if (!room_id || !faculty_id || !day_of_week || !time_start || !time_end || !academic_year_id || !term_id) {
    return res.status(400).json({ message: "room_id, faculty_id, day_of_week, time_start, time_end, academic_year_id, term_id are required." });
  }

  if (String(time_end) <= String(time_start)) {
    return res.status(400).json({ message: "End time must be after start time." });
  }

  try {
    const normalizedRoomId = validatePositiveInt(room_id, 'room_id');
    const normalizedProgramId = program_id ? validatePositiveInt(program_id, 'program_id') : null;
    const normalizedSubjectId = subject_id ? validatePositiveInt(subject_id, 'subject_id') : null;
    const normalizedFacultyId = validatePositiveInt(faculty_id, 'faculty_id');
    const normalizedAcademicYearId = validatePositiveInt(academic_year_id, 'academic_year_id');
    const normalizedTermId = validatePositiveInt(term_id, 'term_id');

    if (!normalizedRoomId) {
      return res.status(400).json({ message: "room_id is required" });
    }

    getRoomProgramSubjectMeta(normalizedRoomId, normalizedProgramId, normalizedSubjectId, (metaErr) => {
      if (metaErr) {
        return res.status(400).json({ message: metaErr.message || 'Invalid room/program/subject selection.' });
      }

      const query = `
        UPDATE lab_schedule
        SET room_id = ?, faculty_id = ?, program_id = ?, year_level = ?, subject_id = ?,
            day_of_week = ?, schedule_date = ?, time_start = ?, time_end = ?,
            academic_year_id = ?, term_id = ?
        WHERE schedule_id = ?
      `;

      db.query(
        query,
        [
          normalizedRoomId,
          normalizedFacultyId,
          normalizedProgramId,
          year_level ?? null,
          normalizedSubjectId,
          day_of_week,
          schedule_date || null,
          time_start,
          time_end,
          normalizedAcademicYearId,
          normalizedTermId,
          Number(id)
        ],
        (err) => {
          if (err) {
            console.error('updateLabSchedule Error:', err);
            return res.status(500).json({
              message: "Error updating lab schedule"
            });
          }
          res.status(200).json({ message: "Lab schedule updated successfully" });
        }
      );
    });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid payload' });
  }
};

// Delete a lab schedule
exports.deleteLabSchedule = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM lab_schedule WHERE schedule_id = ?", [Number(id)], (err) => {
    if (err) {
      console.error('deleteLabSchedule Error:', err);
      return res.status(500).json({
        message: "Error deleting lab schedule"
      });
    }
    res.status(200).json({ message: "Lab schedule deleted successfully" });
  });
};

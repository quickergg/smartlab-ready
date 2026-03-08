const db = require("../config/db");
const tz = require("../config/timezone");
const { createNotification, notifyAdmins } = require("../services/notificationService");

const normalizeLabel = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Ensure date_needed is returned as a stable YYYY-MM-DD string (PH timezone) to avoid client-side shifts
const normalizeDateNeeded = (value) => {
  if (!value) return null;
  try {
    return tz.toDateStr(value);
  } catch (_) {
    return null;
  }
};

const normalizeDateField = (row) => {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    date_needed: normalizeDateNeeded(row.date_needed)
  };
};

const truncateLabel = (value, maxLen) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

const buildSubjectMeta = (record, fallbackLabel) => {
  const safeLabel = normalizeLabel(fallbackLabel);
  return {
    subjectId: record?.subject_id ?? null,
    subjectCode: record?.subject_code ?? null,
    subjectName: record?.subject_name ?? safeLabel,
    displayLabel: record?.subject_name || record?.subject_code || safeLabel || null
  };
};

const resolveSubjectMeta = (conn, subjectId, fallbackLabel, callback) => {
  if (subjectId === null) {
    return callback(null, buildSubjectMeta(null, fallbackLabel));
  }

  conn.query(
    'SELECT subject_id, subject_code, subject_name FROM campus_subject WHERE subject_id = ? LIMIT 1',
    [subjectId],
    (err, rows) => {
      if (err) {
        return callback(err);
      }
      if (!rows || !rows.length) {
        const notFoundErr = new Error('SUBJECT_NOT_FOUND');
        notFoundErr.code = 'SUBJECT_NOT_FOUND';
        return callback(notFoundErr);
      }
      return callback(null, buildSubjectMeta(rows[0], fallbackLabel));
    }
  );
};

const buildProgramMeta = (record, fallbackLabel) => {
  const safeLabel = normalizeLabel(fallbackLabel);
  return {
    programId: record?.program_id ?? null,
    programCode: record?.program_code ?? null,
    programName: record?.program_name ?? safeLabel,
    displayLabel: record?.program_name || record?.program_code || safeLabel || null
  };
};

const resolveProgramMeta = (conn, programId, fallbackLabel, callback) => {
  if (programId === null) {
    return callback(new Error('PROGRAM_ID_REQUIRED'));
  }

  conn.query(
    'SELECT program_id, program_code, program_name FROM campus_program WHERE program_id = ? LIMIT 1',
    [programId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows || !rows.length) {
        const notFoundErr = new Error('PROGRAM_NOT_FOUND');
        notFoundErr.code = 'PROGRAM_NOT_FOUND';
        return callback(notFoundErr);
      }
      return callback(null, buildProgramMeta(rows[0], fallbackLabel));
    }
  );
};

const buildRoomMeta = (record, fallbackLabel) => {
  const safeLabel = normalizeLabel(fallbackLabel);
  const number = record?.room_number || '';
  const name = record?.room_name || '';
  let display = null;
  if (name && number) display = `${number} - ${name}`;
  else if (name || number) display = name || number;
  else display = safeLabel;

  return {
    roomId: record?.room_id ?? null,
    roomNumber: number || null,
    roomName: name || null,
    displayLabel: display || null
  };
};

const resolveRoomMeta = (conn, roomId, fallbackLabel, callback) => {
  if (roomId === null) {
    const err = new Error('ROOM_ID_REQUIRED');
    err.code = 'ROOM_ID_REQUIRED';
    return callback(err);
  }

  conn.query(
    'SELECT room_id, room_number, room_name FROM campus_room WHERE room_id = ? LIMIT 1',
    [roomId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows || !rows.length) {
        const notFoundErr = new Error('ROOM_NOT_FOUND');
        notFoundErr.code = 'ROOM_NOT_FOUND';
        return callback(notFoundErr);
      }
      return callback(null, buildRoomMeta(rows[0], fallbackLabel));
    }
  );
};

// =========================================
// POST /api/borrowRequests
// Create borrow request with academic context
// =========================================
exports.createBorrowRequest = (req, res) => {
  const {
    requested_by,
    lab_schedule_id,
    faculty_id,
    program_id,
    year_level,
    subject_id,
    date_needed,
    room_id,
    time_start,
    time_end,
    contact_details,
    purpose,
    status_id,
    equipment_ids,
    equipment_details
  } = req.body;

  const requestedByNum = Number(requested_by);
  const facultyIdNum = faculty_id ? Number(faculty_id) : null;
  const yearLevelNum = Number(year_level);
  const statusNum = Number(status_id);
  const subjectIdRaw = subject_id ?? null;
  let normalizedSubjectId = null;
  let normalizedProgramId = null;
  let normalizedRoomId = null;

  if (subjectIdRaw !== null && subjectIdRaw !== undefined && subjectIdRaw !== '') {
    normalizedSubjectId = Number(subjectIdRaw);
    if (!Number.isInteger(normalizedSubjectId) || normalizedSubjectId <= 0) {
      return res.status(400).json({ message: 'Invalid subject selection.' });
    }
  }

  if (program_id !== null && program_id !== undefined && program_id !== '') {
    normalizedProgramId = Number(program_id);
    if (!Number.isInteger(normalizedProgramId) || normalizedProgramId <= 0) {
      return res.status(400).json({ message: 'Invalid program selection.' });
    }
  }

  if (room_id !== null && room_id !== undefined && room_id !== '') {
    normalizedRoomId = Number(room_id);
    if (!Number.isInteger(normalizedRoomId) || normalizedRoomId <= 0) {
      return res.status(400).json({ message: 'Invalid room selection.' });
    }
  }

  if (
    !Number.isInteger(requestedByNum) || requestedByNum <= 0 ||
    !Number.isInteger(yearLevelNum) || yearLevelNum <= 0 ||
    !date_needed ||
    !normalizedProgramId ||
    !normalizedRoomId ||
    !time_start ||
    !time_end ||
    !purpose ||
    !Number.isInteger(statusNum) || statusNum <= 0
  ) {
    return res.status(400).json({
      message:
        "requested_by, program_id, room_id, year_level, date_needed, time_start, time_end, purpose, status_id are required"
    });
  }

  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('createBorrowRequest connection Error:', connErr);
      return res.status(500).json({ message: "Database connection failed" });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('createBorrowRequest transaction Error:', txErr);
        return res.status(500).json({ message: "Transaction start failed" });
      }

      resolveSubjectMeta(conn, normalizedSubjectId, null, (subjectErr, subjectMeta) => {
        if (subjectErr) {
          return conn.rollback(() => {
            conn.release();
            if (subjectErr.code === 'SUBJECT_NOT_FOUND') {
              return res.status(400).json({ message: 'Selected subject was not found.' });
            }
            console.error('createBorrowRequest subject lookup Error:', subjectErr);
            return res.status(500).json({ message: 'Error validating subject selection' });
          });
        }

        resolveProgramMeta(conn, normalizedProgramId, null, (programErr, programMeta) => {
          if (programErr) {
            return conn.rollback(() => {
              conn.release();
              if (programErr.code === 'PROGRAM_NOT_FOUND') {
                return res.status(400).json({ message: 'Selected program was not found.' });
              }
              if (programErr.message === 'PROGRAM_ID_REQUIRED') {
                return res.status(400).json({ message: 'program_id is required.' });
              }
              console.error('createBorrowRequest program lookup Error:', programErr);
              return res.status(500).json({ message: 'Error validating program selection' });
            });
          }

          resolveRoomMeta(conn, normalizedRoomId, null, (roomErr, roomMeta) => {
            if (roomErr) {
              return conn.rollback(() => {
                conn.release();
                if (roomErr.code === 'ROOM_NOT_FOUND') {
                  return res.status(400).json({ message: 'Selected room was not found.' });
                }
                if (roomErr.code === 'ROOM_ID_REQUIRED') {
                  return res.status(400).json({ message: 'room_id is required.' });
                }
                console.error('createBorrowRequest room lookup Error:', roomErr);
                return res.status(500).json({ message: 'Error validating room selection' });
              });
            }

            // 1) Get active academic context (year + term)
            const ctxSql = `
              SELECT ay.academic_year_id, t.term_id
              FROM academic_year ay
              CROSS JOIN term t
              WHERE ay.is_active = 1 AND t.is_active = 1
              LIMIT 1
            `;

            conn.query(ctxSql, (ctxErr, ctxRows) => {
              if (ctxErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('createBorrowRequest context Error:', ctxErr);
                  return res.status(500).json({
                    message: "Error reading academic context"
                  });
                });
              }

              if (!ctxRows || ctxRows.length === 0) {
                return conn.rollback(() => {
                  conn.release();
                  return res.status(400).json({ message: "No active academic year/term set." });
                });
              }

              const { academic_year_id, term_id } = ctxRows[0];

              // 2) Insert borrow_request using academic_year_id + term_id from context
              const insertRequestSql = `
                INSERT INTO borrow_request
                (requested_by, lab_schedule_id, faculty_id, subject_id, program_id, year_level, date_needed, room_id, time_start, time_end, contact_details, purpose, status_id, academic_year_id, term_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              const startTime = time_start;
              const subjectLabel = subjectMeta.displayLabel || null;
              const programLabel = programMeta.displayLabel || null;
              const roomLabel = roomMeta.displayLabel || null;

              const requestValues = [
                requestedByNum,
                lab_schedule_id || null,
                facultyIdNum,
                subjectMeta.subjectId,
                normalizedProgramId,
                yearLevelNum,
                date_needed,
                normalizedRoomId,
                startTime,
                time_end,
                contact_details || null,
                purpose,
                statusNum,
                academic_year_id,
                term_id
              ];

              conn.query(insertRequestSql, requestValues, (err, result) => {
                if (err) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('createBorrowRequest Error:', err);
                    return res.status(500).json({
                      message: "Error creating borrow request"
                    });
                  });
                }

                const borrow_request_id = result.insertId;
                const ids = Array.isArray(equipment_ids) ? equipment_ids : [];
                const details = Array.isArray(equipment_details) ? equipment_details : [];
                const cleanIds = ids
                  .map((x) => Number(x))
                  .filter((n) => Number.isInteger(n) && n > 0);
                const finishRequest = (extraEmail = {}) => {
                  conn.release();

                  notifyAdmins({
                    type: 'new_request',
                    title: 'New Borrow Request',
                    message: `A new borrow request #${borrow_request_id} has been submitted for ${roomMeta.displayLabel || 'a campus room'} on ${date_needed}.`,
                    referenceType: 'borrow_request',
                    referenceId: borrow_request_id,
                    emailData: {
                      location: roomMeta.displayLabel,
                      room_label: roomMeta.displayLabel,
                      dateNeeded: date_needed,
                      timeStart: startTime,
                      timeEnd: time_end,
                      subject: subjectMeta.displayLabel,
                      subject_label: subjectMeta.displayLabel,
                      program: programMeta.displayLabel,
                      program_label: programMeta.displayLabel,
                      yearLevel: year_level
                    }
                  });

                  return res.status(201).json({
                    message: "Borrow request created successfully",
                    borrowRequestId: borrow_request_id,
                    academic_year_id,
                    term_id
                  });
                };

                if (cleanIds.length === 0) {
                  return conn.commit((cErr) => {
                    if (cErr) {
                      return conn.rollback(() => {
                        conn.release();
                        return res.status(500).json({ message: "Commit failed" });
                      });
                    }

                    return finishRequest();
                  });
                }

                const insertItemsSql = `
                  INSERT INTO borrow_request_item (borrow_request_id, equipment_id, quantity)
                  VALUES ?
                `;

                const itemRows = cleanIds.map((eqId) => {
                  const detail = details.find(d => Number(d.equipment_id) === eqId);
                  const quantity = detail && detail.requested_quantity ? Number(detail.requested_quantity) : 1;
                  return [borrow_request_id, eqId, Number.isFinite(quantity) && quantity > 0 ? quantity : 1];
                });

                conn.query(insertItemsSql, [itemRows], (err2) => {
                  if (err2) {
                    return conn.rollback(() => {
                      conn.release();
                      return res.status(500).json({
                        message: "Borrow request created but equipment items failed"
                      });
                    });
                  }

                  conn.commit((cErr) => {
                    if (cErr) {
                      return conn.rollback(() => {
                        conn.release();
                        return res.status(500).json({ message: "Commit failed" });
                      });
                    }

                    _fetchEquipmentForRequest(borrow_request_id, (eqItems) => {
                      finishRequest({ equipment: eqItems });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};
// =========================================
// GET /api/borrowRequests
// FIXED: single SELECT only, no duplicated FROM/GROUP BY,
// safe with ONLY_FULL_GROUP_BY by using MAX().
// =========================================
exports.getBorrowRequests = (req, res) => {
  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  // If explicit IDs provided, filter by them; otherwise filter by active context
  const contextFilter = (ayId && tId)
    ? 'br.academic_year_id = ? AND br.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const params = (ayId && tId) ? [ayId, tId] : [];

  const sql = `
    SELECT
      br.borrow_request_id,

      MAX(br.requested_by) AS requested_by,
      MAX(u.gmail) AS requester_gmail,
      MAX(u.role_id) AS role_id,
      MAX(ur.role_name) AS role_name,

      MAX(
        CASE
          WHEN u.role_id = 2 THEN fp.full_name
          WHEN u.role_id = 3 THEN sp.full_name
          ELSE CONCAT('User ', u.user_id)
        END
      ) AS full_name,

      MAX(br.date_needed) AS date_needed,
      MAX(br.time_start) AS time_start,
      MAX(br.time_end) AS time_end,
      MAX(br.purpose) AS purpose,
 
      MAX(br.room_id) AS room_id,
      MAX(
        TRIM(
          CONCAT_WS(' ', cr.room_number, cr.room_name)
        )
      ) AS room_label,
      MAX(cr.room_number) AS room_number,
      MAX(cr.room_name) AS room_name,

      MAX(br.subject_id) AS subject_id,
      MAX(cs.subject_code) AS subject_code,
      MAX(cs.subject_name) AS subject_name,

      MAX(br.program_id) AS program_id,
      MAX(cp.program_code) AS program_code,
      MAX(cp.program_name) AS program_name,

      MAX(br.year_level) AS year_level,

      MAX(br.status_id) AS status_id,
      MAX(s.status_name) AS status_name,
      MAX(br.created_at) AS created_at,
      MAX(br.approved_at) AS approved_at,
      MAX(br.borrowed_at) AS borrowed_at,
      MAX(br.returned_at) AS returned_at,
      MAX(br.cancelled_at) AS cancelled_at,
      MAX(br.declined_at) AS declined_at,

      COALESCE(
        GROUP_CONCAT(
          DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
          ORDER BY e.equipment_name
          SEPARATOR ', '
        ),
        ''
      ) AS equipment_list,

      TRIM(
        CONCAT(
          COALESCE(
            MAX(
              TRIM(
                CONCAT_WS(' ', cr.room_number, cr.room_name)
              )
            ),
            ''
          ),
          CASE
            WHEN COUNT(bri.equipment_id) > 0 THEN CONCAT(
              CASE
                WHEN MAX(
                  TRIM(
                    CONCAT_WS(' ', cr.room_number, cr.room_name)
                  )
                ) IS NULL OR MAX(
                  TRIM(
                    CONCAT_WS(' ', cr.room_number, cr.room_name)
                  )
                ) = ''
                  THEN ''
                ELSE ', '
              END,
              COALESCE(
                GROUP_CONCAT(
                  DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
                  ORDER BY e.equipment_name
                  SEPARATOR ', '
                ),
                ''
              )
            )
            ELSE ''
          END
        )
      ) AS particulars

    FROM borrow_request br
    JOIN user u ON u.user_id = br.requested_by
    JOIN user_role ur ON ur.role_id = u.role_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    LEFT JOIN student_profile sp ON sp.student_id = u.user_id
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    LEFT JOIN campus_program cp ON cp.program_id = br.program_id
    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    JOIN borrow_request_status s ON s.status_id = br.status_id
    LEFT JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    LEFT JOIN equipment e ON e.equipment_id = bri.equipment_id
    JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
    JOIN term t ON t.term_id = br.term_id

    WHERE ${contextFilter}
    GROUP BY br.borrow_request_id
    ORDER BY created_at DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getBorrowRequests Error:', err);
      return res.status(500).json({
        message: "Error retrieving borrow requests"
      });
    }

    return res.json(rows.map(normalizeDateField));
  });
};

// =========================================
// GET /api/borrowRequests/all
// =========================================
exports.getAllBorrowRequests = (req, res) => {
  exports.getBorrowRequests(req, res);
};

// =========================================
// GET /api/borrowRequests/:id/details
// Returns base request info plus equipment items
// =========================================
exports.getBorrowRequestDetails = (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid request id" });
  }

  const baseSql = `
    SELECT
      br.borrow_request_id,
      br.room_id,
      TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name)) AS room_label,
      cr.room_number,
      cr.room_name,
      br.date_needed,
      br.time_start,
      br.time_end,
      br.program_id,
      cp.program_code,
      cp.program_name,
      br.year_level,
      br.subject_id,
      cs.subject_name,
      cs.subject_code,
      br.purpose,
      u.role_id,
      ur.role_name
    FROM borrow_request br
    JOIN user u ON u.user_id = br.requested_by
    JOIN user_role ur ON ur.role_id = u.role_id
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    LEFT JOIN campus_program cp ON cp.program_id = br.program_id
    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    WHERE br.borrow_request_id = ?
    LIMIT 1
  `;

  db.query(baseSql, [id], (baseErr, rows) => {
    if (baseErr) {
      console.error('getBorrowRequestDetails Error:', baseErr);
      return res.status(500).json({ message: "Error fetching request details" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const request = rows[0];

    const itemsSql = `
      SELECT bri.equipment_id, bri.quantity, e.equipment_name
      FROM borrow_request_item bri
      LEFT JOIN equipment e ON e.equipment_id = bri.equipment_id
      WHERE bri.borrow_request_id = ?
    `;

    db.query(itemsSql, [id], (itemsErr, itemRows) => {
      if (itemsErr) {
        console.error('getBorrowRequestDetails items Error:', itemsErr);
        return res.status(500).json({ message: "Error fetching equipment items" });
      }

      const equipment = (itemRows || []).map(row => ({
        equipment_id: row.equipment_id,
        quantity: row.quantity || 1,
        equipment_name: row.equipment_name || null
      }));

      return res.json({
        ...normalizeDateField(request),
        equipment
      });
    });
  });
};

// =========================================
// GET /api/borrowRequests/my/:userId
// =========================================
exports.getMyBorrowRequests = (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  const contextFilter = (ayId && tId)
    ? 'br.academic_year_id = ? AND br.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const params = (ayId && tId) ? [userId, ayId, tId] : [userId];

  const sql = `
    SELECT
      br.borrow_request_id,
      MAX(br.created_at) AS created_at,
      MAX(br.date_needed) AS date_needed,
      MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) AS room_label,
      MAX(cr.room_number) AS room_number,
      MAX(cr.room_name) AS room_name,
      MAX(br.subject_id) AS subject_id,
      MAX(cs.subject_code) AS subject_code,
      MAX(cs.subject_name) AS subject,
      MAX(br.program_id) AS program_id,
      MAX(cp.program_code) AS program_code,
      MAX(cp.program_name) AS program_name,
      MAX(br.year_level) AS year_level,
      MAX(br.note) AS note,
      MAX(br.time_start) AS time_start,
      MAX(br.time_end) AS time_end,
      MAX(s.status_name) AS status_name,
      MAX(br.approved_at) AS approved_at,
      MAX(br.borrowed_at) AS borrowed_at,
      MAX(br.returned_at) AS returned_at,
      MAX(br.cancelled_at) AS cancelled_at,
      MAX(br.declined_at) AS declined_at,

      COALESCE(
        GROUP_CONCAT(
          DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
          ORDER BY e.equipment_name
          SEPARATOR ', '
        ),
        ''
      ) AS equipment_list,

      TRIM(
        CONCAT(
          COALESCE(MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))), ''),
          CASE
            WHEN COUNT(bri.equipment_id) > 0 THEN CONCAT(
              CASE WHEN MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) IS NULL OR MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) = '' THEN '' ELSE ', ' END,
              COALESCE(
                GROUP_CONCAT(
                  DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
                  ORDER BY e.equipment_name
                  SEPARATOR ', '
                ),
                ''
              )
            )
            ELSE ''
          END
        )
      ) AS particulars

    FROM borrow_request br
    JOIN borrow_request_status s ON s.status_id = br.status_id
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    LEFT JOIN campus_program cp ON cp.program_id = br.program_id
    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    LEFT JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    LEFT JOIN equipment e ON e.equipment_id = bri.equipment_id
    JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
    JOIN term t ON t.term_id = br.term_id

    WHERE br.requested_by = ? AND ${contextFilter}
    GROUP BY br.borrow_request_id
    ORDER BY created_at DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getMyBorrowRequests Error:', err);
      return res.status(500).json({
        message: "Error retrieving my requests"
      });
    }

    return res.status(200).json(rows.map(normalizeDateField));
  });
};

// =========================================
// GET /api/borrowRequests/pending
// (kept your fields, made it ONLY_FULL_GROUP_BY-safe)
// =========================================
exports.getPendingBorrowRequests = (req, res) => {
  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  const contextFilter = (ayId && tId)
    ? 'br.academic_year_id = ? AND br.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const params = (ayId && tId) ? [ayId, tId] : [];

  const sql = `
    SELECT
      br.borrow_request_id,

      MAX(br.requested_by) AS requested_by,
      MAX(u.gmail) AS requester_gmail,
      MAX(u.role_id) AS role_id,
      MAX(ur.role_name) AS role_name,

      MAX(
        CASE
          WHEN u.role_id = 2 THEN fp.full_name
          WHEN u.role_id = 3 THEN sp.full_name
          ELSE CONCAT('User ', u.user_id)
        END
      ) AS full_name,

      MAX(br.date_needed) AS date_needed,
      MAX(br.time_start) AS time_start,
      MAX(br.time_end) AS time_end,
      MAX(br.purpose) AS purpose,
      MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) AS location,
      MAX(br.subject_id) AS subject_id,
      MAX(cs.subject_code) AS subject_code,
      MAX(COALESCE(cs.subject_name, br.subject)) AS subject,
      MAX(br.program) AS program,
      MAX(br.year_level) AS year_level,

      MAX(s.status_name) AS status_name,
      MAX(br.created_at) AS created_at,
      MAX(br.approved_at) AS approved_at,
      MAX(br.borrowed_at) AS borrowed_at,
      MAX(br.returned_at) AS returned_at,
      MAX(br.cancelled_at) AS cancelled_at,
      MAX(br.declined_at) AS declined_at,

      COALESCE(
        GROUP_CONCAT(
          DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
          ORDER BY e.equipment_name
          SEPARATOR ', '
        ),
        ''
      ) AS equipment_list,

      TRIM(
        CONCAT(
          COALESCE(MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))), ''),
          CASE
            WHEN COUNT(bri.equipment_id) > 0 THEN CONCAT(
              CASE WHEN MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) IS NULL OR MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) = '' THEN '' ELSE ', ' END,
              COALESCE(
                GROUP_CONCAT(
                  DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')')
                  ORDER BY e.equipment_name
                  SEPARATOR ', '
                ),
                ''
              )
            )
            ELSE ''
          END
        )
      ) AS particulars

    FROM borrow_request br
    JOIN \`user\` u ON u.user_id = br.requested_by
    JOIN user_role ur ON ur.role_id = u.role_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    LEFT JOIN student_profile sp ON sp.student_id = u.user_id
    JOIN borrow_request_status s ON s.status_id = br.status_id
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    LEFT JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    LEFT JOIN equipment e ON e.equipment_id = bri.equipment_id
    JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
    JOIN term t ON t.term_id = br.term_id

    WHERE br.status_id = 1 AND ${contextFilter}
    GROUP BY br.borrow_request_id
    ORDER BY created_at DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getPendingBorrowRequests Error:', err);
      return res.status(500).json({
        message: "Error retrieving pending requests"
      });
    }

    return res.status(200).json(rows);
  });
};

// =========================================
// PUT /api/borrowRequests/:id/status
// status_id: 1=Pending, 2=Approved, 3=Declined, 4=Cancelled, 5=Returned, 6=Borrowed
//
// Flow:
//   Pending (1)  → Approved (2) / Declined (3) / Cancelled (4)
//   Approved (2)  → Borrowed (6) / Cancelled (4)
//   Borrowed (6)  → Returned (5)
//   Declined, Cancelled, Returned are terminal states.
//
// NOTE: Equipment quantities are NO LONGER mutated here.
// Availability is now calculated dynamically per-date via
// GET /api/equipment/availability?date=YYYY-MM-DD
//
// On APPROVAL (2): If the request has a location (lab room),
// a one-time lab_schedule entry is auto-created for that date.
// On DECLINE (3) / CANCEL (4): Any linked one-time lab_schedule
// entry is auto-deleted.
// =========================================

// Valid status transitions: from_status → [allowed_target_statuses]
const VALID_TRANSITIONS = {
  1: [2, 3, 4],   // Pending   → Approved, Declined, Cancelled
  2: [6, 4],       // Approved  → Borrowed, Cancelled
  6: [5],          // Borrowed  → Returned
};

const STATUS_TIMESTAMP_FIELDS = {
  2: 'approved_at',
  3: 'declined_at',
  4: 'cancelled_at',
  5: 'returned_at',
  6: 'borrowed_at'
};

exports.updateBorrowRequestStatus = (req, res) => {
  const id = Number(req.params.id);
  const sid = Number(req.body.status_id);
  const rejection_reason = req.body.rejection_reason;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid request id" });
  }

  if (![2, 3, 4, 5, 6].includes(sid)) {
    return res.status(400).json({ message: "Invalid status_id. Valid values: 2=Approved, 3=Declined, 4=Cancelled, 5=Returned, 6=Borrowed" });
  }

  const reason = typeof rejection_reason === "string" ? rejection_reason.trim() : "";

  // Fetch full request details (needed for one-time schedule creation)
  const getRequestSql = `
    SELECT
      br.borrow_request_id,
      br.requested_by,
      br.faculty_id,
      br.subject_id,
      br.program_id,
      br.room_id,
      br.date_needed,
      br.time_start,
      br.time_end,
      br.year_level,
      br.status_id AS current_status_id,
      br.academic_year_id,
      br.term_id,
      br.contact_details,
      br.purpose,
      br.note,
      cs.subject_code,
      cs.subject_name,
      cp.program_code,
      cp.program_name,
      cr.room_number,
      cr.room_name
    FROM borrow_request br
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    LEFT JOIN campus_program cp ON cp.program_id = br.program_id
    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    WHERE br.borrow_request_id = ?
  `;

  db.query(getRequestSql, [id], (err, requestResults) => {
    if (err) {
      console.error('updateBorrowRequestStatus fetch Error:', err);
      return res.status(500).json({
        message: "Error fetching request details"
      });
    }

    if (!requestResults || requestResults.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const request = requestResults[0];
    const subjectMeta = buildSubjectMeta({
      subject_id: request.subject_id ?? null,
      subject_code: request.subject_code ?? null,
      subject_name: request.subject_name ?? null,
    }, null);
    const programMeta = buildProgramMeta({
      program_id: request.program_id ?? null,
      program_code: request.program_code ?? null,
      program_name: request.program_name ?? null,
    }, null);
    const roomMeta = buildRoomMeta({
      room_id: request.room_id ?? null,
      room_number: request.room_number ?? null,
      room_name: request.room_name ?? null,
    }, null);

    const subjectLabel = subjectMeta.displayLabel || null;
    const programLabel = programMeta.displayLabel || null;
    const roomLabel = roomMeta.displayLabel || null;

    request.subject = subjectLabel || subjectMeta.subjectName || 'Lab Reservation';
    request.program = programLabel || null;
    request.location = roomLabel || null;
    request.subject_label = subjectLabel;
    request.program_label = programLabel;
    request.room_label = roomLabel;

    const friendlyRoom = request.room_label || request.location || 'a campus room';

    const currentStatus = request.current_status_id;

    // Validate status transition
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(sid)) {
      const statusNames = { 1: 'Pending', 2: 'Approved', 3: 'Declined', 4: 'Cancelled', 5: 'Returned', 6: 'Borrowed' };
      const fromName = statusNames[currentStatus] || `Unknown(${currentStatus})`;
      const toName = statusNames[sid] || `Unknown(${sid})`;
      return res.status(400).json({
        message: `Invalid status transition: ${fromName} → ${toName}`,
        current_status: currentStatus,
        requested_status: sid
      });
    }

    // Update the borrow request status
    const timestampField = STATUS_TIMESTAMP_FIELDS[sid];
    const timestampSql = timestampField ? `, ${timestampField} = CURRENT_TIMESTAMP` : '';

    const updateSql = `
      UPDATE borrow_request
      SET
        status_id = ?,
        note = CASE
          WHEN ? = 3 AND ? <> ''
            THEN ?
          ELSE note
        END${timestampSql}
      WHERE borrow_request_id = ?
    `;

    const updateParams = [sid, sid, reason, reason, id];

    db.query(updateSql, updateParams, (updateErr) => {
      if (updateErr) {
        console.error('updateBorrowRequestStatus Error:', updateErr);
        return res.status(500).json({
          message: "Error updating request status"
        });
      }

      const statusNames = { 2: "Approved", 3: "Declined", 4: "Cancelled", 5: "Returned", 6: "Borrowed" };

      // ── Notification side-effects ──
      const notifTypes = {
        2: 'request_approved',
        3: 'request_declined',
        4: 'request_cancelled',
        5: 'request_returned',
        6: 'request_borrowed'
      };
      const notifTitles = {
        2: 'Request Approved',
        3: 'Request Declined',
        4: 'Request Cancelled',
        5: 'Request Returned',
        6: 'Equipment Borrowed'
      };
      const notifMessages = {
        2: `Your borrow request #${id} for ${friendlyRoom} on ${request.date_needed} has been approved.`,
        3: `Your borrow request #${id} has been declined.${reason ? ' Reason: ' + reason : ''}`,
        4: `Borrow request #${id} for ${friendlyRoom} on ${request.date_needed} has been cancelled.`,
        5: `Equipment for borrow request #${id} has been marked as returned.`,
        6: `Equipment for borrow request #${id} has been marked as borrowed.`
      };

      // Notify the requester with rich email data
      _fetchEquipmentForRequest(id, (eqItems) => {
        createNotification({
          userId: request.requested_by,
          type: notifTypes[sid],
          title: notifTitles[sid],
          message: notifMessages[sid],
          referenceType: 'borrow_request',
          referenceId: id,
          emailData: {
            location: friendlyRoom,
            room_label: request.room_label,
            dateNeeded: request.date_needed,
            timeStart: request.time_start,
            timeEnd: request.time_end,
            subject: subjectLabel,
            subject_label: subjectLabel,
            program: programLabel || request.program,
            program_label: programLabel,
            yearLevel: request.year_level,
            reason: reason || null,
            equipment: eqItems
          }
        });
      });

      // ── One-time schedule side-effects ──

      if (sid === 2 && request.room_id && request.date_needed) {
        // APPROVAL: Auto-create a one-time lab schedule if request has a lab room
        _createOneTimeSchedule(id, request, (schedErr, scheduleId) => {
          if (schedErr) {
            console.error('Warning: Failed to auto-create one-time schedule for request', id, schedErr);
            // Non-fatal: the status was already updated, just warn
            return res.status(200).json({
              message: `Request status updated to ${statusNames[sid]}`,
              warning: "Failed to auto-create one-time schedule"
            });
          }
          console.log(`Auto-created one-time schedule (ID: ${scheduleId}) for approved request #${id}`);
          return res.status(200).json({
            message: `Request status updated to ${statusNames[sid]}`,
            schedule_created: true,
            schedule_id: scheduleId
          });
        });
      } else if ([3, 4].includes(sid)) {
        // DECLINE / CANCEL: Remove any linked one-time schedule
        _deleteOneTimeSchedule(id, (delErr) => {
          if (delErr) {
            console.error('Warning: Failed to delete one-time schedule for request', id, delErr);
          }
          return res.status(200).json({
            message: `Request status updated to ${statusNames[sid]}`
          });
        });
      } else {
        return res.status(200).json({
          message: `Request status updated to ${statusNames[sid]}`
        });
      }
    });
  });
};

// =========================================
// Helper: Fetch equipment items for a borrow request (for email content)
// =========================================
function _fetchEquipmentForRequest(borrowRequestId, callback) {
  const sql = `
    SELECT e.equipment_name AS name, bri.quantity
    FROM borrow_request_item bri
    JOIN equipment e ON e.equipment_id = bri.equipment_id
    WHERE bri.borrow_request_id = ?
  `;
  db.query(sql, [borrowRequestId], (err, rows) => {
    if (err || !rows) {
      callback([]);
      return;
    }
    callback(rows.map(r => ({ name: r.name, quantity: r.quantity || 1 })));
  });
}

// =========================================
// Helper: Create a one-time lab_schedule from an approved borrow request
// =========================================
function _createOneTimeSchedule(borrowRequestId, request, callback) {
  if (!request || !request.date_needed) {
    return callback(new Error("Incomplete request payload for schedule creation"));
  }

  const normalizedRequest = { ...request };

  // Derive day_of_week from date_needed using PH timezone
  const dayOfWeek = tz.dayOfWeek(request.date_needed);

  // Normalize subject/program/room labels based on canonical joins
  const subjectMeta = buildSubjectMeta({
    subject_id: request.subject_id ?? null,
    subject_code: request.subject_code ?? null,
    subject_name: request.subject_name ?? null
  }, request.subject_label || request.subject || null);

  const programMeta = buildProgramMeta({
    program_id: request.program_id ?? null,
    program_code: request.program_code ?? null,
    program_name: request.program_name ?? null
  }, request.program_label || request.program || null);

  const roomMeta = buildRoomMeta({
    room_id: request.room_id ?? null,
    room_number: request.room_number ?? null,
    room_name: request.room_name ?? null
  }, request.room_label || request.location || null);

  normalizedRequest.subject_label = subjectMeta.displayLabel || subjectMeta.subjectName || 'Lab Reservation';
  normalizedRequest.subject_code = subjectMeta.subjectCode || request.subject_code || null;
  normalizedRequest.program_label = programMeta.displayLabel || null;
  normalizedRequest.program_code = programMeta.programCode || request.program_code || null;
  normalizedRequest.room_label = roomMeta.displayLabel || null;

  normalizedRequest.subject = normalizedRequest.subject_label;
  normalizedRequest.program = normalizedRequest.program_label;
  normalizedRequest.location = normalizedRequest.room_label;

  if (!normalizedRequest.room_label) {
    return callback(new Error("Missing lab room label for schedule creation"));
  }

  // Use faculty_id from request if available, otherwise use requested_by
  const facultyId = request.faculty_id || request.requested_by;

  // Use the request's academic context, or fall back to active context
  if (request.academic_year_id && request.term_id) {
    _insertOneTimeSchedule(borrowRequestId, normalizedRequest, dayOfWeek, facultyId,
      request.academic_year_id, request.term_id, callback);
  } else {
    // Fall back to active academic context
    const ctxSql = `
      SELECT ay.academic_year_id, t.term_id
      FROM academic_year ay CROSS JOIN term t
      WHERE ay.is_active = 1 AND t.is_active = 1
      LIMIT 1
    `;
    db.query(ctxSql, (ctxErr, ctxRows) => {
      if (ctxErr || !ctxRows || ctxRows.length === 0) {
        return callback(ctxErr || new Error("No active academic context"));
      }
      _insertOneTimeSchedule(borrowRequestId, normalizedRequest, dayOfWeek, facultyId,
        ctxRows[0].academic_year_id, ctxRows[0].term_id, callback);
    });
  }
}

function _insertOneTimeSchedule(borrowRequestId, request, dayOfWeek, facultyId, academicYearId, termId, callback) {
  // Check if a one-time schedule already exists for this borrow request
  const checkSql = `SELECT schedule_id FROM lab_schedule WHERE borrow_request_id = ? LIMIT 1`;
  db.query(checkSql, [borrowRequestId], (checkErr, existing) => {
    if (checkErr) return callback(checkErr);

    if (existing && existing.length > 0) {
      // Schedule already exists — return its ID
      return callback(null, existing[0].schedule_id);
    }

    // Format date_needed as YYYY-MM-DD in PH timezone
    const schedDate = tz.toDateStr(request.date_needed);

    const insertSql = `
      INSERT INTO lab_schedule
      (room_id, faculty_id, program_id, year_level, subject_id, day_of_week,
       schedule_date, borrow_request_id, time_start, time_end,
       academic_year_id, term_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const normalizedRoomId = request.room_id ?? null;
    if (!normalizedRoomId) {
      return callback(new Error("Missing room reference for schedule creation"));
    }

    const normalizedProgramId = request.program_id ?? null;
    const normalizedSubjectId = request.subject_id ?? null;
    const facultyIdSafe = Number(facultyId);
    if (!Number.isInteger(facultyIdSafe) || facultyIdSafe <= 0) {
      return callback(new Error("Invalid faculty reference for schedule creation"));
    }

    const values = [
      Number(normalizedRoomId),
      facultyIdSafe,
      normalizedProgramId,
      request.year_level ?? null,
      normalizedSubjectId,
      dayOfWeek,
      schedDate,
      borrowRequestId,
      request.time_start,
      request.time_end,
      Number(academicYearId),
      Number(termId),
      Number(request.requested_by)
    ];

    db.query(insertSql, values, (insertErr, result) => {
      if (insertErr) return callback(insertErr);
      return callback(null, result.insertId);
    });
  });
}

// =========================================
// Helper: Delete a one-time lab_schedule linked to a borrow request
// =========================================
function _deleteOneTimeSchedule(borrowRequestId, callback) {
  const sql = `DELETE FROM lab_schedule WHERE borrow_request_id = ?`;
  db.query(sql, [borrowRequestId], (err) => {
    callback(err || null);
  });
}

// =========================================
// PUT /api/borrowRequests/:id
// Updates allowed data fields only.
// Cannot change: requested_by (ownership), status_id (use /status endpoint).
// =========================================
exports.updateBorrowRequest = (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid request id" });
  }

  // Block immutable fields
  if (req.body.requested_by !== undefined) {
    return res.status(400).json({ message: "Cannot change requested_by. Request ownership is immutable." });
  }
  if (req.body.status_id !== undefined) {
    return res.status(400).json({ message: "Cannot change status_id directly. Use PUT /api/borrowRequests/:id/status instead." });
  }

  const {
    lab_schedule_id,
    faculty_id,
    subject_id,
    program_id,
    room_id,
    year_level,
    date_needed,
    time_start,
    time_end,
    contact_details,
    purpose
  } = req.body;

  const normalizedSubjectId = subject_id ? Number(subject_id) : null;
  const normalizedProgramId = program_id ? Number(program_id) : null;
  const normalizedRoomId = room_id ? Number(room_id) : null;
  const normalizedFacultyId = faculty_id ? Number(faculty_id) : null;
  const normalizedYearLevel = year_level ? Number(year_level) : null;

  if (!date_needed || !time_start || !time_end || !purpose) {
    return res.status(400).json({
      message: "Missing required fields: date_needed, time_start, time_end, and purpose are required."
    });
  }

  if (!Number.isInteger(normalizedProgramId) || normalizedProgramId <= 0) {
    return res.status(400).json({ message: "program_id is required and must be a positive integer." });
  }

  if (!Number.isInteger(normalizedRoomId) || normalizedRoomId <= 0) {
    return res.status(400).json({ message: "room_id is required and must be a positive integer." });
  }

  if (!Number.isInteger(normalizedYearLevel) || normalizedYearLevel <= 0) {
    return res.status(400).json({ message: "year_level is required and must be a positive integer." });
  }

  if (normalizedSubjectId !== null && (!Number.isInteger(normalizedSubjectId) || normalizedSubjectId <= 0)) {
    return res.status(400).json({ message: "subject_id must be a positive integer when provided." });
  }

  if (normalizedFacultyId !== null && (!Number.isInteger(normalizedFacultyId) || normalizedFacultyId <= 0)) {
    return res.status(400).json({ message: "faculty_id must be a positive integer when provided." });
  }

  const query = `
    UPDATE borrow_request
    SET lab_schedule_id = ?,
        faculty_id = ?,
        subject_id = ?,
        program_id = ?,
        room_id = ?,
        year_level = ?,
        date_needed = ?,
        time_start = ?,
        time_end = ?,
        contact_details = ?,
        purpose = ?
    WHERE borrow_request_id = ?
  `;

  db.query(
    query,
    [
      lab_schedule_id || null,
      normalizedFacultyId,
      normalizedSubjectId,
      normalizedProgramId,
      normalizedRoomId,
      normalizedYearLevel,
      date_needed,
      time_start,
      time_end,
      contact_details || null,
      purpose,
      id
    ],
    (err, result) => {
      if (err) {
        console.error('updateBorrowRequest Error:', err);
        return res.status(500).json({
          message: "Error updating borrow request"
        });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Borrow request not found" });
      }
      return res.status(200).json({ message: "Borrow request updated successfully" });
    }
  );
};

// =========================================
// DELETE /api/borrowRequests/:id
// =========================================
exports.deleteBorrowRequest = (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM borrow_request WHERE borrow_request_id = ?";

  db.query(query, [id], (err) => {
    if (err) {
      console.error('deleteBorrowRequest Error:', err);
      return res.status(500).json({ message: "Error deleting borrow request" });
    }
    return res.status(200).json({ message: "Borrow request deleted successfully" });
  });
};

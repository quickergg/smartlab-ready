const db = require("../config/db");
const tz = require("../config/timezone");

const buildRoomLabel = (record) => {
  if (!record) return null;
  const number = record.room_number || '';
  const name = record.room_name || '';
  if (name && number) return `${name} (${number})`;
  if (name || number) return name || number;
  return null;
};

// =========================================
// POST /api/conflicts/check
// Checks lab schedules, borrow requests, and equipment availability.
// Supports matching by lab_room string plus optional room_id.
// =========================================
exports.checkConflicts = (req, res) => {
  const {
    lab_room,
    room_id,
    date_needed,
    time_start,
    time_end,
    equipment_ids = [],
    equipment_quantities = {}
  } = req.body;
  const excludeRequestId = Number(req.body.exclude_request_id);
  const excludeScheduleId = Number(req.body.exclude_schedule_id);
  const skipSchedule = req.body.skip_schedule === true;
  const includePending = req.body.include_pending_requests !== false;
  const includeRequests = req.body.include_requests === true;

  if (!lab_room || !date_needed || !time_start || !time_end) {
    return res.status(400).json({
      message: "lab_room, date_needed, time_start, and time_end are required."
    });
  }

  if (String(time_end) <= String(time_start)) {
    return res.status(400).json({ message: "time_end must be after time_start." });
  }

  const parsedDate = tz.parse(date_needed);
  if (!parsedDate.isValid()) {
    return res.status(400).json({ message: "Invalid date_needed format." });
  }

  const dayOfWeek = tz.dayOfWeek(date_needed);
  const normalizedRoomId = room_id === null || room_id === undefined || room_id === ''
    ? null
    : Number(room_id);

  if (normalizedRoomId !== null && (!Number.isInteger(normalizedRoomId) || normalizedRoomId <= 0)) {
    return res.status(400).json({ message: "Invalid room_id." });
  }

  const conflicts = [];
  const respond = () => res.json({
    hasConflict: conflicts.length > 0,
    conflicts,
    checked: {
      lab_room,
      room_id: normalizedRoomId,
      date_needed,
      day_of_week: dayOfWeek,
      time_start,
      time_end
    }
  });

  const fail = (message, err) => {
    if (err) {
      console.error(message, err);
    }
    return res.status(500).json({ message });
  };

  const continueWithRoomMeta = (roomMeta) => {
    const labRoomAliases = buildLabRoomAliases(lab_room, roomMeta);
    if (!labRoomAliases.length) {
      labRoomAliases.push(String(lab_room).trim().toUpperCase());
    }

    const { clause: scheduleLocationClause, params: scheduleLocationParams } = buildLocationFilter(
      labRoomAliases,
      normalizedRoomId,
      { roomIdColumn: 'ls.room_id' }
    );
    const scheduleParams = [...scheduleLocationParams, dayOfWeek, date_needed, time_end, time_start];

    const { clause: locationClause, params: locationParams } = buildLocationFilter(labRoomAliases, normalizedRoomId);
    let scheduleSql = `
      SELECT
        ls.schedule_id,
        ls.room_id,
        ls.day_of_week,
        ls.schedule_date,
        ls.time_start,
        ls.time_end,
        ls.year_level,
        COALESCE(fp.full_name, u.gmail, 'Unknown') AS faculty_name,
        cr.room_number,
        cr.room_name,
        TRIM(CONCAT_WS(' ', cr.room_name, cr.room_number)) AS room_label,
        cp.program_id,
        cp.program_code,
        cp.program_name,
        cs.subject_id,
        cs.subject_code,
        cs.subject_name
      FROM lab_schedule ls
      LEFT JOIN faculty_profile fp ON ls.faculty_id = fp.faculty_id
      LEFT JOIN \`user\` u ON u.user_id = ls.faculty_id
      LEFT JOIN campus_room cr ON cr.room_id = ls.room_id
      LEFT JOIN campus_program cp ON cp.program_id = ls.program_id
      LEFT JOIN campus_subject cs ON cs.subject_id = ls.subject_id
      JOIN academic_year ay ON ay.academic_year_id = ls.academic_year_id
      JOIN term t ON t.term_id = ls.term_id
      WHERE ay.is_active = 1
        AND t.is_active = 1
        AND (${scheduleLocationClause})
        AND (
          (ls.schedule_date IS NULL AND UPPER(ls.day_of_week) = ?)
          OR (ls.schedule_date = ?)
        )
        AND ls.time_start < ?
        AND ? < ls.time_end
    `;

    if (Number.isInteger(excludeScheduleId) && excludeScheduleId > 0) {
      scheduleSql += '\n        AND ls.schedule_id <> ?';
      scheduleParams.push(excludeScheduleId);
    }

    const runRequestCheck = () => {
      if (!includeRequests) {
        return runEquipmentCheck();
      }

      let requestSql = `
        SELECT
          br.borrow_request_id,
          br.room_id,
          TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name)) AS room_label,
          br.date_needed,
          br.time_start,
          br.time_end,
          br.subject_id,
          cs.subject_name AS subject_name,
          br.program_id,
          cp.program_name AS program_name,
          br.year_level,
          br.purpose,
          s.status_name,
          COALESCE(fp.full_name, sp.full_name, u.gmail, 'Unknown') AS requester_name
        FROM borrow_request br
        JOIN \`user\` u ON u.user_id = br.requested_by
        LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
        LEFT JOIN student_profile sp ON sp.student_id = u.user_id
        LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
        LEFT JOIN campus_program cp ON cp.program_id = br.program_id
        LEFT JOIN campus_room cr ON cr.room_id = br.room_id
        JOIN borrow_request_status s ON s.status_id = br.status_id
        WHERE ${locationClause}
          AND br.date_needed = ?
          AND br.status_id ${includePending ? 'IN (1, 2)' : 'IN (2)'}
          AND br.time_start < ?
          AND ? < br.time_end
      `;
      const requestParams = [...locationParams, date_needed, time_end, time_start];
      if (Number.isInteger(excludeRequestId) && excludeRequestId > 0) {
        requestSql += '\n          AND br.borrow_request_id <> ?';
        requestParams.push(excludeRequestId);
      }

      db.query(requestSql, requestParams, (requestErr, requestRows = []) => {
        if (requestErr) {
          return fail("Error checking request conflicts", requestErr);
        }

        requestRows.forEach(row => {
          const friendlyRoom = row.room_label || buildRoomLabel(row) || 'a campus room';
          conflicts.push({
            type: "borrow_request",
            severity: row.status_name === "Approved" ? "high" : "medium",
            title: "Borrow Request Conflict",
            message: `${friendlyRoom} already has a ${row.status_name.toLowerCase()} request on ${row.date_needed}`,
            details: {
              borrow_request_id: row.borrow_request_id,
              location: friendlyRoom,
              room_id: row.room_id,
              date_needed: row.date_needed,
              time_start: String(row.time_start || "").slice(0, 5),
              time_end: String(row.time_end || "").slice(0, 5),
              subject: row.subject_name,
              requester_name: row.requester_name,
              status: row.status_name,
              program: row.program_name,
              year_level: row.year_level
            }
          });
        });

        runEquipmentCheck();
      });
    };

    const maybeCheckSchedule = () => {
      if (skipSchedule) return runRequestCheck();

      db.query(scheduleSql, scheduleParams, (scheduleErr, scheduleRows = []) => {
        if (scheduleErr) {
          return fail("Error checking schedule conflicts", scheduleErr);
        }

        scheduleRows.forEach(row => {
          const isOneTime = !!row.schedule_date;
          const friendlyRoom = buildRoomLabel(row) || lab_room;
          const subjectLabel = row.subject_name || row.subject_code || 'Lab Reservation';
          const programLabel = row.program_name || row.program_code || null;
          conflicts.push({
            type: "lab_schedule",
            severity: "high",
            title: isOneTime ? "One-Time Schedule Conflict" : "Lab Schedule Conflict",
            message: isOneTime
              ? `${friendlyRoom || 'Lab'} has a one-time schedule for "${subjectLabel}" on ${row.schedule_date}`
              : `${friendlyRoom || 'Lab'} is scheduled for "${subjectLabel}" every ${row.day_of_week}`,
            details: {
              schedule_id: row.schedule_id,
              location: friendlyRoom,
              room_id: row.room_id,
              date_needed: row.schedule_date || null,
              day_of_week: row.day_of_week,
              time_start: String(row.time_start || "").slice(0, 5),
              time_end: String(row.time_end || "").slice(0, 5),
              subject: row.subject_name || row.subject_code,
              faculty_name: row.faculty_name,
              program: programLabel,
              program_code: row.program_code,
              program_name: row.program_name,
              program_id: row.program_id,
              year_level: row.year_level
            }
          });
        });

        runRequestCheck();
      });
    };

    maybeCheckSchedule();
  };

  function runEquipmentCheck() {
    if (!Array.isArray(equipment_ids) || !equipment_ids.length) {
      return respond();
    }

    const cleanIds = equipment_ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (!cleanIds.length) {
      return respond();
    }

    const placeholders = cleanIds.map(() => '?').join(',');
    const excludeClause = Number.isInteger(excludeRequestId) && excludeRequestId > 0 ? ' AND br.borrow_request_id <> ?' : '';

    const equipmentSql = `
      SELECT
        e.equipment_id,
        e.equipment_name,
        e.available_qty,
        COALESCE(approved.reserved_qty, 0) AS reserved_qty,
        GREATEST(0, e.available_qty - COALESCE(approved.reserved_qty, 0)) AS available_on_date,
        COALESCE(pending.pending_qty, 0) AS pending_qty
      FROM equipment e
      LEFT JOIN (
        SELECT bri.equipment_id, SUM(bri.quantity) AS reserved_qty
        FROM borrow_request_item bri
        JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
        WHERE br.date_needed = ? AND br.status_id = 2${excludeClause}
        GROUP BY bri.equipment_id
      ) approved ON approved.equipment_id = e.equipment_id
      LEFT JOIN (
        SELECT bri.equipment_id, SUM(bri.quantity) AS pending_qty
        FROM borrow_request_item bri
        JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
        WHERE br.date_needed = ? AND br.status_id = 1${excludeClause}
        GROUP BY bri.equipment_id
      ) pending ON pending.equipment_id = e.equipment_id
      WHERE e.equipment_id IN (${placeholders})
    `;

    const equipmentParams = [date_needed];
    if (excludeClause) equipmentParams.push(excludeRequestId);
    equipmentParams.push(date_needed);
    if (excludeClause) equipmentParams.push(excludeRequestId);
    equipmentParams.push(...cleanIds);

    db.query(equipmentSql, equipmentParams, (equipmentErr, equipmentRows = []) => {
      if (equipmentErr) {
        console.error("Conflict check - equipment query error:", equipmentErr);
        return respond();
      }

      const requestStatusClause = includePending ? 'IN (1, 2)' : 'IN (2)';
      const equipmentRequestSql = `
        SELECT bri.equipment_id, bri.borrow_request_id, s.status_name
        FROM borrow_request_item bri
        JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
        JOIN borrow_request_status s ON s.status_id = br.status_id
        WHERE br.date_needed = ?
          AND bri.equipment_id IN (${placeholders})
          AND br.status_id ${requestStatusClause}${excludeClause}
      `;

      const equipmentReqParams = [date_needed];
      if (excludeClause) equipmentReqParams.push(excludeRequestId);
      equipmentReqParams.push(...cleanIds);

      db.query(equipmentRequestSql, equipmentReqParams, (equipmentReqErr, equipmentRequestRows = []) => {
        if (equipmentReqErr) {
          console.error('Conflict check - equipment request lookup error:', equipmentReqErr);
          return respond();
        }

        const equipmentRequestMap = {};
        equipmentRequestRows.forEach(row => {
          if (!equipmentRequestMap[row.equipment_id]) equipmentRequestMap[row.equipment_id] = [];
          equipmentRequestMap[row.equipment_id].push({
            borrow_request_id: row.borrow_request_id,
            status: row.status_name
          });
        });

        equipmentRows.forEach(row => {
          const requestedQty = Number(equipment_quantities[row.equipment_id]) || 1;
          const availOnDate = row.available_on_date;

          if (requestedQty > availOnDate) {
            conflicts.push({
              type: "equipment",
              severity: "high",
              title: "Equipment Unavailable",
              message: `Only ${availOnDate} of ${row.equipment_name} available on ${date_needed} (requested ${requestedQty})`,
              details: {
                equipment_id: row.equipment_id,
                equipment_name: row.equipment_name,
                physical_stock: row.available_qty,
                reserved_approved: row.reserved_qty,
                available_on_date: availOnDate,
                pending_other: row.pending_qty,
                requested_qty: requestedQty,
                conflicting_requests: equipmentRequestMap[row.equipment_id] || []
              }
            });
          } else if (includePending && row.pending_qty > 0 && (requestedQty + row.pending_qty) > availOnDate) {
            conflicts.push({
              type: "equipment",
              severity: "medium",
              title: "Equipment Availability Warning",
              message: `${row.equipment_name}: ${availOnDate} available, but ${row.pending_qty} more pending on ${date_needed}`,
              details: {
                equipment_id: row.equipment_id,
                equipment_name: row.equipment_name,
                physical_stock: row.available_qty,
                reserved_approved: row.reserved_qty,
                available_on_date: availOnDate,
                pending_other: row.pending_qty,
                requested_qty: requestedQty,
                conflicting_requests: equipmentRequestMap[row.equipment_id] || []
              }
            });
          }
        });

        respond();
      });
    });
  }

  if (normalizedRoomId) {
    db.query(
      'SELECT room_id, room_number, room_name FROM campus_room WHERE room_id = ? LIMIT 1',
      [normalizedRoomId],
      (roomErr, roomRows) => {
        if (roomErr) {
          console.error('Conflict check - room alias lookup error:', roomErr);
          return res.status(500).json({ message: 'Error preparing room conflict check.' });
        }
        continueWithRoomMeta(roomRows && roomRows.length ? roomRows[0] : null);
      }
    );
  } else {
    continueWithRoomMeta(null);
  }
};

function buildLabRoomAliases(labRoom, roomMeta) {
  const aliases = new Set();
  const addAlias = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        aliases.add(trimmed.toUpperCase());
      }
    }
  };

  addAlias(labRoom);
  if (roomMeta) {
    addAlias(roomMeta.room_name);
    addAlias(roomMeta.room_number);

    const normalizedNumber = (roomMeta.room_number || '').replace(/[^0-9A-Za-z- ]/g, '').trim();
    if (normalizedNumber) {
      addAlias(normalizedNumber);
    }

    const numericOnly = (roomMeta.room_number || '').replace(/[^0-9]/g, '');
    if (numericOnly) {
      addAlias(numericOnly);
    }

    deriveComputerLabAliases(roomMeta).forEach(addAlias);
  }

  return Array.from(aliases);
}

function deriveComputerLabAliases(roomMeta) {
  const aliases = [];
  const roomName = (roomMeta?.room_name || '').toLowerCase();
  const numericOnly = (roomMeta?.room_number || '').replace(/[^0-9]/g, '');
  let labIndex = null;

  const nameMatch = roomName.match(/computer\s+laboratory\s*(\d+)/);
  if (nameMatch) {
    labIndex = nameMatch[1];
  } else if (numericOnly && { 101: true, 102: true, 103: true }[numericOnly]) {
    const mapping = { 101: '1', 102: '2', 103: '3' };
    labIndex = mapping[numericOnly];
  }

  if (labIndex) {
    aliases.push(`LAB ${labIndex}`);
    aliases.push(`LAB-${labIndex}`);
    aliases.push(`LAB${labIndex}`);
    aliases.push(`ROOM ${labIndex}`);
  }

  if (numericOnly && ['101', '102', '103'].includes(numericOnly)) {
    aliases.push(`ROOM ${numericOnly}`);
    aliases.push(numericOnly);
  }

  return aliases;
}

function buildLocationFilter(aliases, roomId, options = {}) {
  const roomIdColumn = options.roomIdColumn || 'br.room_id';
  const roomAlias = options.roomAlias || 'cr';
  const aliasConditions = [];
  const aliasParams = [];

  if (aliases.length) {
    const placeholders = aliases.map(() => '?').join(', ');
    const addAliasCondition = (expr) => {
      aliasConditions.push(`UPPER(${expr}) IN (${placeholders})`);
      aliasParams.push(...aliases);
    };

    addAliasCondition(`TRIM(CONCAT_WS(' ', ${roomAlias}.room_number, ${roomAlias}.room_name))`);
    addAliasCondition(`${roomAlias}.room_number`);
    addAliasCondition(`${roomAlias}.room_name`);
  }

  if (roomId) {
    if (aliasConditions.length) {
      return {
        clause: `(${roomIdColumn} = ? OR ${aliasConditions.join(' OR ')})`,
        params: [roomId, ...aliasParams]
      };
    }
    return { clause: `${roomIdColumn} = ?`, params: [roomId] };
  }

  if (aliasConditions.length) {
    return {
      clause: aliasConditions.join(' OR '),
      params: aliasParams
    };
  }

  return { clause: '1=0', params: [] };
}

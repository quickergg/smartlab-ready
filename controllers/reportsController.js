// controllers/reportsController.js
const db = require('../config/db');

// Test database connection
exports.testConnection = (req, res) => {
  db.query('SELECT 1 as test', (err, results) => {
    if (err) {
      console.error('testConnection Error:', err);
      return res.status(500).json({
        message: "Database connection failed"
      });
    }

    return res.status(200).json({
      message: "Database connection successful",
      test: results[0]
    });
  });
};

// Get comprehensive reports data - BORROW REQUESTS ONLY
exports.getReports = (req, res) => {
  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  const contextFilter = (ayId && tId)
    ? 'br.academic_year_id = ? AND br.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const params = (ayId && tId) ? [ayId, tId] : [];

  const query = `
    SELECT
      MAX(br.date_needed) AS date,
      MAX(TRIM(CONCAT_WS(' ', cr.room_number, cr.room_name))) AS location,
      MAX(COALESCE(cp.program_code, '')) AS program_code,
      MAX(COALESCE(cp.program_name, '')) AS program_name,
      MAX(br.year_level) AS year_level,
      MAX(COALESCE(cs.subject_name, '')) AS subject_name,

      COALESCE(
        GROUP_CONCAT(DISTINCT CONCAT(e.equipment_name, '(', bri.quantity, ')') ORDER BY e.equipment_name SEPARATOR ', '),
        ''
      ) AS equipment_list,
      
      MAX(CASE 
        WHEN u.role_id = 3 THEN sp.full_name
        WHEN u.role_id = 2 THEN fp.full_name
        ELSE CONCAT('User ', u.user_id)
      END) AS requester_name,
      
      MAX(TRIM(CONCAT(
        COALESCE(cp.program_name, ''),
        CASE WHEN br.year_level IS NOT NULL AND br.year_level <> '' THEN CONCAT(' ', br.year_level) ELSE '' END
      ))) AS course_year,
      
      MAX(COALESCE(fp_req.full_name, fp_sched.full_name, 'N/A')) AS faculty_in_charge,
      
      MAX(br.time_start) AS time_start,
      MAX(br.time_end) AS time_end,
      
      MAX(brs.status_name) AS status
      
    FROM borrow_request br
    JOIN user u ON u.user_id = br.requested_by
    JOIN user_role ur ON ur.role_id = u.role_id
    LEFT JOIN student_profile sp ON sp.student_id = u.user_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    
    LEFT JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    LEFT JOIN equipment e ON e.equipment_id = bri.equipment_id

    LEFT JOIN campus_room cr ON cr.room_id = br.room_id
    LEFT JOIN campus_program cp ON cp.program_id = br.program_id
    LEFT JOIN campus_subject cs ON cs.subject_id = br.subject_id
    
    LEFT JOIN lab_schedule ls ON ls.schedule_id = br.lab_schedule_id
    LEFT JOIN faculty_profile fp_sched ON fp_sched.faculty_id = ls.faculty_id
    
    LEFT JOIN faculty_profile fp_req ON fp_req.faculty_id = br.faculty_id
    
    JOIN borrow_request_status brs ON brs.status_id = br.status_id
    JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
    JOIN term t ON t.term_id = br.term_id
    
    WHERE ${contextFilter}
    GROUP BY br.borrow_request_id
    ORDER BY br.created_at DESC, br.time_start ASC
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Reports query error:', err);
      return res.status(500).json({
        message: "Error retrieving reports"
      });
    }

    return res.status(200).json(results);
  });
};

// Get reports by type (schedule, borrow_request, equipment_usage)
// Get reports by type (only borrow_request supported for now)
exports.getReportsByType = (req, res) => {
  const { type } = req.params;

  if (type !== 'borrow_request') {
    return res.status(400).json({
      message: "Invalid report type. Only 'borrow_request' is supported"
    });
  }

  // Use the same query as getReports
  exports.getReports(req, res);
};

// Get equipment summary report with optional date-range usage stats
// GET /api/reports/equipment-summary?date_from=...&date_to=...
exports.getEquipmentSummary = (req, res) => {
  const dateFrom = req.query.date_from || null;
  const dateTo   = req.query.date_to   || null;
  const hasRange = dateFrom && dateTo;

  // Base: current inventory snapshot for every equipment item
  // If date range provided, also calculate usage from borrow_request data
  const sql = `
    SELECT
      e.equipment_id,
      e.equipment_name,
      e.total_qty,
      e.available_qty,
      e.borrowed_qty   AS current_borrowed,
      e.damaged_qty    AS current_damaged,
      es.status_name,

      ${hasRange ? `
      COALESCE(eq_usage.times_borrowed, 0)  AS times_borrowed,
      COALESCE(eq_usage.qty_borrowed, 0)    AS qty_borrowed,
      COALESCE(eq_usage.times_returned, 0)  AS times_returned,
      COALESCE(eq_usage.qty_returned, 0)    AS qty_returned
      ` : `
      0 AS times_borrowed,
      0 AS qty_borrowed,
      0 AS times_returned,
      0 AS qty_returned
      `}

    FROM equipment e
    JOIN equipment_status es ON e.status_id = es.status_id

    ${hasRange ? `
    LEFT JOIN (
      SELECT
        bri.equipment_id,
        SUM(CASE WHEN br.status_id IN (2, 5, 6) THEN 1 ELSE 0 END)            AS times_borrowed,
        SUM(CASE WHEN br.status_id IN (2, 5, 6) THEN bri.quantity ELSE 0 END)  AS qty_borrowed,
        SUM(CASE WHEN br.status_id = 5 THEN 1 ELSE 0 END)                      AS times_returned,
        SUM(CASE WHEN br.status_id = 5 THEN bri.quantity ELSE 0 END)            AS qty_returned
      FROM borrow_request_item bri
      JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
      WHERE br.date_needed >= ? AND br.date_needed <= ?
      GROUP BY bri.equipment_id
    ) eq_usage ON eq_usage.equipment_id = e.equipment_id
    ` : ''}

    ORDER BY e.equipment_name
  `;

  const params = hasRange ? [dateFrom, dateTo] : [];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('getEquipmentSummary Error:', err);
      return res.status(500).json({ message: 'Error retrieving equipment summary' });
    }
    return res.status(200).json(results);
  });
};

// Get reports summary statistics
exports.getReportsSummary = (req, res) => {
  const ayId = req.query.academic_year_id ? Number(req.query.academic_year_id) : null;
  const tId  = req.query.term_id ? Number(req.query.term_id) : null;

  const contextFilter = (ayId && tId)
    ? 'br.academic_year_id = ? AND br.term_id = ?'
    : 'ay.is_active = 1 AND t.is_active = 1';
  const contextFilterLab = contextFilter.replace(/br\./g, 'ls.');
  const params = (ayId && tId) ? [ayId, tId] : [];

  const paramsForBorrowRequests = [];
  for (let i = 0; i < 4; i += 1) {
    paramsForBorrowRequests.push(...params);
  }
  const paramsForLabSchedules = [...params];
  const allParams = [...paramsForBorrowRequests, ...paramsForLabSchedules];
  const phNowExpr = "CONVERT_TZ(NOW(), '+00:00', '+08:00')";

  const query = `
    SELECT
      /* Borrow Request Statistics (scoped to academic context) */
      (SELECT COUNT(*)
       FROM borrow_request br
       JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
       JOIN term t ON t.term_id = br.term_id
       WHERE ${contextFilter}) AS total_borrow_requests,

      (SELECT COUNT(*)
       FROM borrow_request br
       JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
       JOIN term t ON t.term_id = br.term_id
       WHERE br.status_id = 2 AND ${contextFilter}) AS active_borrow_requests,

      (SELECT COUNT(*)
       FROM borrow_request br
       JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
       JOIN term t ON t.term_id = br.term_id
       WHERE br.status_id = 5 AND ${contextFilter}) AS returned_items,

      (SELECT COUNT(*)
       FROM borrow_request br
       JOIN academic_year ay ON ay.academic_year_id = br.academic_year_id
       JOIN term t ON t.term_id = br.term_id
       WHERE br.status_id = 1 AND ${contextFilter}) AS pending_borrow_requests,

      /* Equipment Statistics (not context-dependent) */
      (SELECT COUNT(*) FROM equipment) AS total_equipment,
      (SELECT COUNT(*) FROM equipment WHERE status_id = 1) AS available_equipment,
      (SELECT COUNT(*) FROM equipment WHERE status_id = 2) AS borrowed_equipment,

      /* User Statistics (not context-dependent) */
      (SELECT COUNT(*) FROM \`user\`) AS total_users,
      (SELECT COUNT(*)
       FROM user u
       JOIN user_role r ON r.role_id = u.role_id
       WHERE r.role_name = 'Student') AS total_students,

      (SELECT COUNT(*)
       FROM user u
       JOIN user_role r ON r.role_id = u.role_id
       WHERE r.role_name = 'Faculty') AS total_faculty,

      /* Lab Schedule activity (context-dependent) */
      (SELECT COUNT(*)
       FROM lab_schedule ls
       JOIN academic_year ay ON ay.academic_year_id = ls.academic_year_id
       JOIN term t ON t.term_id = ls.term_id
       WHERE ${contextFilterLab}
         AND (
           (ls.schedule_date IS NOT NULL AND ls.schedule_date = DATE(${phNowExpr}))
           OR (ls.schedule_date IS NULL AND UPPER(ls.day_of_week) = UPPER(DAYNAME(${phNowExpr})))
         )
      ) AS active_labs_today
  `;

  db.query(query, allParams, (err, results) => {
    if (err) {
      console.error('Error retrieving reports summary:', err);
      return res.status(500).json({
        message: "Error retrieving reports summary"
      });
    }

    return res.status(200).json(results[0] || {});
  });
};

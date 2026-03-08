const db = require('../config/db');

// Get active academic context
exports.getActiveAcademicContext = (req, res) => {
  const query = `
    SELECT
      ay.academic_year_id,
      ay.academic_year,
      t.term_id,
      t.term
    FROM academic_year ay
    CROSS JOIN term t
    WHERE ay.is_active = 1
      AND t.is_active = 1
    LIMIT 1
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('getActiveAcademicContext Error:', err);
      return res.status(500).json({
        message: 'Error retrieving active academic context'
      });
    }

    if (results.length === 0) {
      return res.status(400).json({
        message: 'No active academic year and term set'
      });
    }

    // Return single object, not array
    res.status(200).json(results[0]);
  });
};

// Get all academic years
exports.getAcademicYears = (req, res) => {
  db.query("SELECT * FROM academic_year ORDER BY academic_year DESC", (err, results) => {
    if (err) {
      console.error('getAcademicYears Error:', err);
      return res.status(500).json({ message: "Error retrieving academic years" });
    }
    res.status(200).json(results);
  });
};

// Get all terms
exports.getTerms = (req, res) => {
  db.query("SELECT * FROM term ORDER BY term_id", (err, results) => {
    if (err) {
      console.error('getTerms Error:', err);
      return res.status(500).json({ message: "Error retrieving terms" });
    }
    res.status(200).json(results);
  });
};

// Update active academic context (set active year + term)
exports.updateActiveContext = (req, res) => {
  const { academic_year_id, term_id } = req.body;

  if (!academic_year_id || !term_id) {
    return res.status(400).json({ message: "academic_year_id and term_id are required" });
  }

  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('updateActiveContext connection Error:', connErr);
      return res.status(500).json({ message: "Database connection failed" });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('updateActiveContext transaction Error:', txErr);
        return res.status(500).json({ message: "Transaction failed" });
      }

      // Deactivate all years, then activate selected
      conn.query("UPDATE academic_year SET is_active = 0", (err1) => {
        if (err1) return conn.rollback(() => { conn.release(); console.error('updateActiveContext Error:', err1); res.status(500).json({ message: "Error updating years" }); });

        conn.query("UPDATE academic_year SET is_active = 1 WHERE academic_year_id = ?", [academic_year_id], (err2) => {
          if (err2) return conn.rollback(() => { conn.release(); console.error('updateActiveContext Error:', err2); res.status(500).json({ message: "Error activating year" }); });

          // Deactivate all terms, then activate selected
          conn.query("UPDATE term SET is_active = 0", (err3) => {
            if (err3) return conn.rollback(() => { conn.release(); console.error('updateActiveContext Error:', err3); res.status(500).json({ message: "Error updating terms" }); });

            conn.query("UPDATE term SET is_active = 1 WHERE term_id = ?", [term_id], (err4) => {
              if (err4) return conn.rollback(() => { conn.release(); console.error('updateActiveContext Error:', err4); res.status(500).json({ message: "Error activating term" }); });

              conn.commit((cErr) => {
                if (cErr) return conn.rollback(() => { conn.release(); console.error('updateActiveContext commit Error:', cErr); res.status(500).json({ message: "Commit failed" }); });
                conn.release();
                res.status(200).json({ message: "Academic context updated successfully" });
              });
            });
          });
        });
      });
    });
  });
};

// Add a new academic year
exports.addAcademicYear = (req, res) => {
  const { academic_year } = req.body;
  if (!academic_year || !academic_year.trim()) {
    return res.status(400).json({ message: "academic_year is required (e.g. '2026-2027')" });
  }

  db.query("INSERT INTO academic_year (academic_year, is_active) VALUES (?, 0)", [academic_year.trim()], (err, result) => {
    if (err) {
      console.error('addAcademicYear Error:', err);
      return res.status(500).json({ message: "Error adding academic year" });
    }
    res.status(201).json({ message: "Academic year added", academic_year_id: result.insertId });
  });
};

// controllers/userController.js
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const resolveProgramRecord = (dbSource, { programId, programLabel }, callback) => {
  const querySource = dbSource && typeof dbSource.query === 'function' ? dbSource : db;

  if (hasValue(programId)) {
    const parsed = Number(programId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return callback({ status: 400, message: "program_id must be a positive integer" });
    }

    return querySource.query(
      'SELECT program_id, program_code, program_name FROM campus_program WHERE program_id = ?',
      [parsed],
      (err, rows) => {
        if (err) return callback(err);
        if (!rows || !rows.length) {
          return callback({ status: 400, message: 'Program not found.' });
        }
        return callback(null, rows[0]);
      }
    );
  }

  const label = typeof programLabel === 'string' ? programLabel.trim() : '';
  if (label) {
    return querySource.query(
      `SELECT program_id, program_code, program_name
       FROM campus_program
       WHERE UPPER(program_code) = UPPER(?) OR UPPER(program_name) = UPPER(?)
       LIMIT 1`,
      [label, label],
      (err, rows) => {
        if (err) return callback(err);
        if (!rows || !rows.length) {
          return callback({ status: 400, message: 'Program not found for provided value.' });
        }
        return callback(null, rows[0]);
      }
    );
  }

  return callback({ status: 400, message: 'Valid program_id is required for students' });
};

/* =========================================================
   USERS (CREATE / READ / UPDATE / DELETE) + LOOKUPS + LOGIN
   Schema note: `user` table uses column `gmail` (not `username`)
========================================================= */

// POST /api/users (create account)
exports.createUser = (req, res) => {
  const {
    full_name,
    gmail,
    password,
    role_id,
    department_id: bodyDepartmentId,
    departmentId,
    program,
    program_id: bodyProgramId,
    programId,
    year
  } = req.body;

  // Basic validation (shared)
  if (!full_name || !gmail || !password || !role_id) {
    return res.status(400).json({
      message: "full_name, gmail, password, and role_id are required"
    });
  }

  const status_id = 1;

  bcrypt.hash(password, SALT_ROUNDS, (hashErr, password_hash) => {
    if (hashErr) {
      console.error('createUser hash Error:', hashErr);
      return res.status(500).json({ message: "Error creating user" });
    }

    db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('createUser connection Error:', connErr);
      return res.status(500).json({ message: "Database connection failed" });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('createUser transaction Error:', txErr);
        return res.status(500).json({
          message: "Transaction start failed"
        });
      }

      const insertUserSql =
        "INSERT INTO `user` (gmail, password_hash, role_id, status_id) VALUES (?, ?, ?, ?)";

      conn.query(insertUserSql, [gmail, password_hash, Number(role_id), status_id], (err, result) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(409).json({
                message: "Gmail already exists. Use a different one."
              });
            }

            console.error('createUser Error:', err);
            return res.status(500).json({
              message: "Error creating user"
            });
          });
        }

        const user_id = result.insertId;
        const roleNum = Number(role_id);

        // STUDENT (role_id = 3)
        if (roleNum === 3) {
          const year_level = Number(year);
          if (!Number.isInteger(year_level) || year_level <= 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(400).json({ message: "Valid year level is required for students" });
            });
          }

          const resolvedProgramIdInput = hasValue(bodyProgramId) ? bodyProgramId : programId;

          return resolveProgramRecord(
            conn,
            { programId: resolvedProgramIdInput, programLabel: program },
            (progErr, programRecord) => {
              if (progErr) {
                return conn.rollback(() => {
                  conn.release();
                  if (progErr.status) {
                    return res.status(progErr.status).json({ message: progErr.message });
                  }
                  console.error('createUser program resolve Error:', progErr);
                  return res.status(500).json({ message: 'Program lookup failed' });
                });
              }

              const insertStudentSql =
                "INSERT INTO student_profile (student_id, full_name, program_id, year_level) VALUES (?, ?, ?, ?)";

              conn.query(insertStudentSql, [
                user_id,
                full_name,
                programRecord.program_id,
                year_level
              ], (err2) => {
                if (err2) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('createUser student profile Error:', err2);
                    res.status(500).json({
                      message: "Student profile creation failed"
                    });
                  });
                }

                conn.commit((cErr) => {
                  if (cErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error('createUser commit Error:', cErr);
                      res.status(500).json({
                        message: "Commit failed"
                      });
                    });
                  }

                  conn.release();
                  return res.status(201).json({
                    message: "Student account created successfully",
                    user_id
                  });
                });
              });
            }
          );
        }

        // FACULTY (role_id = 2)
        if (roleNum === 2) {
          const resolvedDepartmentId = bodyDepartmentId ?? departmentId;
          const departmentIdNum = resolvedDepartmentId === null || resolvedDepartmentId === undefined || resolvedDepartmentId === ''
            ? null
            : Number(resolvedDepartmentId);

          if (!Number.isInteger(departmentIdNum) || departmentIdNum <= 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(400).json({ message: "Valid department_id is required for faculty" });
            });
          }

          const insertFacultySql =
            "INSERT INTO faculty_profile (faculty_id, full_name, department_id) VALUES (?, ?, ?)";

          conn.query(insertFacultySql, [user_id, full_name, departmentIdNum], (err3) => {
            if (err3) {
              return conn.rollback(() => {
                conn.release();
                console.error('createUser faculty profile Error:', err3);
                res.status(500).json({
                  message: "Faculty profile creation failed"
                });
              });
            }

            conn.commit((cErr) => {
              if (cErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('createUser commit Error:', cErr);
                  res.status(500).json({
                    message: "Commit failed"
                  });
                });
              }

              conn.release();
              return res.status(201).json({
                message: "Faculty account created successfully",
                user_id
              });
            });
          });

          return;
        }

        // OTHER ROLES (e.g., Admin)
        conn.commit((cErr) => {
          if (cErr) {
            return conn.rollback(() => {
              conn.release();
              console.error('createUser commit Error:', cErr);
              res.status(500).json({
                message: "Commit failed"
              });
            });
          }

          conn.release();
          return res.status(201).json({
            message: "Account created successfully",
            user_id
          });
        });
      });
    });
  });
  });
};

// Get all users (with role, status, and profile details)
exports.getUsers = (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.gmail,
      u.role_id,
      r.role_name,
      u.status_id,
      s.status_name,
      COALESCE(sp.full_name, fp.full_name, ap.full_name, NULL) AS full_name,
      fp.department_id,
      cd.department_code,
      cd.department_name,
      cd.department_name AS department,
      sp.program_id,
      cp.program_code,
      cp.program_name,
      COALESCE(cp.program_name, cp.program_code) AS program,
      sp.year_level
    FROM user u
    JOIN user_role r ON r.role_id = u.role_id
    JOIN user_status s ON s.status_id = u.status_id
    LEFT JOIN student_profile sp ON sp.student_id = u.user_id
    LEFT JOIN campus_program cp ON cp.program_id = sp.program_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    LEFT JOIN campus_department cd ON cd.department_id = fp.department_id
    LEFT JOIN admin_profile ap ON ap.admin_id = u.user_id
    ORDER BY u.user_id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('getUsers Error:', err);
      return res.status(500).json({
        message: "Error retrieving users"
      });
    }
    res.status(200).json(results);
  });
};

// Get all the faculty
exports.getFacultyUsers = (req, res) => {
  const sql = `
    SELECT 
      u.user_id AS faculty_id,
      COALESCE(fp.full_name, u.gmail) AS full_name,
      fp.department_id,
      cd.department_code,
      cd.department_name,
      u.gmail
    FROM user u
    JOIN user_role r ON r.role_id = u.role_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    LEFT JOIN campus_department cd ON cd.department_id = fp.department_id
    WHERE r.role_name = 'Faculty'
    ORDER BY COALESCE(fp.full_name, u.gmail)
  `;
 
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('getFacultyUsers Error:', err);
      return res.status(500).json({
        message: "Error retrieving faculty list"
      });
    }
    res.json(rows);
  });
};

// Get a single user by ID
exports.getUserById = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT
      u.user_id,
      u.gmail,
      u.role_id,
      r.role_name,
      u.status_id,
      s.status_name,
      COALESCE(sp.full_name, fp.full_name, ap.full_name, NULL) AS full_name,
      fp.department_id,
      cd.department_code,
      cd.department_name,
      cd.department_name AS department,
      sp.program_id,
      cp.program_code,
      cp.program_name,
      COALESCE(cp.program_name, cp.program_code) AS program,
      sp.year_level
    FROM user u
    JOIN user_role r ON r.role_id = u.role_id
    JOIN user_status s ON s.status_id = u.status_id
    LEFT JOIN student_profile sp ON sp.student_id = u.user_id
    LEFT JOIN campus_program cp ON cp.program_id = sp.program_id
    LEFT JOIN faculty_profile fp ON fp.faculty_id = u.user_id
    LEFT JOIN campus_department cd ON cd.department_id = fp.department_id
    LEFT JOIN admin_profile ap ON ap.admin_id = u.user_id
    WHERE u.user_id = ?
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('getUserById Error:', err);
      return res.status(500).json({ message: "Error retrieving user" });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(results[0]);
  });
};

// Update a user
exports.updateUser = (req, res) => {
  const { id } = req.params;
  const {
    gmail,
    password_hash,
    role_id,
    status_id,
    full_name,
    department_id: bodyDepartmentId,
    departmentId,
    program,
    program_id: bodyProgramId,
    programId,
    year_level
  } = req.body;

  if (!gmail || !role_id || !status_id) {
    return res.status(400).json({
      message: "gmail, role_id, and status_id are required"
    });
  }

  // Start transaction to update user and profile tables
  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('updateUser connection Error:', connErr);
      return res.status(500).json({ message: "Database connection failed" });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('updateUser transaction Error:', txErr);
        return res.status(500).json({
          message: "Transaction start failed"
        });
      }

      // Build dynamic query for user table
      let query = "UPDATE `user` SET gmail = ?, role_id = ?, status_id = ?";
      let params = [gmail, Number(role_id), Number(status_id)];

      const runUserUpdate = () => {
        query += " WHERE user_id = ?";
        params.push(id);

        // Update user table first
        conn.query(query, params, (err) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            console.error('updateUser Error:', err);
            return res.status(500).json({ message: "Error updating user" });
          });
        }

        // Update profile table based on role
        const roleNum = Number(role_id);
        
        if (roleNum === 3) {
          const hasProgramField = Object.prototype.hasOwnProperty.call(req.body, 'program_id')
            || Object.prototype.hasOwnProperty.call(req.body, 'programId');

          const finalizeStudentUpdate = (programUpdate) => {
            let studentQuery = "UPDATE student_profile SET";
            let studentParams = [];
            let updates = [];

            if (full_name !== undefined) {
              updates.push(" full_name = ?");
              studentParams.push(full_name);
            }

            if (programUpdate !== undefined) {
              updates.push(" program_id = ?");
              studentParams.push(programUpdate ? programUpdate.program_id : null);
            }

            if (year_level !== undefined) {
              updates.push(" year_level = ?");
              studentParams.push(year_level);
            }

            if (updates.length === 0) {
              conn.commit((cErr) => {
                if (cErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('updateUser commit Error:', cErr);
                    return res.status(500).json({ message: "Commit failed" });
                  });
                }
                conn.release();
                return res.status(200).json({ message: "User updated successfully" });
              });
              return;
            }

            studentQuery += updates.join(',') + " WHERE student_id = ?";
            studentParams.push(id);

            conn.query(studentQuery, studentParams, (err2) => {
              if (err2) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('updateUser student profile Error:', err2);
                  return res.status(500).json({ message: "Error updating student profile" });
                });
              }

              conn.commit((cErr) => {
                if (cErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('updateUser commit Error:', cErr);
                    return res.status(500).json({ message: "Commit failed" });
                  });
                }
                conn.release();
                res.status(200).json({ message: "User updated successfully" });
              });
            });
          };

          if (hasProgramField) {
            const resolvedProgramIdInput = hasValue(bodyProgramId) ? bodyProgramId : programId;

            if (!hasValue(resolvedProgramIdInput)) {
              return finalizeStudentUpdate(null);
            }

            return resolveProgramRecord(
              conn,
              { programId: resolvedProgramIdInput },
              (progErr, programRecord) => {
                if (progErr) {
                  return conn.rollback(() => {
                    conn.release();
                    if (progErr.status) {
                      return res.status(progErr.status).json({ message: progErr.message });
                    }
                    console.error('updateUser program resolve Error:', progErr);
                    return res.status(500).json({ message: 'Program lookup failed' });
                  });
                }

                finalizeStudentUpdate({
                  program_id: programRecord.program_id
                });
              }
            );
          }
          return finalizeStudentUpdate(undefined);

        } else if (roleNum === 2) {
          // Faculty - update faculty_profile
          let facultyQuery = "UPDATE faculty_profile SET";
          let facultyParams = [];
          let updates = [];

          if (full_name !== undefined) {
            updates.push(" full_name = ?");
            facultyParams.push(full_name);
          }
          const resolvedDepartmentId = bodyDepartmentId ?? departmentId;
          if (resolvedDepartmentId !== undefined) {
            let departmentValue = null;
            if (resolvedDepartmentId !== null && resolvedDepartmentId !== '') {
              const parsed = Number(resolvedDepartmentId);
              if (!Number.isInteger(parsed) || parsed <= 0) {
                return conn.rollback(() => {
                  conn.release();
                  return res.status(400).json({ message: "department_id must be a positive integer" });
                });
              }
              departmentValue = parsed;
            }
            updates.push(" department_id = ?");
            facultyParams.push(departmentValue);
          }

          if (updates.length > 0) {
            facultyQuery += updates.join(',') + " WHERE faculty_id = ?";
            facultyParams.push(id);

            conn.query(facultyQuery, facultyParams, (err3) => {
              if (err3) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('updateUser faculty profile Error:', err3);
                  return res.status(500).json({ message: "Error updating faculty profile" });
                });
              }

              conn.commit((cErr) => {
                if (cErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('updateUser commit Error:', cErr);
                    return res.status(500).json({ message: "Commit failed" });
                  });
                }
                conn.release();
                res.status(200).json({ message: "User updated successfully" });
              });
            });
          } else {
            // No profile updates needed
            conn.commit((cErr) => {
              if (cErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('updateUser commit Error:', cErr);
                  return res.status(500).json({ message: "Commit failed" });
                });
              }
              conn.release();
              res.status(200).json({ message: "User updated successfully" });
            });
          }

        } else {
          // Other roles (like admin) - no profile table to update
          conn.commit((cErr) => {
            if (cErr) {
              return conn.rollback(() => {
                conn.release();
                console.error('updateUser commit Error:', cErr);
                return res.status(500).json({ message: "Commit failed" });
              });
            }
            conn.release();
            res.status(200).json({ message: "User updated successfully" });
          });
        }
      });
      };

      // Add optional password (hashed with bcrypt)
      if (password_hash !== undefined && password_hash !== '') {
        bcrypt.hash(password_hash, SALT_ROUNDS, (hashErr, hashed) => {
          if (hashErr) {
            return conn.rollback(() => {
              conn.release();
              console.error('updateUser hash Error:', hashErr);
              return res.status(500).json({ message: "Error updating user" });
            });
          }
          query += ", password_hash = ?";
          params.push(hashed);
          runUserUpdate();
        });
      } else {
        runUserUpdate();
      }
    });
  });
};

// Delete a user (with dependency checks)
exports.deleteUser = (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  // 1) Verify user exists
  db.query("SELECT user_id, role_id FROM `user` WHERE user_id = ?", [id], (err, userRows) => {
    if (err) {
      console.error('deleteUser check Error:', err);
      return res.status(500).json({ message: "Error checking user" });
    }
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2) Check for active borrow requests (Pending=1, Approved=2, Borrowed=6)
    const activeBorrowSql = `
      SELECT COUNT(*) AS cnt
      FROM borrow_request
      WHERE requested_by = ? AND status_id IN (1, 2, 6)
    `;

    // 3) Check for lab schedules assigned to this user
    const labScheduleSql = `
      SELECT COUNT(*) AS cnt
      FROM lab_schedule
      WHERE faculty_id = ?
    `;

    // 4) Check for borrow requests reviewed by this user (non-null reviewed_by)
    const reviewedBorrowSql = `
      SELECT COUNT(*) AS cnt
      FROM borrow_request
      WHERE reviewed_by = ?
    `;

    // 5) Check for audit log entries
    const auditLogSql = `
      SELECT COUNT(*) AS cnt
      FROM audit_log
      WHERE actor_user_id = ?
    `;

    db.query(activeBorrowSql, [id], (err1, borrowRows) => {
      if (err1) {
        console.error('deleteUser borrow check Error:', err1);
        return res.status(500).json({ message: "Error checking borrow requests" });
      }

      db.query(labScheduleSql, [id], (err2, scheduleRows) => {
        if (err2) {
          console.error('deleteUser schedule check Error:', err2);
          return res.status(500).json({ message: "Error checking lab schedules" });
        }

        db.query(reviewedBorrowSql, [id], (err3, reviewedRows) => {
          if (err3) {
            console.error('deleteUser reviewed check Error:', err3);
            return res.status(500).json({ message: "Error checking reviewed requests" });
          }

          db.query(auditLogSql, [id], (err4, auditRows) => {
            if (err4) {
              console.error('deleteUser audit check Error:', err4);
              return res.status(500).json({ message: "Error checking audit logs" });
            }

            const activeBorrows = borrowRows[0].cnt;
            const labSchedules = scheduleRows[0].cnt;
            const reviewedBorrows = reviewedRows[0].cnt;
            const auditLogs = auditRows[0].cnt;

            // Block deletion if there are active borrow requests or lab schedules
            if (activeBorrows > 0 || labSchedules > 0) {
              const reasons = [];
              if (activeBorrows > 0) reasons.push(`${activeBorrows} active borrow request(s) (Pending/Approved/Borrowed)`);
              if (labSchedules > 0) reasons.push(`${labSchedules} lab schedule(s)`);

              return res.status(409).json({
                message: "Cannot delete user with active references. Resolve these first:",
                reasons
              });
            }

            // Warn but allow if only historical references exist (reviewed_by, audit_log)
            // Nullify reviewed_by references before deleting
            const nullifyReviewerSql = "UPDATE borrow_request SET reviewed_by = NULL WHERE reviewed_by = ?";

            db.query(nullifyReviewerSql, [id], (err5) => {
              if (err5) {
                console.error('deleteUser clear reviewer Error:', err5);
                return res.status(500).json({ message: "Error clearing reviewer references" });
              }

              // Nullify faculty_id references in borrow_request
              const nullifyFacultySql = "UPDATE borrow_request SET faculty_id = NULL WHERE faculty_id = ?";

              db.query(nullifyFacultySql, [id], (err6) => {
                if (err6) {
                  console.error('deleteUser clear faculty Error:', err6);
                  return res.status(500).json({ message: "Error clearing faculty references" });
                }

                // Delete audit log entries for this user
                db.query("DELETE FROM audit_log WHERE actor_user_id = ?", [id], (err7) => {
                  if (err7) {
                    console.error('deleteUser clear audit Error:', err7);
                    return res.status(500).json({ message: "Error clearing audit log references" });
                  }

                  // Now safe to delete (profile tables cascade)
                  db.query("DELETE FROM `user` WHERE user_id = ?", [id], (delErr) => {
                    if (delErr) {
                      console.error('deleteUser Error:', delErr);
                      return res.status(500).json({ message: "Error deleting user" });
                    }
                    res.status(200).json({ message: "User deleted successfully" });
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

// Get user status
exports.getUserStatus = (req, res) => {
  const query = "SELECT status_id, status_name FROM user_status";
  db.query(query, (err, results) => {
    if (err) {
      console.error('getUserStatus Error:', err);
      return res.status(500).json({ message: "Error retrieving user status" });
    }
    res.status(200).json(results);
  });
};

// Activate user
exports.activateUser = (req, res) => {
  const userId = req.params.id;
  
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = "UPDATE `user` SET status_id = 1 WHERE user_id = ?";
  
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('activateUser Error:', err);
      return res.status(500).json({ 
        message: "Error activating user" 
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({ message: "User activated successfully" });
  });
};

// Deactivate user
exports.deactivateUser = (req, res) => {
  const userId = req.params.id;
  
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = "UPDATE `user` SET status_id = 2 WHERE user_id = ?";
  
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('deactivateUser Error:', err);
      return res.status(500).json({ 
        message: "Error deactivating user" 
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({ message: "User deactivated successfully" });
  });
};

// Get user role
exports.getUserRole = (req, res) => {
  const query = "SELECT role_id, role_name FROM user_role WHERE role_id > 1";
  db.query(query, (err, results) => {
    if (err) {
      console.error('getUserRole Error:', err);
      return res.status(500).json({ message: "Error retrieving user role" });
    }
    res.status(200).json(results);
  });
};

// Change password (self-service or admin reset)
// PUT /api/users/:id/password
// Uses req.user from JWT for caller identity (user_id, role_id).
exports.changePassword = (req, res) => {
  const targetId = Number(req.params.id);
  const { current_password, new_password } = req.body;

  const callerId = req.user.user_id;
  const isAdmin = req.user.role_id === 1;
  const isSelf = callerId === targetId;

  if (!new_password) {
    return res.status(400).json({ message: "new_password is required" });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  // Must be self or admin
  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: "You can only change your own password" });
  }

  // Self-service requires current_password
  if (isSelf && !current_password) {
    return res.status(400).json({ message: "current_password is required when changing your own password" });
  }

  // Get target user's current password
  db.query("SELECT password_hash FROM `user` WHERE user_id = ?", [targetId], (err2, targetRows) => {
    if (err2) {
      console.error('changePassword verify Error:', err2);
      return res.status(500).json({ message: "Error verifying password" });
    }
    if (!targetRows || targetRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Self-service: verify current password with bcrypt
    const doUpdate = () => {
      bcrypt.hash(new_password, SALT_ROUNDS, (hashErr, hashed) => {
        if (hashErr) {
          console.error('changePassword hash Error:', hashErr);
          return res.status(500).json({ message: "Error updating password" });
        }

        db.query("UPDATE `user` SET password_hash = ? WHERE user_id = ?", [hashed, targetId], (updateErr) => {
          if (updateErr) {
            console.error('changePassword update Error:', updateErr);
            return res.status(500).json({ message: "Error updating password" });
          }
          res.status(200).json({ message: "Password changed successfully" });
        });
      });
    };

    if (isSelf) {
      bcrypt.compare(current_password, targetRows[0].password_hash, (compareErr, match) => {
        if (compareErr) {
          console.error('changePassword compare Error:', compareErr);
          return res.status(500).json({ message: "Error verifying password" });
        }
        if (!match) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
        doUpdate();
      });
    } else {
      doUpdate();
    }
  });
};

// Update own profile (self-service, limited fields)
// PUT /api/users/:id/profile
exports.updateProfile = (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    department_id: bodyDepartmentId,
    departmentId,
    program,
    program_id: bodyProgramId,
    programId,
    year_level
  } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ message: "full_name is required" });
  }

  // Get user's role to determine which profile table to update
  db.query("SELECT role_id FROM `user` WHERE user_id = ?", [id], (err, results) => {
    if (err) {
      console.error('updateProfile fetch Error:', err);
      return res.status(500).json({ message: "Error fetching user" });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const roleId = results[0].role_id;

    if (roleId === 2) {
      // Faculty
      const resolvedDepartmentId = bodyDepartmentId ?? departmentId;
      let departmentValue = null;
      if (resolvedDepartmentId !== undefined && resolvedDepartmentId !== null && resolvedDepartmentId !== '') {
        const parsed = Number(resolvedDepartmentId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return res.status(400).json({ message: "department_id must be a positive integer" });
        }
        departmentValue = parsed;
      } else if (resolvedDepartmentId === null || resolvedDepartmentId === '') {
        departmentValue = null;
      }

      const sql = "UPDATE faculty_profile SET full_name = ?, department_id = ? WHERE faculty_id = ?";
      db.query(sql, [full_name.trim(), departmentValue, id], (updateErr) => {
        if (updateErr) {
          console.error('updateProfile faculty Error:', updateErr);
          return res.status(500).json({ message: "Error updating profile" });
        }
        res.status(200).json({ message: "Profile updated successfully" });
      });
    } else if (roleId === 3) {
      // Student
      const hasProgramField = Object.prototype.hasOwnProperty.call(req.body, 'program_id')
        || Object.prototype.hasOwnProperty.call(req.body, 'programId');

      const finalizeStudentProfile = (programUpdate) => {
        const sql = "UPDATE student_profile SET full_name = ?, program_id = ?, year_level = ? WHERE student_id = ?";
        const params = [
          full_name.trim(),
          programUpdate ? programUpdate.program_id : null,
          year_level || null,
          id
        ];

        db.query(sql, params, (updateErr) => {
          if (updateErr) {
            console.error('updateProfile student Error:', updateErr);
            return res.status(500).json({ message: "Error updating profile" });
          }
          res.status(200).json({ message: "Profile updated successfully" });
        });
      };

      if (!hasProgramField) {
        return finalizeStudentProfile(undefined);
      }

      const resolvedProgramIdInput = hasValue(bodyProgramId) ? bodyProgramId : programId;
      if (!hasValue(resolvedProgramIdInput)) {
        return finalizeStudentProfile(null);
      }

      return resolveProgramRecord(
        db,
        { programId: resolvedProgramIdInput },
        (progErr, programRecord) => {
          if (progErr) {
            if (progErr.status) {
              return res.status(progErr.status).json({ message: progErr.message });
            }
            console.error('updateProfile program resolve Error:', progErr);
            return res.status(500).json({ message: 'Program lookup failed' });
          }

          finalizeStudentProfile({
            program_id: programRecord.program_id
          });
        }
      );
    } else if (roleId === 1) {
      // Admin
      const sql = "INSERT INTO admin_profile (admin_id, full_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE full_name = ?";
      db.query(sql, [id, full_name.trim(), full_name.trim()], (updateErr) => {
        if (updateErr) {
          console.error('updateProfile admin Error:', updateErr);
          return res.status(500).json({ message: "Error updating profile" });
        }
        res.status(200).json({ message: "Profile updated successfully" });
      });
    } else {
      res.status(200).json({ message: "Profile updated successfully" });
    }
  });
};

// POST /api/login
exports.login = (req, res) => {
  const { gmail, password } = req.body;

  if (!gmail || !password) {
    return res.status(400).json({ message: "Gmail and password required" });
  }

  const query = `
    SELECT 
      u.user_id,
      u.gmail,
      COALESCE(fp.full_name, sp.full_name, ap.full_name, u.gmail) AS full_name,
      u.password_hash,
      u.role_id,
      r.role_name,
      u.status_id
    FROM \`user\` u
    LEFT JOIN user_role r ON u.role_id = r.role_id
    LEFT JOIN faculty_profile fp ON u.user_id = fp.faculty_id
    LEFT JOIN student_profile sp ON u.user_id = sp.student_id
    LEFT JOIN admin_profile ap ON u.user_id = ap.admin_id
    WHERE u.gmail = ?
    LIMIT 1
  `;

  db.query(query, [gmail], (err, results) => {
    if (err) {
      console.error('login Error:', err);
      return res.status(500).json({
        message: "Login error"
      });
    }

    if (!results || results.length === 0) {
      return res.status(401).json({ message: "Invalid gmail or password" });
    }

    const user = results[0];

    // Block inactive accounts
    if (Number(user.status_id) !== 1) {
      return res.status(403).json({ message: "Account is not active" });
    }

    bcrypt.compare(password, user.password_hash, (compareErr, match) => {
      if (compareErr) {
        console.error('login compare Error:', compareErr);
        return res.status(500).json({ message: "Login error" });
      }

      if (!match) {
        return res.status(401).json({ message: "Invalid gmail or password" });
      }

      // Sign JWT token
      const tokenPayload = {
        user_id: user.user_id,
        role_id: user.role_id,
        role_name: user.role_name
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h'
      });

      // Success response
      return res.json({
        message: "Login successful",
        token,
        user: {
          user_id: user.user_id,
          gmail: user.gmail,
          full_name: user.full_name || '',
          role_id: user.role_id,
          role_name: user.role_name
        }
      });
    });
  });
};

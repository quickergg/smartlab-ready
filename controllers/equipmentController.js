const db = require('../config/db');
const tz = require('../config/timezone');

// Get all equipment with status
exports.getAllEquipment = (req, res) => {
  const query = `
    SELECT 
      e.equipment_id,
      e.equipment_name,
      e.total_qty,
      e.available_qty,
      e.borrowed_qty,
      e.damaged_qty,
      es.status_name,
      e.created_at,
      e.updated_at
    FROM equipment e
    JOIN equipment_status es ON e.status_id = es.status_id
    ORDER BY e.equipment_name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('getAllEquipment Error:', err);
      return res.status(500).json({
        message: 'Error retrieving equipment'
      });
    }
    res.status(200).json(results);
  });
};

// Get equipment by ID
exports.getEquipmentById = (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT 
      e.equipment_id,
      e.equipment_name,
      e.total_qty,
      e.available_qty,
      e.borrowed_qty,
      e.damaged_qty,
      e.status_id,
      es.status_name,
      e.created_at,
      e.updated_at
    FROM equipment e
    JOIN equipment_status es ON e.status_id = es.status_id
    WHERE e.equipment_id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('getEquipmentById Error:', err);
      return res.status(500).json({
        message: 'Error retrieving equipment'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: 'Equipment not found'
      });
    }

    res.status(200).json(results[0]);
  });
};

// Create new equipment
exports.createEquipment = (req, res) => {
  const { equipment_name, total_qty } = req.body;

  // Validate required fields
  if (!equipment_name || !total_qty) {
    return res.status(400).json({
      message: 'Equipment name and total quantity are required'
    });
  }

  // Validate quantities
  const total = parseInt(total_qty) || 0;

  if (total <= 0) {
    return res.status(400).json({
      message: 'Total quantity must be greater than 0'
    });
  }

  const query = `
    INSERT INTO equipment (equipment_name, total_qty, available_qty, borrowed_qty, damaged_qty, status_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  // When creating new equipment, set available_qty = total_qty, others = 0
  const values = [equipment_name, total, total, 0, 0, 1];

  db.query(query, values, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          message: 'Equipment name already exists'
        });
      }
      console.error('createEquipment Error:', err);
      return res.status(500).json({
        message: 'Error creating equipment'
      });
    }

    res.status(201).json({
      message: 'Equipment created successfully',
      equipment_id: result.insertId
    });
  });
};

// Update equipment
exports.updateEquipment = (req, res) => {
  const { id } = req.params;
  const { equipment_name, total_qty, damaged_qty } = req.body;

  if (!equipment_name || total_qty === undefined || total_qty === null) {
    return res.status(400).json({ message: 'Equipment name and total quantity are required' });
  }

  const total = parseInt(total_qty, 10);
  const incomingDamaged = damaged_qty === undefined ? null : parseInt(damaged_qty, 10);

  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ message: 'Total quantity must be a non-negative number' });
  }

  const getCurrentQuery = 'SELECT borrowed_qty, damaged_qty FROM equipment WHERE equipment_id = ?';

  db.query(getCurrentQuery, [id], (err, results) => {
    if (err) {
      console.error('updateEquipment Error:', err);
      return res.status(500).json({ message: 'Error retrieving current equipment' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    const current = results[0];
    const borrowedQty = current.borrowed_qty || 0;
    const baseDamaged = current.damaged_qty || 0;
    const nextDamaged = Number.isFinite(incomingDamaged) ? Math.max(0, incomingDamaged) : baseDamaged;

    const minimumTotal = borrowedQty + nextDamaged;
    if (total < minimumTotal) {
      return res.status(400).json({
        message: `Total quantity cannot be less than ${minimumTotal} (borrowed ${borrowedQty} + damaged ${nextDamaged})`
      });
    }

    const maxDamage = Math.max(0, total - borrowedQty);
    if (nextDamaged > maxDamage) {
      return res.status(400).json({
        message: `Damaged quantity cannot exceed ${maxDamage} given total ${total} and borrowed ${borrowedQty}`
      });
    }

    const newAvailableQty = Math.max(0, total - borrowedQty - nextDamaged);

    const updateQuery = `
      UPDATE equipment 
      SET equipment_name = ?, total_qty = ?, damaged_qty = ?, available_qty = ?
      WHERE equipment_id = ?
    `;

    const values = [equipment_name, total, nextDamaged, newAvailableQty, id];

    db.query(updateQuery, values, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            message: 'Equipment name already exists'
          });
        }
        console.error('updateEquipment Error:', err);
        return res.status(500).json({
          message: 'Error updating equipment'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Equipment not found'
        });
      }

      res.status(200).json({
        message: 'Equipment updated successfully'
      });
    });
  });
};

// Delete equipment
exports.deleteEquipment = (req, res) => {
  const { id } = req.params;

  // Check if equipment is referenced in borrow requests
  const checkQuery = 'SELECT COUNT(*) as count FROM borrow_request_item WHERE equipment_id = ?';
  
  db.query(checkQuery, [id], (err, results) => {
    if (err) {
      console.error('deleteEquipment check Error:', err);
      return res.status(500).json({
        message: 'Error checking equipment references'
      });
    }

    if (results[0].count > 0) {
      return res.status(400).json({
        message: 'Cannot delete equipment: it is referenced in borrow requests'
      });
    }

    // Delete the equipment
    const deleteQuery = 'DELETE FROM equipment WHERE equipment_id = ?';
    
    db.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error('deleteEquipment Error:', err);
      return res.status(500).json({
          message: 'Error deleting equipment'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Equipment not found'
        });
      }

      res.status(200).json({
        message: 'Equipment deleted successfully'
      });
    });
  });
};

// Get equipment availability for a specific date
// GET /api/equipment/availability?date=2026-02-25
// Returns all equipment with available_on_date calculated dynamically
exports.getEquipmentAvailabilityByDate = (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: 'date query parameter is required (YYYY-MM-DD)' });
  }

  // Validate date format using PH timezone
  const parsed = tz.parse(date);
  if (!parsed.isValid()) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const query = `
    SELECT
      e.equipment_id,
      e.equipment_name,
      e.total_qty,
      e.available_qty,
      e.damaged_qty,
      es.status_name,
      COALESCE(approved.reserved_qty, 0) AS reserved_qty,
      GREATEST(0, e.available_qty - COALESCE(approved.reserved_qty, 0)) AS available_on_date,
      COALESCE(pending.pending_qty, 0) AS pending_qty
    FROM equipment e
    JOIN equipment_status es ON e.status_id = es.status_id
    LEFT JOIN (
      SELECT bri.equipment_id, SUM(bri.quantity) AS reserved_qty
      FROM borrow_request_item bri
      JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
      WHERE br.date_needed = ? AND br.status_id IN (2, 6)
      GROUP BY bri.equipment_id
    ) approved ON approved.equipment_id = e.equipment_id
    LEFT JOIN (
      SELECT bri.equipment_id, SUM(bri.quantity) AS pending_qty
      FROM borrow_request_item bri
      JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
      WHERE br.date_needed = ? AND br.status_id = 1
      GROUP BY bri.equipment_id
    ) pending ON pending.equipment_id = e.equipment_id
    ORDER BY e.equipment_name
  `;

  db.query(query, [date, date], (err, results) => {
    if (err) {
      console.error('getEquipmentAvailabilityByDate Error:', err);
      return res.status(500).json({
        message: 'Error retrieving equipment availability'
      });
    }
    res.status(200).json(results);
  });
};

// Get equipment usage summary for a whole month
// GET /api/equipment/availability/month?year=2026&month=2
// Returns per-day totals: { date, reserved_items, reserved_qty, pending_items, pending_qty }
exports.getEquipmentAvailabilityByMonth = (req, res) => {
  const year = parseInt(req.query.year);
  const month = parseInt(req.query.month); // 1-12

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ message: 'year and month (1-12) query parameters are required' });
  }

  // Build first and last day of the month (PH timezone)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = tz.lastDayOfMonth(year, month);
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const query = `
    SELECT
      br.date_needed AS date,
      br.status_id,
      COUNT(DISTINCT bri.equipment_id) AS item_count,
      COALESCE(SUM(bri.quantity), 0) AS total_qty
    FROM borrow_request br
    JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    WHERE br.date_needed BETWEEN ? AND ?
      AND br.status_id IN (1, 2, 6)
    GROUP BY br.date_needed, br.status_id
    ORDER BY br.date_needed
  `;

  db.query(query, [startDate, endDate], (err, rows) => {
    if (err) {
      console.error('getEquipmentAvailabilityByMonth Error:', err);
      return res.status(500).json({
        message: 'Error retrieving monthly equipment availability'
      });
    }

    // Aggregate into per-date summary
    const byDate = {};
    rows.forEach(row => {
      const dateKey = tz.toDateStr(row.date);

      if (!byDate[dateKey]) {
        byDate[dateKey] = { date: dateKey, reserved_items: 0, reserved_qty: 0, pending_items: 0, pending_qty: 0 };
      }
      if (row.status_id === 2 || row.status_id === 6) {
        byDate[dateKey].reserved_items += row.item_count;
        byDate[dateKey].reserved_qty += row.total_qty;
      } else if (row.status_id === 1) {
        byDate[dateKey].pending_items = row.item_count;
        byDate[dateKey].pending_qty = row.total_qty;
      }
    });

    res.status(200).json(Object.values(byDate));
  });
};

// Get comprehensive equipment statistics for admin dashboard
// GET /api/equipment/stats
exports.getEquipmentStats = (req, res) => {
  const todayStr = tz.todayStr();
  const next7Str = tz.now().add(7, 'day').format('YYYY-MM-DD');

  // 1) Inventory overview
  const inventorySql = `
    SELECT
      COUNT(*) AS unique_items,
      COALESCE(SUM(total_qty), 0) AS total_qty,
      COALESCE(SUM(available_qty), 0) AS available_qty,
      COALESCE(SUM(borrowed_qty), 0) AS borrowed_qty,
      COALESCE(SUM(damaged_qty), 0) AS damaged_qty,
      SUM(CASE WHEN available_qty <= 1 AND total_qty > 1 THEN 1 ELSE 0 END) AS low_stock_count
    FROM equipment
  `;

  // 2) Reservations today (approved, date_needed = today)
  const todayResSql = `
    SELECT
      COUNT(DISTINCT bri.equipment_id) AS items_reserved,
      COALESCE(SUM(bri.quantity), 0) AS qty_reserved
    FROM borrow_request br
    JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    WHERE br.date_needed = ? AND br.status_id IN (2, 6)
  `;

  // 3) Pending requests count
  const pendingSql = `
    SELECT COUNT(*) AS pending_count
    FROM borrow_request
    WHERE status_id = 1
  `;

  // 4) Upcoming reservations (approved, next 7 days excluding today)
  const upcomingSql = `
    SELECT
      COUNT(DISTINCT br.borrow_request_id) AS upcoming_requests,
      COALESCE(SUM(bri.quantity), 0) AS upcoming_qty
    FROM borrow_request br
    JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    WHERE br.date_needed > ? AND br.date_needed <= ? AND br.status_id IN (2, 6)
  `;

  // 5) Overdue returns (approved/borrowed but date_needed < today, not returned)
  const overdueSql = `
    SELECT
      COUNT(DISTINCT br.borrow_request_id) AS overdue_requests,
      COALESCE(SUM(bri.quantity), 0) AS overdue_qty
    FROM borrow_request br
    JOIN borrow_request_item bri ON bri.borrow_request_id = br.borrow_request_id
    WHERE br.date_needed < ? AND br.status_id IN (2, 6)
  `;

  // 6) Most reserved equipment (top 5 by total approved reservation qty, all time)
  const topReservedSql = `
    SELECT
      e.equipment_name,
      e.equipment_id,
      COALESCE(SUM(bri.quantity), 0) AS total_reserved
    FROM borrow_request_item bri
    JOIN borrow_request br ON br.borrow_request_id = bri.borrow_request_id
    JOIN equipment e ON e.equipment_id = bri.equipment_id
    WHERE br.status_id IN (2, 5, 6)
    GROUP BY bri.equipment_id
    ORDER BY total_reserved DESC
    LIMIT 5
  `;

  // Execute all queries in parallel
  const results = {};
  let completed = 0;
  let hasError = false;
  const totalQueries = 6;

  const finish = () => {
    completed++;
    if (hasError || completed < totalQueries) return;

    const inv = results.inventory;
    const utilizationRate = inv.total_qty > 0
      ? Math.round(((inv.borrowed_qty + (results.todayRes?.qty_reserved || 0)) / inv.total_qty) * 100)
      : 0;

    res.status(200).json({
      inventory: {
        unique_items: inv.unique_items,
        total_qty: inv.total_qty,
        available_qty: inv.available_qty,
        borrowed_qty: inv.borrowed_qty,
        damaged_qty: inv.damaged_qty,
        low_stock_count: inv.low_stock_count,
        utilization_rate: Math.min(utilizationRate, 100)
      },
      today: {
        items_reserved: results.todayRes.items_reserved,
        qty_reserved: results.todayRes.qty_reserved
      },
      pending_requests: results.pending.pending_count,
      upcoming: {
        requests: results.upcoming.upcoming_requests,
        qty: results.upcoming.upcoming_qty
      },
      overdue: {
        requests: results.overdue.overdue_requests,
        qty: results.overdue.overdue_qty
      },
      most_reserved: results.topReserved
    });
  };

  const handleErr = (label, err) => {
    if (hasError) return;
    hasError = true;
    console.error(`getEquipmentStats [${label}] Error:`, err);
    res.status(500).json({ message: 'Error retrieving equipment stats' });
  };

  db.query(inventorySql, (err, rows) => {
    if (err) return handleErr('inventory', err);
    results.inventory = rows[0];
    finish();
  });

  db.query(todayResSql, [todayStr], (err, rows) => {
    if (err) return handleErr('todayRes', err);
    results.todayRes = rows[0];
    finish();
  });

  db.query(pendingSql, (err, rows) => {
    if (err) return handleErr('pending', err);
    results.pending = rows[0];
    finish();
  });

  db.query(upcomingSql, [todayStr, next7Str], (err, rows) => {
    if (err) return handleErr('upcoming', err);
    results.upcoming = rows[0];
    finish();
  });

  db.query(overdueSql, [todayStr], (err, rows) => {
    if (err) return handleErr('overdue', err);
    results.overdue = rows[0];
    finish();
  });

  db.query(topReservedSql, (err, rows) => {
    if (err) return handleErr('topReserved', err);
    results.topReserved = rows;
    finish();
  });
};

// Get equipment status options
exports.getEquipmentStatus = (req, res) => {
  const query = 'SELECT status_id, status_name FROM equipment_status ORDER BY status_name';

  db.query(query, (err, results) => {
    if (err) {
      console.error('getEquipmentStatus Error:', err);
      return res.status(500).json({
        message: 'Error retrieving equipment status options'
      });
    }
    res.status(200).json(results);
  });
};

const db = require('../config/db');

// =========================================
// GET /api/notifications
// Get notifications for the authenticated user
// Supports ?unread_only=true and ?limit=N
// =========================================
exports.getNotifications = (req, res) => {
  const userId = req.user.user_id;
  const unreadOnly = req.query.unread_only === 'true';
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

  let sql = `
    SELECT notification_id, type, title, message, reference_type, reference_id, is_read, created_at
    FROM notification
    WHERE user_id = ?
  `;
  const params = [userId];

  if (unreadOnly) {
    sql += ' AND is_read = FALSE';
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('getNotifications Error:', err);
      return res.status(500).json({ message: 'Error retrieving notifications' });
    }
    res.json(rows);
  });
};

// =========================================
// GET /api/notifications/unread-count
// Get the count of unread notifications
// =========================================
exports.getUnreadCount = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    'SELECT COUNT(*) AS count FROM notification WHERE user_id = ? AND is_read = FALSE',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('getUnreadCount Error:', err);
        return res.status(500).json({ message: 'Error retrieving unread count' });
      }
      res.json({ count: rows[0].count });
    }
  );
};

// =========================================
// PUT /api/notifications/:id/read
// Mark a single notification as read
// =========================================
exports.markAsRead = (req, res) => {
  const userId = req.user.user_id;
  const notificationId = Number(req.params.id);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: 'Invalid notification ID' });
  }

  db.query(
    'UPDATE notification SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
    [notificationId, userId],
    (err, result) => {
      if (err) {
        console.error('markAsRead Error:', err);
        return res.status(500).json({ message: 'Error marking notification as read' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
};

// =========================================
// PUT /api/notifications/read-all
// Mark all notifications as read for the user
// =========================================
exports.markAllAsRead = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    'UPDATE notification SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
    [userId],
    (err) => {
      if (err) {
        console.error('markAllAsRead Error:', err);
        return res.status(500).json({ message: 'Error marking notifications as read' });
      }
      res.json({ message: 'All notifications marked as read' });
    }
  );
};

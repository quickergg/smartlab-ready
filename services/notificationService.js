const db = require('../config/db');
const { sendEmail, buildNotificationEmail } = require('./emailService');

// =========================================
// Notification Service
// Creates in-app notifications + sends emails
// =========================================

/**
 * Create an in-app notification and optionally send an email.
 * @param {Object} opts
 * @param {number} opts.userId - Recipient user ID
 * @param {string} opts.type - Notification type (e.g. request_approved)
 * @param {string} opts.title - Short title
 * @param {string} opts.message - Full message
 * @param {string} [opts.referenceType] - e.g. borrow_request
 * @param {number} [opts.referenceId] - e.g. borrow_request_id
 * @param {boolean} [opts.sendEmailFlag=true] - Whether to also send email
 * @param {Object} [opts.emailData] - Extra data for rich email (location, date, equipment, reason, etc.)
 */
function createNotification(opts) {
  const {
    userId, type, title, message,
    referenceType = null, referenceId = null,
    sendEmailFlag = true, emailData = {}
  } = opts;

  const sql = `
    INSERT INTO notification (user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [userId, type, title, message, referenceType, referenceId], (err, result) => {
    if (err) {
      console.error('[NotificationService] DB insert error:', err.message);
      return;
    }

    const notificationId = result.insertId;

    // Send email in background (non-blocking)
    if (sendEmailFlag) {
      _sendNotificationEmail(userId, notificationId, title, message, { ...emailData, type });
    }
  });
}

/**
 * Fetch user email and send notification email, then mark email_sent.
 */
function _sendNotificationEmail(userId, notificationId, title, message, data = {}) {
  console.log(`[NotificationService] Preparing email for user ${userId}, notification #${notificationId}`);
  db.query('SELECT gmail FROM `user` WHERE user_id = ?', [userId], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      console.error('[NotificationService] Could not fetch user email for notification:', err?.message);
      return;
    }

    const email = rows[0].gmail;
    console.log(`[NotificationService] Sending email to: ${email}`);
    const html = buildNotificationEmail(title, message, data);

    sendEmail(email, `SmartLab: ${title}`, html)
      .then(sent => {
        console.log(`[NotificationService] Email send result for ${email}: ${sent}`);
        if (sent) {
          db.query('UPDATE notification SET email_sent = TRUE WHERE notification_id = ?', [notificationId], (updateErr) => {
            if (updateErr) console.error('[NotificationService] Failed to mark email_sent:', updateErr.message);
          });
        }
      })
      .catch(e => {
        console.error('[NotificationService] Email send error:', e.message);
      });
  });
}

/**
 * Notify all admins about an event.
 * @param {Object} opts - Same as createNotification but without userId
 */
function notifyAdmins(opts) {
  const sql = 'SELECT user_id FROM `user` WHERE role_id = 1 AND status_id = 1';
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('[NotificationService] Failed to fetch admins:', err.message);
      return;
    }
    rows.forEach(row => {
      createNotification({ ...opts, userId: row.user_id });
    });
  });
}

module.exports = { createNotification, notifyAdmins };

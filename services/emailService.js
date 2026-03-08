const nodemailer = require('nodemailer');

// =========================================
// Email Service for SmartLab Notifications
// Uses Nodemailer with configurable SMTP
// =========================================

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Only create transporter if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (process.env.SMTP_SECURE === 'true'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

/**
 * Send an email notification.
 * Silently fails if SMTP is not configured.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email HTML body
 * @returns {Promise<boolean>} true if sent, false otherwise
 */
async function sendEmail(to, subject, htmlBody) {
  const t = getTransporter();
  if (!t) {
    console.log('[EmailService] SMTP not configured, skipping email to:', to);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `"SmartLab" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlBody
    });
    console.log('[EmailService] Email sent to:', to);
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err.message);
    return false;
  }
}

// =========================================
// Email Template Helpers
// =========================================

function _esc(val) {
  return String(val ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return '-';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

function _formatTime(t) {
  if (!t) return '';
  const parts = String(t).split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function _sanitizeLabels(data = {}) {
  const normalize = (val) => typeof val === 'string' ? val.trim() : '';
  const withFallback = (primary, ...fallbacks) => {
    const candidates = [primary, ...fallbacks];
    for (const candidate of candidates) {
      const value = normalize(candidate);
      if (value) return value;
    }
    return '';
  };

  return {
    ...data,
    location: withFallback(data.location, data.room_label, data.roomName, data.lab_room_alias),
    subject: withFallback(data.subject, data.subject_label, data.subjectName, data.subject_code),
    program: withFallback(data.program, data.program_label, data.programName, data.program_code),
    requesterName: withFallback(data.requesterName, data.requester_name)
  };
}

/**
 * Status badge colors
 */
const STATUS_COLORS = {
  request_approved:  { bg: '#059669', label: 'APPROVED' },
  request_declined:  { bg: '#dc2626', label: 'DECLINED' },
  request_cancelled: { bg: '#6b7280', label: 'CANCELLED' },
  request_borrowed:  { bg: '#2563eb', label: 'BORROWED' },
  request_returned:  { bg: '#059669', label: 'RETURNED' },
  new_request:       { bg: '#d97706', label: 'NEW REQUEST' }
};

/**
 * Build a styled HTML email for a notification.
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} [data] - Extra data for rich emails
 * @param {string} [data.type] - Notification type
 * @param {string} [data.location] - Lab room
 * @param {string} [data.dateNeeded] - Date of use
 * @param {string} [data.timeStart] - Start time
 * @param {string} [data.timeEnd] - End time
 * @param {string} [data.subject] - Subject/course
 * @param {string} [data.program] - Program/section
 * @param {string} [data.yearLevel] - Year level
 * @param {string} [data.requesterName] - Name of requester (for admin emails)
 * @param {string} [data.reason] - Decline/cancel reason
 * @param {Array}  [data.equipment] - [{name, quantity}]
 * @returns {string} HTML email body
 */
function buildNotificationEmail(title, message, data = {}) {
  const safeData = _sanitizeLabels(data);
  const status = STATUS_COLORS[data.type] || null;

  // Build status badge
  const statusBadge = status ? `
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background: ${status.bg}; color: #fff; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">${status.label}</span>
    </div>` : '';

  // Build request details table
  let detailsTable = '';
  const hasDetails = safeData.location || safeData.dateNeeded || safeData.timeStart || safeData.subject;
  if (hasDetails) {
    const rows = [];
    if (safeData.requesterName) rows.push(['Requested By', _esc(safeData.requesterName)]);
    if (safeData.location) rows.push(['Laboratory', _esc(safeData.location)]);
    if (safeData.dateNeeded) rows.push(['Date Needed', _formatDate(safeData.dateNeeded)]);
    if (safeData.timeStart) {
      const timeRange = safeData.timeEnd
        ? `${_formatTime(safeData.timeStart)} – ${_formatTime(safeData.timeEnd)}`
        : _formatTime(safeData.timeStart);
      rows.push(['Time', timeRange]);
    }
    if (safeData.subject) rows.push(['Subject', _esc(safeData.subject)]);
    if (safeData.program) rows.push(['Program', _esc(safeData.program)]);
    if (safeData.yearLevel) rows.push(['Year Level', _esc(safeData.yearLevel)]);

    const rowsHtml = rows.map(([label, value]) => `
      <tr>
        <td style="padding: 8px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6; width: 130px; font-weight: 500;">${label}</td>
        <td style="padding: 8px 12px; color: #1f2937; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${value}</td>
      </tr>`).join('');

    detailsTable = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <tr><td colspan="2" style="padding: 10px 12px; background: #f3f4f6; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px;">Request Details</td></tr>
        ${rowsHtml}
      </table>`;
  }

  // Build equipment list
  let equipmentHtml = '';
  if (safeData.equipment && safeData.equipment.length > 0) {
    const eqRows = safeData.equipment.map(eq => `
      <tr>
        <td style="padding: 6px 12px; color: #1f2937; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${_esc(eq.name)}</td>
        <td style="padding: 6px 12px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6; text-align: center; width: 60px;">×${eq.quantity || 1}</td>
      </tr>`).join('');

    equipmentHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px; background: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <tr><td colspan="2" style="padding: 10px 12px; background: #f3f4f6; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px;">Equipment</td></tr>
        ${eqRows}
      </table>`;
  }

  // Decline reason box
  let reasonHtml = '';
  if (data.reason && data.type === 'request_declined') {
    reasonHtml = `
      <div style="margin: 16px 0; padding: 14px 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase;">Reason for Decline</p>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">${_esc(data.reason)}</p>
      </div>`;
  }

  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #800000, #5c0000); padding: 24px 28px;">
        <h1 style="color: #FFB81C; font-size: 18px; margin: 0; font-weight: 600;">SmartLab</h1>
        <p style="color: rgba(255,255,255,0.75); font-size: 12px; margin: 4px 0 0;">PUP Lopez &middot; Laboratory Management System</p>
      </div>
      <div style="padding: 28px;">
        ${statusBadge}
        <h2 style="color: #1f2937; font-size: 16px; margin: 0 0 8px; font-weight: 600;">${_esc(title)}</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${_esc(message)}</p>
        ${reasonHtml}
        ${detailsTable}
        ${equipmentHtml}
      </div>
      <div style="background: #f9fafb; padding: 16px 28px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">PUP Lopez Campus &middot; Bachelor of Science in Information Technology &middot; SmartLab Notification</p>
      </div>
    </div>
  `;
}

module.exports = { sendEmail, buildNotificationEmail };

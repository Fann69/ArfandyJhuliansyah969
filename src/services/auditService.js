/**
 * Audit Logging Service
 * Mencatat aktivitas autentikasi, akses data, dan upaya eksploitasi lab
 */

const db = require('../config/database');

async function logActivity({ userId = null, action, details, ipAddress = '127.0.0.1', userAgent = '', status = 'success', mode = 'secure' }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, status, mode) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, details, ipAddress, userAgent, status, mode]
    );
  } catch (err) {
    console.error('[AUDIT_LOG_ERROR]', err.message);
  }
}

async function getRecentLogs(limit = 50) {
  return await db.query(
    `SELECT a.*, u.username, u.role, u.full_name 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ORDER BY a.created_at DESC 
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  logActivity,
  getRecentLogs
};

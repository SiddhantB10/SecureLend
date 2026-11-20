const AdminAuditLog = require('../database/models/admin/AdminAuditLog');

/**
 * Record an administrative action (login, loan approval/rejection, ...).
 * Logging must never break the main request, so failures are only reported to the console.
 */
const logAdminAction = async ({ adminId, action, entityType, entityId, notes = '', metadata = {} }) => {
  try {
    await AdminAuditLog.create({
      adminUserId: adminId,
      action,
      entityType,
      entityId: String(entityId),
      notes,
      metadata,
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = { logAdminAction };

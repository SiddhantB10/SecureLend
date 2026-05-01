const User = require('./users/User');
const Loan = require('./loans/Loan');
const AdminAccount = require('./admin/AdminAccount');
const AdminProfile = require('./admin/AdminProfile');
const AdminAuditLog = require('./admin/AdminAuditLog');

module.exports = {
  User,
  Loan,
  AdminAccount,
  AdminProfile,
  AdminAuditLog,
};

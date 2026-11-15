const { User, Loan, AdminAccount, AdminProfile, AdminAuditLog } = require('./models');
const OtpSession = require('./models/users/OtpSession');

let ensured = false;

const ensureIndexes = async () => {
  if (ensured) {
    return;
  }

  await Promise.all([
    User.createIndexes(),
    Loan.createIndexes(),
    AdminAccount.createIndexes(),
    AdminProfile.createIndexes(),
    AdminAuditLog.createIndexes(),
    OtpSession.createIndexes(),
  ]);

  ensured = true;
};

module.exports = ensureIndexes;

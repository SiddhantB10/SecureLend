require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const connectDatabase = require('../config/db');
const User = require('../models/User');
const AdminAccount = require('../database/models/admin/AdminAccount');

const requireEnv = (key) => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required for admin migration`);
  }
  return value;
};

const migrateAdminToAdmins = async () => {
  const adminEmail = requireEnv('ADMIN_EMAIL').toLowerCase();
  const adminName = requireEnv('ADMIN_NAME');
  const adminPassword = requireEnv('ADMIN_PASSWORD');
  const adminPhone = requireEnv('ADMIN_PHONE');

  process.env.DISABLE_DB_FALLBACK = 'true';
  await connectDatabase();

  const adminHash = await bcrypt.hash(adminPassword, 12);
  await AdminAccount.findOneAndUpdate(
    { email: adminEmail },
    {
      name: adminName,
      email: adminEmail,
      password: adminHash,
      phone: adminPhone,
      role: 'admin',
      designation: 'Platform Administrator',
      active: true,
      permissions: ['loan:review', 'loan:approve', 'loan:reject', 'admin:manage'],
    },
    { upsert: true, new: true }
  );

  await User.deleteOne({ email: adminEmail });

  console.log(`Admin migrated to admins collection: ${adminEmail}`);
  process.exit(0);
};

migrateAdminToAdmins().catch((error) => {
  console.error('Admin migration failed:', error.message);
  process.exit(1);
});

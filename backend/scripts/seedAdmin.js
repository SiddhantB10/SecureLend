require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const connectDatabase = require('../config/db');
const User = require('../models/User');
const AdminAccount = require('../database/models/admin/AdminAccount');

const requireEnv = (key) => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required for admin seeding`);
  }
  return value;
};

const seedAdmin = async () => {
  const adminName = requireEnv('ADMIN_NAME');
  const adminEmail = requireEnv('ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('ADMIN_PASSWORD');
  const adminPhone = requireEnv('ADMIN_PHONE');

  // Require a real configured MongoDB for seeding to avoid creating the admin
  // in the ephemeral in-memory fallback. Set DISABLE_DB_FALLBACK=true to fail
  // fast when the configured DB is unreachable.
  process.env.DISABLE_DB_FALLBACK = 'true';
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Aborting admin seed: unable to connect to configured MongoDB.');
    console.error('Check your MONGODB_URI and network connectivity.');
    console.error('Error:', err.message);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await AdminAccount.findOneAndUpdate(
    { email: adminEmail.toLowerCase() },
    {
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: passwordHash,
      phone: adminPhone,
      role: 'admin',
      designation: 'Platform Administrator',
      active: true,
      permissions: ['loan:review', 'loan:approve', 'loan:reject', 'admin:manage'],
    },
    { upsert: true, new: true }
  );

  await User.deleteOne({ email: adminEmail.toLowerCase() });

  console.log(`Admin account ready: ${adminEmail}`);
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error('Failed to seed admin:', error.message);
  process.exit(1);
});

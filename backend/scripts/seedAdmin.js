require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDatabase = require('../config/db');
const User = require('../models/User');

const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'SecureLend Admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@securelend.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const adminPhone = process.env.ADMIN_PHONE || '+10000000000';

  await connectDatabase();

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await User.findOneAndUpdate(
    { email: adminEmail.toLowerCase() },
    {
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: passwordHash,
      phone: adminPhone,
      role: 'admin',
    },
    { upsert: true, new: true }
  );

  console.log(`Admin account ready: ${adminEmail}`);
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error('Failed to seed admin:', error.message);
  process.exit(1);
});

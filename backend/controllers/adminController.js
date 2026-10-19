const bcrypt = require('bcryptjs');
const AdminAccount = require('../database/models/admin/AdminAccount');
const User = require('../models/User');

const requireEnv = (key) => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

exports.setupAdmin = async (req, res) => {
  const secret = req.headers['x-admin-setup-secret'] || req.get('x-admin-setup-secret');

  if (!process.env.ADMIN_SETUP_SECRET) {
    return res.status(403).json({ message: 'Admin setup is disabled on this server' });
  }

  if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
    return res.status(403).json({ message: 'Invalid admin setup secret' });
  }

  try {
    const adminName = requireEnv('ADMIN_NAME');
    const adminEmail = requireEnv('ADMIN_EMAIL').toLowerCase();
    const adminPassword = requireEnv('ADMIN_PASSWORD');
    const adminPhone = requireEnv('ADMIN_PHONE');

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await AdminAccount.findOneAndUpdate(
      { email: adminEmail },
      {
        name: adminName,
        email: adminEmail,
        password: passwordHash,
        phone: adminPhone,
        role: 'admin',
        designation: 'Platform Administrator',
        active: true,
        permissions: ['loan:review', 'loan:approve', 'loan:reject', 'admin:manage'],
      },
      { upsert: true, new: true }
    );

    await User.deleteOne({ email: adminEmail });

    return res.json({ message: 'Admin account created/updated', email: admin.email });
  } catch (error) {
    console.error('Admin setup failed:', error.message);
    return res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
};

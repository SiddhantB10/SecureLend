const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.setupAdmin = async (req, res) => {
  const secret = req.headers['x-admin-setup-secret'] || req.get('x-admin-setup-secret');

  if (!process.env.ADMIN_SETUP_SECRET) {
    return res.status(403).json({ message: 'Admin setup is disabled on this server' });
  }

  if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
    return res.status(403).json({ message: 'Invalid admin setup secret' });
  }

  try {
    const adminName = process.env.ADMIN_NAME || 'SecureLend Admin';
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@securelend.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
    const adminPhone = process.env.ADMIN_PHONE || '+10000000000';

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const user = await User.findOneAndUpdate(
      { email: adminEmail },
      {
        name: adminName,
        email: adminEmail,
        password: passwordHash,
        phone: adminPhone,
        role: 'admin',
      },
      { upsert: true, new: true }
    );

    return res.json({ message: 'Admin account created/updated', email: user.email });
  } catch (error) {
    console.error('Admin setup failed:', error.message);
    return res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
};

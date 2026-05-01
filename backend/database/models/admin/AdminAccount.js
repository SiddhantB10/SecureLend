const mongoose = require('mongoose');

const adminAccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
    designation: {
      type: String,
      default: 'Platform Administrator',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: ['loan:review', 'loan:approve', 'loan:reject', 'admin:manage'],
    },
  },
  {
    timestamps: true,
    collection: 'admins',
  }
);

module.exports = mongoose.models.AdminAccount || mongoose.model('AdminAccount', adminAccountSchema);

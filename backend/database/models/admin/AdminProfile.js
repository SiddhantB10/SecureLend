const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    designation: {
      type: String,
      default: 'Administrator',
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
    collection: 'admin_profiles',
  }
);

module.exports =
  mongoose.models.AdminProfile || mongoose.model('AdminProfile', adminProfileSchema);

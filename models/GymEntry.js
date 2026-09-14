const mongoose = require('mongoose');

const gymEntrySchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Member reference is required'],
  },
  token: {
    type: String,
    required: [true, 'Token is required'],
    trim: true,
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
  },
  used: {
    type: Boolean,
    default: false,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GymEntry', gymEntrySchema);

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
    },
    date: {
      type: Date,
      default: Date.now,
      required: [true, 'Date is required'],
    },
    entryTime: {
      type: String,
      default: () => new Date().toLocaleTimeString(),
    },
    status: {
      type: String,
      default: 'Present',
      trim: true,
    },
    method: {
      type: String,
      default: 'Manual',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Attendance', attendanceSchema);

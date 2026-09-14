const mongoose = require('mongoose');

const weightSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
    },
    weight: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [0, 'Weight cannot be negative'],
    },
    waist: {
      type: Number,
      min: 0,
      default: null,
    },
    chest: {
      type: Number,
      min: 0,
      default: null,
    },
    arms: {
      type: Number,
      min: 0,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Weight', weightSchema);

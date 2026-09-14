const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Membership name is required'],
      trim: true,
    },
    level: {
      type: String,
      enum: ['Normal', 'Pro', 'Pro+'],
      required: [true, 'Membership level is required'],
    },
    duration: {
      type: String,
      required: [true, 'Membership duration is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Membership price is required'],
      min: [0, 'Price cannot be negative'],
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Membership', membershipSchema);

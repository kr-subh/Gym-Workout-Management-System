const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      required: [true, 'Membership reference is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    method: {
      type: String,
      enum: {
        values: ['online', 'offline'],
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed', 'rejected'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
    },
    transactionId: {
      type: String,
      trim: true,
    },
    // Razorpay-specific fields (online payments only)
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    // Admin verification fields (offline payments)
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectedReason: {
      type: String,
      trim: true,
      default: '',
    },
    // Membership activation tracking
    membershipActivatedAt: {
      type: Date,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

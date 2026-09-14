const crypto     = require('crypto');
const Razorpay   = require('razorpay');
const Payment    = require('../models/Payment');
const User       = require('../models/User');
const Membership = require('../models/Membership');
const { parseDurationDays, calculateNewExpiry } = require('../utils/membershipHelper');

// Razorpay client instance
const getRazorpay = () => {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// Helper: Activate or renew membership for a member
const activateMembership = async (memberId, planId) => {
  const plan = await Membership.findById(planId);
  const durationDays = plan ? parseDurationDays(plan.duration) : 30;
  const now = new Date();

  const user = await User.findById(memberId);
  const currentExpiry = user ? user.membershipExpiresAt : null;
  const newExpiry = calculateNewExpiry(currentExpiry, durationDays, now);

  await User.findByIdAndUpdate(memberId, {
    membership: planId,
    membershipExpiresAt: newExpiry,
    membershipActivatedAt: now,
    isActive: true,
  });

  return newExpiry;
};

// ─── MEMBER PAYMENT FLOW ──────────────────────────────────────────

// GET /member/plans/pay/:planId — Show payment checkout options
const showPaymentOptions = async (req, res, next) => {
  try {
    const plan = await Membership.findById(req.params.planId);
    if (!plan) {
      return res.redirect('/member/plans?error=Plan not found');
    }

    res.render('member/payment', {
      title: 'Complete Payment',
      plan,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      memberName: req.session.name || 'Member',
      memberEmail: '',
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /member/payment/create-order — Create Razorpay order
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const memberId = req.session.userId;
    const plan = await Membership.findById(planId);

    if (!plan) {
      return res.json({ success: false, message: 'Plan not found.' });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return res.json({ success: false, message: 'Payment gateway not configured. Please contact admin.' });
    }

    const amountInPaise = Math.round(plan.price * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${memberId}_${Date.now()}`,
      notes: {
        memberId: memberId.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
      },
    };

    let order;
    try {
      order = await rzp.orders.create(options);
    } catch (rzpErr) {
      const isAuthError = rzpErr.statusCode === 401 || (rzpErr.error && rzpErr.error.code === 'BAD_REQUEST_ERROR' && rzpErr.error.description === 'Authentication failed');
      console.error('[Razorpay Order Error]:', rzpErr.statusCode || '', rzpErr.error || rzpErr.message);

      if (isAuthError) {
        return res.status(401).json({
          success: false,
          isAuthError: true,
          message: 'Razorpay authentication failed: Invalid RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env. Please update with active Razorpay Test Keys from your Razorpay Dashboard.',
        });
      }

      return res.status(rzpErr.statusCode || 500).json({
        success: false,
        message: `Failed to create Razorpay order: ${rzpErr.error?.description || rzpErr.message || 'Payment gateway error'}`,
      });
    }

    // Save pending payment record
    await Payment.create({
      member: memberId,
      membership: plan._id,
      amount: plan.price,
      method: 'online',
      status: 'pending',
      razorpayOrderId: order.id,
    });

    return res.json({
      success: true,
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
      planName: plan.name,
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create payment order. Please try again.' });
  }
};

// POST /member/payment/verify — Verify Razorpay HMAC signature on backend
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    const memberId = req.session.userId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.json({ success: false, message: 'Payment verification failed. Missing data.' });
    }

    // Server-side HMAC SHA256 signature verification
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: 'failed', razorpayPaymentId: razorpay_payment_id }
      );
      return res.json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
    }

    const now = new Date();
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        transactionId: razorpay_payment_id,
        membershipActivatedAt: now,
        paymentDate: now,
      }
    );

    const plan = await Membership.findById(planId);
    if (plan) {
      await activateMembership(memberId, plan._id);
      req.session.membership = {
        _id: plan._id,
        name: plan.name,
        level: plan.level,
        duration: plan.duration,
        price: plan.price,
        features: plan.features,
      };
    }

    return res.json({
      success: true,
      message: 'Payment verified and membership activated!',
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error('Payment verification error:', err.message);
    return res.status(500).json({ success: false, message: 'Payment verification failed. Please contact support.' });
  }
};

// POST /member/payment/fail — Record failed or cancelled Razorpay payment
const handlePaymentFailure = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, error_code, error_description } = req.body;
    const memberId = req.session.userId;

    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    const failureReason = error_description || error_code || 'Payment failed or cancelled by user';

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, member: memberId },
      {
        status: 'failed',
        razorpayPaymentId: razorpay_payment_id || undefined,
        rejectedReason: failureReason,
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: 'Payment failure recorded.',
      status: 'failed',
      paymentId: payment ? payment._id : null,
    });
  } catch (err) {
    console.error('Payment failure recording error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to record payment status.' });
  }
};

// POST /member/payment/offline — Create pending offline payment request
const createOfflinePayment = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const memberId = req.session.userId;
    const plan = await Membership.findById(planId);

    if (!plan) {
      return res.redirect('/member/plans?error=Plan not found');
    }

    await Payment.create({
      member: memberId,
      membership: plan._id,
      amount: plan.price,
      method: 'offline',
      status: 'pending',
      transactionId: `OFFLINE_${Date.now()}`,
    });

    return res.redirect(
      `/member/plans?success=Offline payment request submitted for ${plan.name} (₹${plan.price.toLocaleString('en-IN')}). Please pay at the gym reception. Your membership will be activated after admin verification.`
    );
  } catch (err) {
    next(err);
  }
};

// ─── ADMIN PAYMENT MANAGEMENT ─────────────────────────────────────

// GET /admin/payments — Admin payment dashboard
const getPaymentDashboard = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('member', 'name email phone')
      .populate('membership', 'name level price duration')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      totalRevenue: 0,
      onlineCount: 0,
      offlineCount: 0,
      pendingCount: 0,
    };

    payments.forEach((p) => {
      if (p.status === 'paid') stats.totalRevenue += p.amount || 0;
      if (p.method === 'online') stats.onlineCount++;
      if (p.method === 'offline') stats.offlineCount++;
      if (p.status === 'pending') stats.pendingCount++;
    });

    res.render('admin/payments', {
      title: 'Payment Management',
      payments,
      stats,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/payments/:id/verify — Verify offline payment and activate plan
const verifyOfflinePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.redirect('/admin/payments?error=Payment record not found');
    }

    if (payment.status === 'paid') {
      return res.redirect('/admin/payments?error=This payment is already verified and paid');
    }

    const now = new Date();
    payment.status = 'paid';
    payment.paymentDate = now;
    payment.verifiedBy = req.session.userId;
    payment.verifiedAt = now;
    await payment.save();

    await activateMembership(payment.member, payment.membership);

    return res.redirect('/admin/payments?success=Payment verified successfully! Membership activated.');
  } catch (err) {
    next(err);
  }
};

// POST /admin/payments/:id/reject — Reject offline payment
const rejectOfflinePayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.redirect('/admin/payments?error=Payment record not found');
    }

    payment.status = 'rejected';
    payment.rejectedReason = reason || 'Rejected by admin';
    payment.verifiedBy = req.session.userId;
    payment.verifiedAt = new Date();
    await payment.save();

    return res.redirect('/admin/payments?success=Payment marked as rejected');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  showPaymentOptions,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentFailure,
  createOfflinePayment,
  getPaymentDashboard,
  verifyOfflinePayment,
  rejectOfflinePayment,
};

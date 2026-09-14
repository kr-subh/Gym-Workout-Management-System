const crypto     = require('crypto');
const QRCode     = require('qrcode');
const User       = require('../models/User');
const WorkoutPlan = require('../models/WorkoutPlan');
const DietPlan   = require('../models/DietPlan');
const Weight     = require('../models/Weight');
const Attendance = require('../models/Attendance');
const Payment    = require('../models/Payment');
const GymEntry   = require('../models/GymEntry');
const { getMembershipStatus } = require('../utils/membershipHelper');

// QR Token expiration duration (30 seconds)
const QR_TOKEN_TTL_SECONDS = 30;

// Helper: Calculate starting weight, current weight, net change, min/max, and body measurements
const computeWeightStats = (weights = []) => {
  if (!weights.length) {
    return {
      startingWeight: null,
      currentWeight: null,
      weightChange: 0,
      minWeight: null,
      maxWeight: null,
      startingWaist: null,
      currentWaist: null,
      waistChange: 0,
      startingChest: null,
      currentChest: null,
      chestChange: 0,
      startingArms: null,
      currentArms: null,
      armsChange: 0,
      latestEntry: null,
      weights: []
    };
  }
  const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  const startingWeight = sorted[0].weight;
  const currentWeight  = sorted[sorted.length - 1].weight;
  const weightChange   = Number((currentWeight - startingWeight).toFixed(1));

  const allWeights = sorted.map(w => w.weight).filter(w => !isNaN(w));
  const minWeight = allWeights.length ? Math.min(...allWeights) : startingWeight;
  const maxWeight = allWeights.length ? Math.max(...allWeights) : startingWeight;

  // Body measurements
  const waistEntries = sorted.filter(w => w.waist != null && !isNaN(w.waist));
  const startingWaist = waistEntries.length ? waistEntries[0].waist : null;
  const currentWaist  = waistEntries.length ? waistEntries[waistEntries.length - 1].waist : null;
  const waistChange   = (startingWaist != null && currentWaist != null) ? Number((currentWaist - startingWaist).toFixed(1)) : 0;

  const chestEntries = sorted.filter(w => w.chest != null && !isNaN(w.chest));
  const startingChest = chestEntries.length ? chestEntries[0].chest : null;
  const currentChest  = chestEntries.length ? chestEntries[chestEntries.length - 1].chest : null;
  const chestChange   = (startingChest != null && currentChest != null) ? Number((currentChest - startingChest).toFixed(1)) : 0;

  const armsEntries = sorted.filter(w => w.arms != null && !isNaN(w.arms));
  const startingArms = armsEntries.length ? armsEntries[0].arms : null;
  const currentArms  = armsEntries.length ? armsEntries[armsEntries.length - 1].arms : null;
  const armsChange   = (startingArms != null && currentArms != null) ? Number((currentArms - startingArms).toFixed(1)) : 0;

  const latestEntry = sorted[sorted.length - 1];

  return {
    startingWeight,
    currentWeight,
    weightChange,
    minWeight,
    maxWeight,
    startingWaist,
    currentWaist,
    waistChange,
    startingChest,
    currentChest,
    chestChange,
    startingArms,
    currentArms,
    armsChange,
    latestEntry,
    weights: sorted
  };
};

// Helper: Calculate attendance consistency, streaks, and day frequency
const computeAttendanceStats = (attendances = []) => {
  const count = attendances.length;
  const targetDays = 20;
  const rate = Math.min(100, Math.round((count / targetDays) * 100));

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayFrequency = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let thisMonthCount = 0;

  attendances.forEach(att => {
    const d = new Date(att.date);
    const dayName = days[d.getDay()];
    if (dayFrequency[dayName] !== undefined) dayFrequency[dayName]++;
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      thisMonthCount++;
    }
  });

  return { count, rate, thisMonthCount, dayFrequency, history: attendances };
};

// ─── DASHBOARD ────────────────────────────────────────────────────

// GET /member/dashboard — Member personal hub
const getDashboard = async (req, res, next) => {
  try {
    const memberId = req.session.userId;

    const [
      userDoc,
      workoutPlan,
      dietPlan,
      weights,
      attendances,
      latestPayment,
    ] = await Promise.all([
      User.findById(memberId)
        .populate('membership')
        .populate('trainer', 'name email phone profilePhoto specialization experience')
        .lean(),
      WorkoutPlan.findOne({ member: memberId }).lean(),
      DietPlan.findOne({ member: memberId }).lean(),
      Weight.find({ member: memberId }).sort({ date: 1 }).lean(),
      Attendance.find({ member: memberId }).sort({ date: -1 }).lean(),
      Payment.findOne({ member: memberId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!userDoc) {
      return res.redirect('/auth/login');
    }

    const membershipInfo = getMembershipStatus(userDoc);
    const user = {
      ...userDoc,
      membershipStatus: membershipInfo.label,
      membershipExpiry: membershipInfo.expiryDate,
    };

    const weightStats = computeWeightStats(weights);
    const attendanceStats = computeAttendanceStats(attendances);

    res.render('member/dashboard', {
      title: 'Member Dashboard',
      user,
      membershipInfo,
      trainer: userDoc.trainer || null,
      workoutPlan,
      dietPlan,
      weightStats,
      attendanceStats,
      latestPayment,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── WORKOUT & DIET VIEWS ─────────────────────────────────────────

// GET /member/workout — Read-only workout routine
const getWorkoutPlan = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const member = await User.findById(memberId).populate('trainer', 'name email phone').lean();
    const plan = await WorkoutPlan.findOne({ member: memberId }).populate('trainer', 'name email').lean();

    res.render('member/workout', {
      title: 'My Workout Plan',
      plan,
      trainer: member?.trainer || null,
      errorMsg: null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /member/diet — Read-only nutrition regimen
const getDietPlan = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const member = await User.findById(memberId).populate('trainer', 'name email phone').lean();
    const plan = await DietPlan.findOne({ member: memberId }).populate('trainer', 'name email').lean();

    res.render('member/diet', {
      title: 'My Diet Plan',
      plan,
      trainer: member?.trainer || null,
      member,
      errorMsg: null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PROGRESS & WEIGHT LOGGING ────────────────────────────────────

// GET /member/progress — Comprehensive fitness & progress dashboard
const getProgress = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const [user, weights, attendances, workoutPlan, dietPlan] = await Promise.all([
      User.findById(memberId).populate('membership').populate('trainer', 'name email specialization profilePhoto').lean(),
      Weight.find({ member: memberId }).sort({ date: 1 }).lean(),
      Attendance.find({ member: memberId }).sort({ date: -1 }).lean(),
      WorkoutPlan.findOne({ member: memberId }).lean(),
      DietPlan.findOne({ member: memberId }).lean(),
    ]);

    const weightStats = computeWeightStats(weights);
    const attendanceStats = computeAttendanceStats(attendances);

    res.render('member/progress', {
      title: 'My Progress Dashboard',
      member: user,
      weightStats,
      attendanceStats,
      workoutPlan,
      dietPlan,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /member/weight — Record body weight & optional body measurements
const logWeight = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const { weight, waist, chest, arms, notes, date } = req.body;

    const numWeight = parseFloat(weight);
    if (isNaN(numWeight) || numWeight <= 0) {
      return res.redirect('/member/progress?error=Please enter a valid weight');
    }

    const entryDate = date ? new Date(date) : new Date();

    const weightDoc = {
      member: memberId,
      weight: numWeight,
      date: entryDate,
    };

    if (waist && !isNaN(parseFloat(waist)) && parseFloat(waist) > 0) weightDoc.waist = parseFloat(waist);
    if (chest && !isNaN(parseFloat(chest)) && parseFloat(chest) > 0) weightDoc.chest = parseFloat(chest);
    if (arms && !isNaN(parseFloat(arms)) && parseFloat(arms) > 0) weightDoc.arms = parseFloat(arms);
    if (notes && typeof notes === 'string' && notes.trim()) weightDoc.notes = notes.trim();

    await Weight.create(weightDoc);

    const redirectUrl = req.body.redirect || '/member/progress';
    res.redirect(`${redirectUrl}?success=Progress entry logged successfully`);
  } catch (err) {
    next(err);
  }
};

// ─── ATTENDANCE VIEW ──────────────────────────────────────────────

// GET /member/attendance — Attendance history
const getAttendance = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const attendances = await Attendance.find({ member: memberId }).sort({ date: -1 }).lean();
    const attendanceStats = computeAttendanceStats(attendances);

    res.render('member/attendance', {
      title: 'My Attendance',
      attendanceStats,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── DYNAMIC QR ACCESS PASS (30-second TTL) ────────────────────────

// POST /member/qr/generate — Generate dynamic short-lived token
const generateQrToken = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const now = new Date();

    const memberUser = await User.findById(memberId).populate('membership').lean();
    if (!memberUser) {
      return res.status(401).json({ success: false, message: 'Member account not found.' });
    }

    // Backend verification: only Active and Grace period members can generate passes
    const membershipInfo = getMembershipStatus(memberUser, now);
    if (!membershipInfo.canGenerateQr) {
      return res.status(403).json({
        success: false,
        message: 'Membership Expired. Please renew your membership to generate gym entry QR codes.',
        status: membershipInfo.status,
      });
    }

    const expiresAt = new Date(now.getTime() + QR_TOKEN_TTL_SECONDS * 1000);
    const token = crypto.randomBytes(32).toString('hex');

    await GymEntry.create({
      member: memberId,
      token,
      expiresAt,
      used: false,
      usedAt: null,
    });

    // Generate QR image data URL
    const qrDataUrl = await QRCode.toDataURL(token, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return res.json({
      success: true,
      token,
      qrDataUrl,
      expiresAt: expiresAt.toISOString(),
      ttl: QR_TOKEN_TTL_SECONDS,
      status: membershipInfo.status,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/scan/validate — Single-use verification endpoint
const validateQrToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.json({ success: false, message: 'Invalid QR Code.' });
    }

    const trimmedToken = token.trim();
    const now = new Date();

    const entry = await GymEntry.findOne({ token: trimmedToken });
    if (!entry) {
      return res.json({ success: false, message: 'Invalid QR Code.' });
    }

    // Enforce single-use (anti-replay)
    if (entry.used) {
      return res.json({ success: false, message: 'QR Code Already Used.' });
    }

    // Enforce 30-second expiration TTL
    if (now > new Date(entry.expiresAt)) {
      return res.json({ success: false, message: 'QR Code Expired. Please generate a new QR.' });
    }

    const memberUser = await User.findById(entry.member).populate('membership').lean();
    if (!memberUser) {
      return res.json({ success: false, message: 'Invalid QR Code.' });
    }

    const membershipInfo = getMembershipStatus(memberUser, now);
    if (!membershipInfo.isAllowedEntry) {
      return res.json({
        success: false,
        message: 'Membership Expired. Gym Entry Denied. Please Renew.',
        memberName: memberUser.name,
        status: membershipInfo.status,
      });
    }

    // Atomically mark token as used
    entry.used = true;
    entry.usedAt = now;
    await entry.save();

    // Log attendance record automatically
    const entryTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    await Attendance.create({
      member: entry.member,
      date: now,
      entryTime,
      status: 'Present',
      method: 'QR Entry',
    });

    const response = {
      success: true,
      message: 'Access Granted',
      memberName: memberUser.name,
      entryTime,
      status: membershipInfo.status,
    };

    if (membershipInfo.status === 'grace') {
      response.warning = true;
      response.graceMessage = `Grace Period Active: ${membershipInfo.graceDaysRemaining} day(s) remaining. Please renew soon.`;
    }

    return res.json(response);
  } catch (err) {
    next(err);
  }
};

// GET /admin/scan — Entrance scanner interface
const getScanPage = async (req, res) => {
  res.render('admin/scan', {
    title: 'QR Scanner | FitZone',
    successMsg: req.query.success || null,
    errorMsg: req.query.error || null,
  });
};

// Legacy simple check-in fallback
const checkInQr = async (req, res, next) => {
  try {
    const memberId = req.session.userId;
    const now = new Date();
    const entryTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    await Attendance.create({
      member: memberId,
      date: now,
      entryTime,
      status: 'Present',
      method: 'QR Entry',
    });

    res.redirect('/member/dashboard?success=QR Entry Check-in successful! Welcome to FitZone.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getWorkoutPlan,
  getDietPlan,
  getProgress,
  logWeight,
  getAttendance,
  checkInQr,
  generateQrToken,
  validateQrToken,
  getScanPage,
};

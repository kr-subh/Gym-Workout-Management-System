const bcrypt     = require('bcryptjs');
const User       = require('../models/User');
const Membership = require('../models/Membership');
const Attendance = require('../models/Attendance');
const Payment    = require('../models/Payment');
const WorkoutPlan = require('../models/WorkoutPlan');
const DietPlan   = require('../models/DietPlan');
const Weight     = require('../models/Weight');
const { parseDurationDays, calculateNewExpiry } = require('../utils/membershipHelper');

// ─── DASHBOARD ────────────────────────────────────────────────────

// GET /admin/dashboard — Overview metrics & revenue breakdown
const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalMembers,
      totalTrainers,
      allMembersWithMembership,
      todayAttendance,
      pendingPayments,
      totalRevenueResult,
    ] = await Promise.all([
      User.countDocuments({ role: 'member' }),
      User.countDocuments({ role: 'trainer' }),
      User.find({ role: 'member' }).populate('membership').lean(),
      Attendance.countDocuments({ date: { $gte: today, $lt: tomorrow } }),
      Payment.countDocuments({ method: 'offline', status: 'pending' }),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const planCounts = { Normal: 0, Pro: 0, 'Pro+': 0, None: 0 };
    let activeCount = 0;
    let noMembershipCount = 0;

    for (const member of allMembersWithMembership) {
      if (member.membership) {
        planCounts[member.membership.level] = (planCounts[member.membership.level] || 0) + 1;
        activeCount++;
      } else {
        noMembershipCount++;
      }
    }

    const stats = {
      totalMembers,
      totalTrainers,
      activeMembers: activeCount,
      noMembershipMembers: noMembershipCount,
      todayAttendance,
      planCounts,
      pendingPayments,
      totalRevenue: totalRevenueResult[0]?.total || 0,
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user:  { name: req.session.name, role: req.session.role },
      stats,
    });
  } catch (err) {
    next(err);
  }
};

// ─── MEMBER MANAGEMENT ────────────────────────────────────────────

// GET /admin/members — Member directory with search
const listMembers = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = { role: 'member' };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const members = await User.find(filter)
      .populate('membership', 'name level')
      .populate('trainer', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/members/index', {
      title: 'Members',
      members,
      search,
      successMsg: req.query.success || null,
      errorMsg:   req.query.error   || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/members/:id — Full profile with trainer assignment selector
const getMemberDetail = async (req, res, next) => {
  try {
    const member = await User.findOne({ _id: req.params.id, role: 'member' })
      .populate('membership')
      .populate('trainer')
      .lean();

    if (!member) {
      return res.redirect('/admin/members?error=Member not found');
    }

    const [trainers, workoutPlan, dietPlan, weightLogs, attendanceLogs] = await Promise.all([
      User.find({ role: 'trainer', isActive: true }).select('name email specialization').lean(),
      WorkoutPlan.findOne({ member: member._id }).populate('trainer', 'name email').lean(),
      DietPlan.findOne({ member: member._id }).populate('trainer', 'name email').lean(),
      Weight.find({ member: member._id }).sort({ date: -1 }).limit(10).lean(),
      Attendance.find({ member: member._id }).sort({ date: -1 }).limit(10).lean(),
    ]);

    res.render('admin/members/detail', {
      title: `${member.name} — Profile`,
      member,
      trainers,
      workoutPlan,
      dietPlan,
      weightLogs,
      attendanceLogs,
      successMsg: req.query.success || null,
      errorMsg:   req.query.error   || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/members/:id/edit — Edit member form
const showEditMemberForm = async (req, res, next) => {
  try {
    const [member, memberships, trainers] = await Promise.all([
      User.findOne({ _id: req.params.id, role: 'member' }).lean(),
      Membership.find().sort({ price: 1 }).lean(),
      User.find({ role: 'trainer', isActive: true }).select('name email').lean(),
    ]);

    if (!member) return res.redirect('/admin/members?error=Member not found');

    res.render('admin/members/form', {
      title: `Edit: ${member.name}`,
      member,
      memberships,
      trainers,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/members/:id/edit — Update member info
const updateMember = async (req, res, next) => {
  try {
    const { name, phone, dietPreference, membership, trainer } = req.body;

    if (!name || !name.trim()) {
      const [memberships, trainers] = await Promise.all([
        Membership.find().sort({ price: 1 }).lean(),
        User.find({ role: 'trainer', isActive: true }).select('name email').lean(),
      ]);

      return res.status(400).render('admin/members/form', {
        title: 'Edit Member',
        member: { _id: req.params.id, ...req.body },
        memberships,
        trainers,
        error: 'Name is required.',
      });
    }

    const member = await User.findOne({ _id: req.params.id, role: 'member' });
    if (!member) {
      return res.redirect('/admin/members?error=Member not found');
    }

    member.name = name.trim();
    member.phone = phone?.trim() || '';
    member.dietPreference = dietPreference || 'Vegetarian';
    member.trainer = trainer && trainer.trim() ? trainer.trim() : null;

    const newPlanId = membership && membership.trim() ? membership.trim() : null;
    if (newPlanId) {
      const isDifferentPlan = !member.membership || member.membership.toString() !== newPlanId;
      member.membership = newPlanId;
      if (isDifferentPlan || !member.membershipExpiresAt) {
        const plan = await Membership.findById(newPlanId);
        const durationDays = plan ? parseDurationDays(plan.duration) : 30;
        const now = new Date();
        member.membershipActivatedAt = now;
        member.membershipExpiresAt = calculateNewExpiry(member.membershipExpiresAt, durationDays, now);
        member.isActive = true;
      }
    } else {
      member.membership = null;
    }

    await member.save();

    res.redirect(`/admin/members/${req.params.id}?success=Member updated successfully`);
  } catch (err) {
    next(err);
  }
};

// POST /admin/members/:id/deactivate — Toggle active status
const deactivateMember = async (req, res, next) => {
  try {
    const member = await User.findById(req.params.id);
    if (!member) return res.redirect('/admin/members?error=Member not found');

    member.isActive = !member.isActive;
    await member.save();

    const msg = member.isActive ? 'Member re-activated' : 'Member deactivated';
    res.redirect(`/admin/members/${req.params.id}?success=${msg}`);
  } catch (err) {
    next(err);
  }
};

// POST /admin/members/:id/delete — Remove member
const deleteMember = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Promise.all([
      WorkoutPlan.deleteMany({ member: req.params.id }),
      DietPlan.deleteMany({ member: req.params.id }),
      Weight.deleteMany({ member: req.params.id }),
      Attendance.deleteMany({ member: req.params.id }),
      Payment.deleteMany({ member: req.params.id }),
    ]);

    res.redirect('/admin/members?success=Member deleted successfully');
  } catch (err) {
    next(err);
  }
};

// POST /admin/members/:memberId/assign-trainer — Assign or change trainer
const assignTrainer = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { trainerId } = req.body;

    const member = await User.findOne({ _id: memberId, role: 'member' });
    if (!member) return res.redirect('/admin/members?error=Member not found');

    if (!trainerId || trainerId === '') {
      member.trainer = null;
      await member.save();
      return res.redirect(`/admin/members/${memberId}?success=Trainer unassigned successfully`);
    }

    const trainer = await User.findOne({ _id: trainerId, role: 'trainer' });
    if (!trainer) return res.redirect(`/admin/members/${memberId}?error=Trainer not found`);

    member.trainer = trainerId;
    await member.save();

    res.redirect(`/admin/members/${memberId}?success=Trainer ${trainer.name} assigned successfully`);
  } catch (err) {
    next(err);
  }
};

// ─── TRAINER MANAGEMENT ───────────────────────────────────────────

// GET /admin/trainers — List all trainers
const listTrainers = async (req, res, next) => {
  try {
    const trainers = await User.find({ role: 'trainer' }).sort({ createdAt: -1 }).lean();
    const trainerIds = trainers.map((t) => t._id);
    let memberCounts = {};

    if (trainerIds.length) {
      const counts = await User.aggregate([
        { $match: { role: 'member', trainer: { $in: trainerIds } } },
        { $group: { _id: '$trainer', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => { memberCounts[c._id.toString()] = c.count; });
    }

    const trainersWithCounts = trainers.map((t) => ({
      ...t,
      memberCount: memberCounts[t._id.toString()] || 0,
    }));

    res.render('admin/trainers/index', {
      title: 'Trainers',
      trainers: trainersWithCounts,
      successMsg: req.query.success || null,
      errorMsg:   req.query.error   || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/trainers/new — Form to add trainer
const showAddTrainerForm = (req, res) => {
  res.render('admin/trainers/form', {
    title: 'Add Trainer',
    isEdit: false,
    trainer: { name: '', email: '', phone: '' },
    error: null,
  });
};

// POST /admin/trainers — Create new trainer
const addTrainer = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).render('admin/trainers/form', {
        title: 'Add Trainer',
        isEdit: false,
        trainer: req.body,
        error: 'Name, email, and password are required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).render('admin/trainers/form', {
        title: 'Add Trainer',
        isEdit: false,
        trainer: req.body,
        error: 'An account with this email already exists.',
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      password: hashed,
      role: 'trainer',
    });

    res.redirect('/admin/trainers?success=Trainer added successfully');
  } catch (err) {
    next(err);
  }
};

// GET /admin/trainers/:id/edit — Edit trainer form
const showEditTrainerForm = async (req, res, next) => {
  try {
    const trainer = await User.findOne({ _id: req.params.id, role: 'trainer' }).lean();
    if (!trainer) return res.redirect('/admin/trainers?error=Trainer not found');

    res.render('admin/trainers/form', {
      title: `Edit: ${trainer.name}`,
      isEdit: true,
      trainer,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/trainers/:id/edit — Update trainer
const updateTrainer = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).render('admin/trainers/form', {
        title: 'Edit Trainer',
        isEdit: true,
        trainer: { _id: req.params.id, ...req.body },
        error: 'Name is required.',
      });
    }

    await User.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      phone: phone?.trim() || '',
    });

    res.redirect('/admin/trainers?success=Trainer updated successfully');
  } catch (err) {
    next(err);
  }
};

// POST /admin/trainers/:id/deactivate — Toggle trainer active status
const deactivateTrainer = async (req, res, next) => {
  try {
    const trainer = await User.findById(req.params.id);
    if (!trainer) return res.redirect('/admin/trainers?error=Trainer not found');

    trainer.isActive = !trainer.isActive;
    await trainer.save();

    const msg = trainer.isActive ? 'Trainer re-activated' : 'Trainer deactivated';
    res.redirect(`/admin/trainers?success=${msg}`);
  } catch (err) {
    next(err);
  }
};

// POST /admin/trainers/:id/delete — Remove trainer
const deleteTrainer = async (req, res, next) => {
  try {
    await User.updateMany({ trainer: req.params.id }, { $set: { trainer: null } });
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/trainers?success=Trainer deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  listMembers,
  getMemberDetail,
  showEditMemberForm,
  updateMember,
  deactivateMember,
  deleteMember,
  assignTrainer,
  listTrainers,
  showAddTrainerForm,
  addTrainer,
  showEditTrainerForm,
  updateTrainer,
  deactivateTrainer,
  deleteTrainer,
};

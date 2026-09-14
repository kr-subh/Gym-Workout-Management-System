const Membership = require('../models/Membership');
const User       = require('../models/User');
const { FEATURE_LABELS } = require('../middleware/membershipMiddleware');

// Helper to parse features from comma or newline separated text
const parseFeatures = (input) => {
  if (Array.isArray(input)) return input.map((f) => f.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input
    .split(/\r?\n|,/)
    .map((f) => f.trim())
    .filter(Boolean);
};

// ─── ADMIN CONTROLLERS ────────────────────────────────────────────

// GET /admin/memberships — List all plans for admin
const listPlansAdmin = async (req, res, next) => {
  try {
    const plans = await Membership.find().sort({ price: 1 });
    res.render('admin/memberships/index', {
      title: 'Manage Memberships',
      plans,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/memberships/new — Show form to create a plan
const showCreatePlanForm = (req, res) => {
  res.render('admin/memberships/form', {
    title: 'Add Membership Plan',
    isEdit: false,
    plan: { name: '', level: 'Normal', duration: '', price: '', features: [] },
    error: null,
  });
};

// POST /admin/memberships — Create new membership plan
const createPlan = async (req, res, next) => {
  try {
    const { name, level, duration, price, features } = req.body;

    if (!name || !level || !duration || price === undefined || price === '') {
      return res.status(400).render('admin/memberships/form', {
        title: 'Add Membership Plan',
        isEdit: false,
        plan: { name, level, duration, price, features: parseFeatures(features) },
        error: 'Name, level, duration, and price are required.',
      });
    }

    await Membership.create({
      name: name.trim(),
      level,
      duration: duration.trim(),
      price: Number(price),
      features: parseFeatures(features),
    });

    res.redirect('/admin/memberships?success=Plan created successfully');
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).render('admin/memberships/form', {
        title: 'Add Membership Plan',
        isEdit: false,
        plan: req.body,
        error: Object.values(err.errors).map((e) => e.message).join(', '),
      });
    }
    next(err);
  }
};

// GET /admin/memberships/:id/edit — Show edit plan form
const showEditPlanForm = async (req, res, next) => {
  try {
    const plan = await Membership.findById(req.params.id);
    if (!plan) {
      return res.redirect('/admin/memberships?error=Membership plan not found');
    }
    res.render('admin/memberships/form', {
      title: `Edit Plan: ${plan.name}`,
      isEdit: true,
      plan,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/memberships/:id/edit — Update plan
const updatePlan = async (req, res, next) => {
  try {
    const { name, level, duration, price, features } = req.body;

    if (!name || !level || !duration || price === undefined || price === '') {
      return res.status(400).render('admin/memberships/form', {
        title: 'Edit Membership Plan',
        isEdit: true,
        plan: { _id: req.params.id, name, level, duration, price, features: parseFeatures(features) },
        error: 'Name, level, duration, and price are required.',
      });
    }

    await Membership.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        level,
        duration: duration.trim(),
        price: Number(price),
        features: parseFeatures(features),
      },
      { new: true, runValidators: true }
    );

    res.redirect('/admin/memberships?success=Plan updated successfully');
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).render('admin/memberships/form', {
        title: 'Edit Membership Plan',
        isEdit: true,
        plan: { _id: req.params.id, ...req.body },
        error: Object.values(err.errors).map((e) => e.message).join(', '),
      });
    }
    next(err);
  }
};

// POST /admin/memberships/:id/delete — Delete plan
const deletePlan = async (req, res, next) => {
  try {
    await Membership.findByIdAndDelete(req.params.id);
    await User.updateMany({ membership: req.params.id }, { $set: { membership: null } });
    res.redirect('/admin/memberships?success=Plan deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ─── MEMBER CONTROLLERS ───────────────────────────────────────────

// GET /member/plans — Member plan listing
const listPlansMember = async (req, res, next) => {
  try {
    const plans = await Membership.find().sort({ price: 1 });
    let currentMembership = null;

    const user = await User.findById(req.session.userId).populate('membership');
    if (user && user.membership) {
      currentMembership = user.membership;
    }

    res.render('member/plans', {
      title: 'Membership Plans',
      plans,
      currentMembership,
      successMsg: req.query.success || null,
      errorMsg: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /member/plans/select/:id — Redirects to payment checkout
const selectPlanMember = (req, res) => {
  res.redirect(`/member/plans/pay/${req.params.id}`);
};

// GET /member/features/:featureKey — Demo route to verify feature access
const demoFeature = async (req, res) => {
  const { featureKey } = req.params;
  res.render('member/feature-success', {
    title: 'Feature Unlocked',
    featureKey,
    featureLabel: FEATURE_LABELS[featureKey] || featureKey,
    membership: req.userMembership,
  });
};

module.exports = {
  listPlansAdmin,
  showCreatePlanForm,
  createPlan,
  showEditPlanForm,
  updatePlan,
  deletePlan,
  listPlansMember,
  selectPlanMember,
  demoFeature,
};

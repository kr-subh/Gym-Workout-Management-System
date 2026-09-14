const mongoose    = require('mongoose');
const User        = require('../models/User');
const WorkoutPlan = require('../models/WorkoutPlan');
const DietPlan    = require('../models/DietPlan');
const Weight      = require('../models/Weight');
const Attendance  = require('../models/Attendance');

// Helper: Ensure the requested member is assigned to this trainer
const getAssignedMember = async (trainerId, memberId) => {
  if (!mongoose.isValidObjectId(memberId)) return null;
  return User.findOne({ _id: memberId, role: 'member', trainer: trainerId })
    .populate('membership')
    .lean();
};

// ─── TRAINER DASHBOARD ────────────────────────────────────────────

// GET /trainer/dashboard — Trainer overview & assigned athletes
const getDashboard = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;

    const [trainer, members] = await Promise.all([
      User.findById(trainerId).select('name email phone').lean(),
      User.find({ role: 'member', trainer: trainerId })
        .populate('membership', 'name level')
        .select('name email phone dietPreference membership createdAt')
        .sort({ name: 1 })
        .lean(),
    ]);

    res.render('trainer/dashboard', {
      title: 'Trainer Dashboard',
      trainer: trainer || { name: req.session.name },
      members: members || [],
      memberCount: members ? members.length : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ─── WORKOUT PLANS (Scoped to Assigned Member) ───────────────────

// GET /trainer/members/:memberId/workout — View plan
const getMemberWorkoutPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s workout plans.',
      });
    }

    const plan = await WorkoutPlan.findOne({ member: memberId }).lean();

    res.render('trainer/workout/view', {
      title: `Workout Plan — ${member.name}`,
      member,
      plan,
      successMsg: req.query.success || null,
      errorMsg:   req.query.error   || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /trainer/members/:memberId/workout/new — Form
const showCreateWorkoutForm = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s workout plans.',
      });
    }

    const existing = await WorkoutPlan.findOne({ member: memberId });
    if (existing) {
      return res.redirect(`/trainer/members/${memberId}/workout/edit`);
    }

    res.render('trainer/workout/form', {
      title: `Create Workout Plan — ${member.name}`,
      member,
      plan: null,
      isEdit: false,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// Helper to parse workout routines from submitted form
const parseWorkoutBody = (body) => {
  const toArray = (v) => (Array.isArray(v) ? v : (v !== undefined && v !== null && v !== '') ? [v] : []);
  const schedule = (body.schedule || '').trim();
  const notes = (body.notes || '').trim();

  const exerciseNames = toArray(body.exerciseName);
  const sets = toArray(body.sets);
  const reps = toArray(body.reps);
  const days = toArray(body.day);
  const notesArr = toArray(body.exerciseNotes);

  const exercises = [];
  for (let i = 0; i < exerciseNames.length; i++) {
    const name = (exerciseNames[i] || '').trim();
    if (name) {
      exercises.push({
        exerciseName: name,
        sets: Number(sets[i]) || 3,
        reps: Number(reps[i]) || 10,
        day: (days[i] || '').trim(),
        notes: (notesArr[i] || '').trim(),
      });
    }
  }

  return {
    schedule,
    notes,
    exercises,
  };
};

// POST /trainer/members/:memberId/workout — Create plan
const createWorkoutPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s workout plans.',
      });
    }

    const { schedule, notes, exercises } = parseWorkoutBody(req.body);

    if (exercises.length === 0) {
      return res.render('trainer/workout/form', {
        title: `Create Workout Plan — ${member.name}`,
        member,
        plan: { schedule, notes, exercises },
        isEdit: false,
        error: 'Please add at least one exercise to the workout plan.',
      });
    }

    try {
      await WorkoutPlan.findOneAndUpdate(
        { member: memberId },
        {
          member: memberId,
          trainer: trainerId,
          schedule,
          notes,
          exercises,
          updatedAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (dbErr) {
      return res.render('trainer/workout/form', {
        title: `Create Workout Plan — ${member.name}`,
        member,
        plan: { schedule, notes, exercises },
        isEdit: false,
        error: dbErr.message || 'Failed to save workout plan. Please verify the exercises.',
      });
    }

    res.redirect(`/trainer/members/${memberId}/workout?success=Workout plan created successfully`);
  } catch (err) {
    next(err);
  }
};

// GET /trainer/members/:memberId/workout/edit — Edit form
const showEditWorkoutForm = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s workout plans.',
      });
    }

    const plan = await WorkoutPlan.findOne({ member: memberId }).lean();
    if (!plan) {
      return res.redirect(`/trainer/members/${memberId}/workout/new`);
    }

    res.render('trainer/workout/form', {
      title: `Edit Workout Plan — ${member.name}`,
      member,
      plan,
      isEdit: true,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /trainer/members/:memberId/workout/edit — Update plan
const updateWorkoutPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s workout plans.',
      });
    }

    const { schedule, notes, exercises } = parseWorkoutBody(req.body);

    if (exercises.length === 0) {
      return res.render('trainer/workout/form', {
        title: `Edit Workout Plan — ${member.name}`,
        member,
        plan: { schedule, notes, exercises, _id: req.body._id },
        isEdit: true,
        error: 'Please add at least one exercise to the workout plan.',
      });
    }

    try {
      await WorkoutPlan.findOneAndUpdate(
        { member: memberId },
        { trainer: trainerId, schedule, notes, exercises, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
    } catch (dbErr) {
      return res.render('trainer/workout/form', {
        title: `Edit Workout Plan — ${member.name}`,
        member,
        plan: { schedule, notes, exercises, _id: req.body._id },
        isEdit: true,
        error: dbErr.message || 'Failed to update workout plan. Please verify the exercises.',
      });
    }

    res.redirect(`/trainer/members/${memberId}/workout?success=Workout plan updated successfully`);
  } catch (err) {
    next(err);
  }
};

// POST /trainer/members/:memberId/workout/delete — Delete plan
const deleteWorkoutPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to delete this member\'s workout plans.',
      });
    }

    await WorkoutPlan.findOneAndDelete({ member: memberId });
    res.redirect(`/trainer/dashboard?success=Workout plan deleted for ${member.name}`);
  } catch (err) {
    next(err);
  }
};

// ─── DIET PLANS (Scoped to Assigned Member) ───────────────────────

// GET /trainer/members/:memberId/diet — View diet
const getMemberDietPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s diet plans.',
      });
    }

    const plan = await DietPlan.findOne({ member: memberId }).lean();

    res.render('trainer/diet/view', {
      title: `Diet Plan — ${member.name}`,
      member,
      plan,
      successMsg: req.query.success || null,
      errorMsg:   req.query.error   || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /trainer/members/:memberId/diet/new — Form
const showCreateDietForm = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s diet plans.',
      });
    }

    const existing = await DietPlan.findOne({ member: memberId });
    if (existing) {
      return res.redirect(`/trainer/members/${memberId}/diet/edit`);
    }

    res.render('trainer/diet/form', {
      title: `Create Diet Plan — ${member.name}`,
      member,
      plan: null,
      isEdit: false,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// Helper to parse diet plan body
const parseDietBody = (body) => {
  const toArray = (v) => (Array.isArray(v) ? v : (v !== undefined && v !== null && v !== '') ? [v] : []);
  const validPreferences = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'];
  const rawPreference = (body.dietPreference || '').trim();
  const dietPreference = validPreferences.includes(rawPreference) ? rawPreference : 'Vegetarian';
  const notes = (body.notes || '').trim();

  const mealTypes = toArray(body.mealType);
  const foods = toArray(body.food);
  const quantities = toArray(body.quantity);
  const timings = toArray(body.timing);
  const mealNotes = toArray(body.mealNotes);

  const meals = [];
  for (let i = 0; i < foods.length; i++) {
    const foodName = (foods[i] || '').trim();
    if (foodName) {
      meals.push({
        mealType: (mealTypes[i] || 'Breakfast').trim(),
        food: foodName,
        quantity: (quantities[i] || '').trim(),
        timing: (timings[i] || '').trim(),
        notes: (mealNotes[i] || '').trim(),
      });
    }
  }

  return {
    dietPreference,
    notes,
    meals,
  };
};

// POST /trainer/members/:memberId/diet — Create diet
const createDietPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s diet plans.',
      });
    }

    const { dietPreference, notes, meals } = parseDietBody(req.body);

    if (meals.length === 0) {
      return res.render('trainer/diet/form', {
        title: `Create Diet Plan — ${member.name}`,
        member,
        plan: { dietPreference, notes, meals },
        isEdit: false,
        error: 'Please add at least one meal item to the diet plan.',
      });
    }

    try {
      await DietPlan.findOneAndUpdate(
        { member: memberId },
        {
          member: memberId,
          trainer: trainerId,
          dietPreference,
          notes,
          meals,
          updatedAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (dbErr) {
      return res.render('trainer/diet/form', {
        title: `Create Diet Plan — ${member.name}`,
        member,
        plan: { dietPreference, notes, meals },
        isEdit: false,
        error: dbErr.message || 'Failed to save diet plan. Please check inputs.',
      });
    }

    res.redirect(`/trainer/members/${memberId}/diet?success=Diet plan created successfully`);
  } catch (err) {
    next(err);
  }
};

// GET /trainer/members/:memberId/diet/edit — Edit form
const showEditDietForm = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s diet plans.',
      });
    }

    const plan = await DietPlan.findOne({ member: memberId }).lean();
    if (!plan) {
      return res.redirect(`/trainer/members/${memberId}/diet/new`);
    }

    res.render('trainer/diet/form', {
      title: `Edit Diet Plan — ${member.name}`,
      member,
      plan,
      isEdit: true,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /trainer/members/:memberId/diet/edit — Update diet
const updateDietPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to manage this member\'s diet plans.',
      });
    }

    const { dietPreference, notes, meals } = parseDietBody(req.body);

    if (meals.length === 0) {
      return res.render('trainer/diet/form', {
        title: `Edit Diet Plan — ${member.name}`,
        member,
        plan: { dietPreference, notes, meals, _id: req.body._id },
        isEdit: true,
        error: 'Please add at least one meal item to the diet plan.',
      });
    }

    try {
      await DietPlan.findOneAndUpdate(
        { member: memberId },
        { trainer: trainerId, dietPreference, notes, meals, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
    } catch (dbErr) {
      return res.render('trainer/diet/form', {
        title: `Edit Diet Plan — ${member.name}`,
        member,
        plan: { dietPreference, notes, meals, _id: req.body._id },
        isEdit: true,
        error: dbErr.message || 'Failed to update diet plan. Please check inputs.',
      });
    }

    res.redirect(`/trainer/members/${memberId}/diet?success=Diet plan updated successfully`);
  } catch (err) {
    next(err);
  }
};

// POST /trainer/members/:memberId/diet/delete — Delete diet
const deleteDietPlan = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to delete this member\'s diet plans.',
      });
    }

    await DietPlan.findOneAndDelete({ member: memberId });
    res.redirect(`/trainer/dashboard?success=Diet plan deleted for ${member.name}`);
  } catch (err) {
    next(err);
  }
};

// ─── MEMBER PROGRESS (Trainer View) ───────────────────────────────

// GET /trainer/members/:memberId/progress — Inspect athlete progress
const getMemberProgress = async (req, res, next) => {
  try {
    const trainerId = req.session.userId;
    const memberId  = req.params.memberId;

    const member = await getAssignedMember(trainerId, memberId);
    if (!member) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorised to view this member\'s progress.',
      });
    }

    const [weights, attendances] = await Promise.all([
      Weight.find({ member: memberId }).sort({ date: 1 }).lean(),
      Attendance.find({ member: memberId }).sort({ date: -1 }).lean(),
    ]);

    let startingWeight = null;
    let currentWeight  = null;
    let weightChange   = 0;

    if (weights && weights.length > 0) {
      startingWeight = weights[0].weight;
      currentWeight  = weights[weights.length - 1].weight;
      weightChange   = Number((currentWeight - startingWeight).toFixed(1));
    }

    res.render('trainer/memberProgress', {
      title: `Progress — ${member.name}`,
      member,
      weightStats: {
        startingWeight,
        currentWeight,
        weightChange,
        weights: weights || [],
      },
      attendanceCount: attendances.length,
      attendanceHistory: attendances,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getMemberWorkoutPlan,
  showCreateWorkoutForm,
  createWorkoutPlan,
  showEditWorkoutForm,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  getMemberDietPlan,
  showCreateDietForm,
  createDietPlan,
  showEditDietForm,
  updateDietPlan,
  deleteDietPlan,
  getMemberProgress,
};

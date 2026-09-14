const Membership = require('../models/Membership');
const User = require('../models/User');

// GET / — Landing page
const getHome = async (req, res, next) => {
  try {
    const [plans, dbTrainers] = await Promise.all([
      Membership.find().sort({ price: 1 }).lean(),
      User.find({ role: 'trainer' })
        .select('name specialization experience profilePhoto')
        .lean(),
    ]);

    // Default trainer display cards if none registered yet
    const trainers = dbTrainers && dbTrainers.length > 0 ? dbTrainers : [
      { name: 'Coach Marcus', specialization: 'Strength & Hypertrophy', experience: '8+ Years' },
      { name: 'Coach Sarah', specialization: 'HIIT & Mobility Specialist', experience: '6+ Years' },
      { name: 'Coach David', specialization: 'Bodybuilding & Nutrition', experience: '10+ Years' },
    ];

    res.render('index', {
      title: 'FitZone — Build Your Stronger Self',
      plans: plans || [],
      trainers,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getHome };

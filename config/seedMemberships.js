const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Membership = require('../models/Membership');
const User = require('../models/User');

const DEFAULT_PLANS = [
  {
    name: 'Normal Fitness',
    level: 'Normal',
    duration: '1 Month',
    price: 1499,
    features: [
      'Basic profile',
      'QR gym entry',
      'Attendance',
      'Basic workout plan',
      'Weight logging',
    ],
  },
  {
    name: 'Pro Athlete',
    level: 'Pro',
    duration: '3 Months',
    price: 3499,
    features: [
      'Basic profile',
      'QR gym entry',
      'Attendance',
      'Basic workout plan',
      'Weight logging',
      'Personalized workout plan',
      'Workout history',
      'Weight progress chart',
      'Personalized diet plan',
    ],
  },
  {
    name: 'Pro+ Elite Performance',
    level: 'Pro+',
    duration: '6 Months',
    price: 6499,
    features: [
      'Basic profile',
      'QR gym entry',
      'Attendance',
      'Basic workout plan',
      'Weight logging',
      'Personalized workout plan',
      'Workout history',
      'Weight progress chart',
      'Personalized diet plan',
      'Advanced progress analytics',
      'Advanced diet plan',
      'Priority trainer support',
      'Advanced workout recommendations',
    ],
  },
];

const seedMemberships = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    const count = await Membership.countDocuments();
    if (count === 0) {
      await Membership.insertMany(DEFAULT_PLANS);
      console.log('✅ Default membership plans seeded (Normal, Pro, Pro+)');
    }

    // Seed default admin if not present
    const adminExists = await User.findOne({ email: 'admin@fitzone.com' });
    if (!adminExists) {
      const hashedAdminPassword = await bcrypt.hash('Admin@123', 10);
      await User.create({
        name: 'System Admin',
        email: 'admin@fitzone.com',
        password: hashedAdminPassword,
        role: 'admin',
        isActive: true,
      });
      console.log('✅ Default admin seeded (admin@fitzone.com)');
    }

    // Seed default member if not present, or ensure membershipExpiresAt is set
    const defaultPlan = await Membership.findOne({ level: 'Pro' });
    const now = new Date();
    const activeExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const memberExists = await User.findOne({ email: 'member@fitzone.com' });
    if (!memberExists) {
      const hashedMemberPassword = await bcrypt.hash('Member@123', 10);
      await User.create({
        name: 'Alex Member',
        email: 'member@fitzone.com',
        password: hashedMemberPassword,
        role: 'member',
        dietPreference: 'Vegetarian',
        membership: defaultPlan ? defaultPlan._id : null,
        membershipExpiresAt: activeExpiry,
        membershipActivatedAt: now,
        isActive: true,
      });
      console.log('✅ Default member seeded (member@fitzone.com)');
    } else if (!memberExists.membershipExpiresAt) {
      if (defaultPlan && !memberExists.membership) {
        memberExists.membership = defaultPlan._id;
      }
      memberExists.membershipExpiresAt = activeExpiry;
      memberExists.membershipActivatedAt = now;
      await memberExists.save();
    }

    // Seed default trainer if not present
    const trainerExists = await User.findOne({ email: 'trainer1@fitzone.com' });
    if (!trainerExists) {
      const hashedTrainerPassword = await bcrypt.hash('Trainer@123', 10);
      await User.create({
        name: 'Coach Marcus',
        email: 'trainer1@fitzone.com',
        password: hashedTrainerPassword,
        role: 'trainer',
        phone: '+91 98765 43210',
        specialization: 'Strength & Hypertrophy',
        experience: '8+ Years',
        isActive: true,
      });
      console.log('✅ Default trainer seeded (trainer1@fitzone.com)');
    }
  } catch (err) {
    console.error('Failed to seed default data:', err.message);
  }
};

module.exports = { seedMemberships };

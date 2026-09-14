const mongoose = require('mongoose');
const User = require('../models/User');

// Membership tier hierarchy (higher number = higher tier)
const TIER_LEVELS = {
  'Normal': 1,
  'Pro':    2,
  'Pro+':   3,
};

// Maps each feature key to the minimum tier required to access it
const FEATURE_TIERS = {
  // Normal tier features
  'basic_profile':                  'Normal',
  'qr_gym_entry':                   'Normal',
  'attendance':                     'Normal',
  'basic_workout_plan':             'Normal',
  'weight_logging':                 'Normal',

  // Pro tier features
  'personalized_workout_plan':      'Pro',
  'workout_history':                'Pro',
  'weight_progress_chart':          'Pro',
  'personalized_diet_plan':         'Pro',

  // Pro+ tier features
  'advanced_progress_analytics':         'Pro+',
  'advanced_diet_plan':                  'Pro+',
  'priority_trainer_support':            'Pro+',
  'advanced_workout_recommendations':    'Pro+',
};

// Human-readable labels for each feature key
const FEATURE_LABELS = {
  'basic_profile':                  'Basic Profile',
  'qr_gym_entry':                   'QR Gym Entry',
  'attendance':                     'Attendance Tracking',
  'basic_workout_plan':             'Basic Workout Plan',
  'weight_logging':                 'Weight Logging',
  'personalized_workout_plan':      'Personalized Workout Plan',
  'workout_history':                'Workout History',
  'weight_progress_chart':          'Weight Progress Chart',
  'personalized_diet_plan':         'Personalized Diet Plan',
  'advanced_progress_analytics':    'Advanced Progress Analytics',
  'advanced_diet_plan':             'Advanced Diet Plan',
  'priority_trainer_support':       'Priority Trainer Support',
  'advanced_workout_recommendations': 'Advanced Workout Recommendations',
};

/**
 * Middleware factory: checks if the logged-in member's plan meets the
 * minimum tier required for a given feature.
 *
 * Usage:
 *   router.get('/features/:featureKey', requireFeature(), controller.handler)
 *   router.get('/some-route', requireFeature('pro_feature'), controller.handler)
 *
 * If access is denied, renders member/feature-locked with an upgrade prompt.
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      // Use route param if no featureKey was passed directly
      const targetFeature = featureKey || req.params.featureKey;
      const requiredLevel = FEATURE_TIERS[targetFeature];

      // Unknown feature key — allow access
      if (!requiredLevel) {
        return next();
      }

      const requiredRank = TIER_LEVELS[requiredLevel] || 1;

      // Look up the member's current membership from the database
      let activeMembership = null;
      if (mongoose.connection.readyState === 1) {
        const user = await User.findById(req.session.userId).populate('membership');
        if (user && user.membership) {
          activeMembership = user.membership;
        }
      }

      const userLevel = activeMembership ? activeMembership.level : null;
      const userRank = userLevel ? (TIER_LEVELS[userLevel] || 0) : 0;

      // Member has sufficient tier — allow through
      if (userRank >= requiredRank) {
        req.userMembership = activeMembership;
        return next();
      }

      // Feature is locked — show upgrade page
      const lockMessage = 'Upgrade your membership to unlock this feature.';

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          error: lockMessage,
          feature: targetFeature,
          featureLabel: FEATURE_LABELS[targetFeature] || targetFeature,
          currentLevel: userLevel || 'None',
          requiredLevel,
        });
      }

      return res.status(403).render('member/feature-locked', {
        title: 'Upgrade Required',
        message: lockMessage,
        featureKey: targetFeature,
        featureLabel: FEATURE_LABELS[targetFeature] || targetFeature,
        currentLevel: userLevel || 'None',
        requiredLevel,
      });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  FEATURE_LABELS,
  requireFeature,
};

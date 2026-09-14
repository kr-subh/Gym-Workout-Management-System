const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  mealType: {
    type: String,
    required: [true, 'Meal type is required'],
    trim: true,
    alias: 'type',
  },
  food: {
    type: String,
    required: [true, 'Food item is required'],
    trim: true,
  },
  quantity: {
    type: String,
    trim: true,
  },
  timing: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
});

const dietPlanSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dietPreference: {
      type: String,
      enum: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'],
    },
    meals: [mealSchema],
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DietPlan', dietPlanSchema);

const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true,
    alias: 'name',
  },
  sets: {
    type: Number,
    required: [true, 'Sets are required'],
    min: [1, 'Sets must be at least 1'],
  },
  reps: {
    type: Number,
    required: [true, 'Reps are required'],
    min: [1, 'Reps must be at least 1'],
  },
  day: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
});

const workoutPlanSchema = new mongoose.Schema(
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
    exercises: [exerciseSchema],
    schedule: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);

const express          = require('express');
const router           = express.Router();
const { noCache, isAuthenticated, isTrainer } = require('../middleware/authMiddleware');
const trainerController = require('../controllers/trainerController');

router.use(noCache, isAuthenticated, isTrainer);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', trainerController.getDashboard);

// ─── Workout Plan Management (trainer-owned, member-scoped) ───────────────────
// View plan page for a specific member
router.get('/members/:memberId/workout',         trainerController.getMemberWorkoutPlan);
// Create plan
router.get('/members/:memberId/workout/new',      trainerController.showCreateWorkoutForm);
router.post('/members/:memberId/workout',         trainerController.createWorkoutPlan);
// Edit plan
router.get('/members/:memberId/workout/edit',     trainerController.showEditWorkoutForm);
router.post('/members/:memberId/workout/edit',    trainerController.updateWorkoutPlan);
// Delete plan
router.post('/members/:memberId/workout/delete',  trainerController.deleteWorkoutPlan);

// ─── Diet Plan Management (trainer-owned, member-scoped) ──────────────────────
// View diet plan for a specific member
router.get('/members/:memberId/diet',             trainerController.getMemberDietPlan);
// Create diet plan
router.get('/members/:memberId/diet/new',         trainerController.showCreateDietForm);
router.post('/members/:memberId/diet',            trainerController.createDietPlan);
// Edit diet plan
router.get('/members/:memberId/diet/edit',        trainerController.showEditDietForm);
router.post('/members/:memberId/diet/edit',       trainerController.updateDietPlan);
// Delete diet plan
router.post('/members/:memberId/diet/delete',     trainerController.deleteDietPlan);

// ─── Member Progress View (trainer-owned, member-scoped) ─────────────────────
router.get('/members/:memberId/progress',         trainerController.getMemberProgress);

module.exports = router;

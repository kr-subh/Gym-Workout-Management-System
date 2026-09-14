const express = require('express');
const router  = express.Router();
const { noCache, isAuthenticated, isAdmin } = require('../middleware/authMiddleware');
const membershipController = require('../controllers/membershipController');
const adminController      = require('../controllers/adminController');
const memberController     = require('../controllers/memberController');
const paymentController    = require('../controllers/paymentController');

// All admin routes require authentication + admin role
router.use(noCache, isAuthenticated, isAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ─── Member Management ────────────────────────────────────────────────────────
router.get('/members',                      adminController.listMembers);
router.get('/members/:id',                  adminController.getMemberDetail);
router.get('/members/:id/edit',             adminController.showEditMemberForm);
router.post('/members/:id/edit',            adminController.updateMember);
router.post('/members/:id/deactivate',      adminController.deactivateMember);
router.post('/members/:id/delete',          adminController.deleteMember);

// ─── Trainer Assignment ───────────────────────────────────────────────────────
router.post('/members/:memberId/assign-trainer', adminController.assignTrainer);

// ─── Trainer Management ───────────────────────────────────────────────────────
router.get('/trainers',                     adminController.listTrainers);
router.get('/trainers/new',                 adminController.showAddTrainerForm);
router.post('/trainers',                    adminController.addTrainer);
router.get('/trainers/:id/edit',            adminController.showEditTrainerForm);
router.post('/trainers/:id/edit',           adminController.updateTrainer);
router.post('/trainers/:id/deactivate',     adminController.deactivateTrainer);
router.post('/trainers/:id/delete',         adminController.deleteTrainer);

// ─── Membership Management CRUD ───────────────────────────────────────────────
router.get('/memberships',                  membershipController.listPlansAdmin);
router.get('/memberships/new',              membershipController.showCreatePlanForm);
router.post('/memberships',                 membershipController.createPlan);
router.get('/memberships/:id/edit',         membershipController.showEditPlanForm);
router.post('/memberships/:id/edit',        membershipController.updatePlan);
router.post('/memberships/:id/delete',      membershipController.deletePlan);

// ─── Payment Management ──────────────────────────────────────────────────────
router.get('/payments',                     paymentController.getPaymentDashboard);
router.post('/payments/:id/verify',         paymentController.verifyOfflinePayment);
router.post('/payments/:id/reject',         paymentController.rejectOfflinePayment);

// ─── QR Scanner (Gym Entrance Simulation) ─────────────────────────────────────
router.get('/scan',                         memberController.getScanPage);
router.post('/scan/validate',               memberController.validateQrToken);

module.exports = router;

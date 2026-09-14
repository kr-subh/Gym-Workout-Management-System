const express          = require('express');
const router           = express.Router();
const { noCache, isAuthenticated, isMember } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/membershipMiddleware');
const membershipController = require('../controllers/membershipController');
const memberController     = require('../controllers/memberController');
const paymentController    = require('../controllers/paymentController');

router.use(noCache, isAuthenticated, isMember);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', memberController.getDashboard);

// ─── Workout Plan (read-only) ─────────────────────────────────────────────────
router.get('/workout', memberController.getWorkoutPlan);

// ─── Diet Plan (read-only) ────────────────────────────────────────────────────
router.get('/diet', memberController.getDietPlan);

// ─── Progress & Weight Logging ────────────────────────────────────────────────
router.get('/progress',   memberController.getProgress);
router.post('/weight',    memberController.logWeight);

// ─── Attendance & QR Entry ────────────────────────────────────────────────────
router.get('/attendance', memberController.getAttendance);
router.post('/qr-entry',  memberController.checkInQr);

// ─── QR Token Generation (secure, short-lived) ───────────────────────────────
router.post('/qr/generate', memberController.generateQrToken);

// ─── Membership Plans ─────────────────────────────────────────────────────────
router.get('/plans',              membershipController.listPlansMember);
router.post('/plans/select/:id',  membershipController.selectPlanMember);

// ─── Payment ──────────────────────────────────────────────────────────────────
router.get('/plans/pay/:planId',      paymentController.showPaymentOptions);
router.post('/payment/create-order',  paymentController.createRazorpayOrder);
router.post('/payment/verify',        paymentController.verifyRazorpayPayment);
router.post('/payment/fail',          paymentController.handlePaymentFailure);
router.post('/payment/offline',       paymentController.createOfflinePayment);

// ─── Feature gate test ────────────────────────────────────────────────────────
router.get('/features/:featureKey', requireFeature(), membershipController.demoFeature);

module.exports = router;

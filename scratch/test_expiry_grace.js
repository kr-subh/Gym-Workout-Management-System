/**
 * Comprehensive Test Suite for Membership Expiry and Exact 3-Day Grace Period
 */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Membership = require('../models/Membership');
const GymEntry = require('../models/GymEntry');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const {
  GRACE_PERIOD_DAYS,
  parseDurationDays,
  getMembershipStatus,
  calculateNewExpiry,
} = require('../utils/membershipHelper');

const PORT = process.env.PORT || 5050;
const BASE_URL = `http://localhost:${PORT}`;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MEMBERSHIP EXPIRY & 3-DAY GRACE PERIOD: STRICT TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: Exact Date Boundary Unit Tests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- PART 1: Exact Date & Status Unit Tests ---');
  
  const baseExpiry = new Date('2026-09-15T12:00:00Z');
  const dummyPlan = { name: 'Pro Plan', duration: '1 Month' };

  // 1. Active Membership: 10 days before expiry
  {
    const testNow = new Date('2026-09-05T12:00:00Z');
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'active', '10 days before expiry -> status is active');
    assert(res.isAllowedEntry === true, 'Active status allows gym entry');
    assert(res.canGenerateQr === true, 'Active status allows QR generation');
    assert(res.daysLeft === 10, 'Active status has 10 daysLeft');
  }

  // 2. On Expiry Date (exact timestamp)
  {
    const testNow = new Date('2026-09-15T12:00:00Z');
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'active', 'Exact expiry timestamp -> status is active');
    assert(res.isAllowedEntry === true, 'On expiry date gym entry is allowed');
    assert(res.canGenerateQr === true, 'On expiry date QR generation is allowed');
    assert(res.daysLeft === 0, 'On expiry date daysLeft is 0');
  }

  // 3. Day 1 of Grace Period (12 hours past expiry)
  {
    const testNow = new Date('2026-09-16T00:00:00Z'); // 12h past expiry
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'grace', '12 hours past expiry -> status is grace');
    assert(res.isAllowedEntry === true, 'Day 1 grace allows gym entry');
    assert(res.canGenerateQr === true, 'Day 1 grace allows QR generation');
    assert(res.graceDaysRemaining === 3, 'Day 1 grace has 3 graceDaysRemaining');
    assert(res.warningMessage && res.warningMessage.includes('Grace Period'), 'Day 1 grace provides warning message');
  }

  // 4. Day 2 of Grace Period (36 hours past expiry)
  {
    const testNow = new Date('2026-09-17T00:00:00Z'); // 36h past expiry (1.5 days)
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'grace', '36 hours past expiry -> status is grace');
    assert(res.isAllowedEntry === true, 'Day 2 grace allows gym entry');
    assert(res.canGenerateQr === true, 'Day 2 grace allows QR generation');
    assert(res.graceDaysRemaining === 2, 'Day 2 grace has 2 graceDaysRemaining');
  }

  // 5. Day 3 of Grace Period (60 hours past expiry)
  {
    const testNow = new Date('2026-09-18T00:00:00Z'); // 60h past expiry (2.5 days)
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'grace', '60 hours past expiry -> status is grace');
    assert(res.isAllowedEntry === true, 'Day 3 grace allows gym entry');
    assert(res.canGenerateQr === true, 'Day 3 grace allows QR generation');
    assert(res.graceDaysRemaining === 1, 'Day 3 grace has 1 graceDaysRemaining');
  }

  // 6. After Grace Period (73 hours past expiry, i.e., > 3 days)
  {
    const testNow = new Date('2026-09-18T13:00:00Z'); // 73 hours past expiry (3d 1h)
    const user = { membership: dummyPlan, membershipExpiresAt: baseExpiry };
    const res = getMembershipStatus(user, testNow);
    assert(res.status === 'expired', '73 hours past expiry -> status is expired');
    assert(res.isAllowedEntry === false, 'After grace period gym entry is DENIED');
    assert(res.canGenerateQr === false, 'After grace period QR generation is DENIED');
    assert(res.daysLeft === 0 && res.graceDaysRemaining === 0, 'Expired status has 0 days left');
  }

  // 7. No membership at all
  {
    const res = getMembershipStatus(null);
    assert(res.status === 'expired', 'Null user -> status is expired');
    assert(res.isAllowedEntry === false, 'Null user cannot enter');
    assert(res.canGenerateQr === false, 'Null user cannot generate QR');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: Date Calculation & Renewal Tests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- PART 2: Renewal Date Calculation Tests ---');
  {
    assert(parseDurationDays('1 Month') === 30, 'parseDurationDays("1 Month") === 30');
    assert(parseDurationDays('3 Months') === 90, 'parseDurationDays("3 Months") === 90');
    assert(parseDurationDays('6 Months') === 180, 'parseDurationDays("6 Months") === 180');
    assert(parseDurationDays('1 Year') === 365, 'parseDurationDays("1 Year") === 365');

    // Renewal when active: extends from current expiry
    const now = new Date('2026-09-15T12:00:00Z');
    const futureExpiry = new Date('2026-09-25T12:00:00Z'); // 10 days in future
    const renewedActive = calculateNewExpiry(futureExpiry, 30, now);
    const expectedActive = new Date('2026-10-25T12:00:00Z');
    assert(renewedActive.getTime() === expectedActive.getTime(), 'Renewing active plan extends from current expiry date (+30d)');

    // Renewal when expired: starts fresh from now
    const pastExpiry = new Date('2026-09-01T12:00:00Z'); // already expired
    const renewedExpired = calculateNewExpiry(pastExpiry, 30, now);
    const expectedFromNow = new Date('2026-10-15T12:00:00Z');
    assert(renewedExpired.getTime() === expectedFromNow.getTime(), 'Renewing expired plan starts fresh from now (+30d)');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: End-to-End Server API Tests (Active, Grace, Expired & Renewal)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- PART 3: End-to-End Server API & Access Control Tests ---');

  await mongoose.connect(process.env.MONGODB_URI);

  const testMemberEmail = 'member@fitzone.com';
  const memberUser = await User.findOne({ email: testMemberEmail });
  const adminUser = await User.findOne({ email: 'admin@fitzone.com' });
  const defaultPlan = await Membership.findOne({ level: 'Pro' });

  if (!memberUser || !defaultPlan) {
    console.error('Member or Plan not found in DB.');
    process.exit(1);
  }

  // Create axios instances with maxRedirects: 0 to capture session cookies
  const memberClient = axios.create({
    baseURL: BASE_URL,
    maxRedirects: 0,
    validateStatus: () => true,
  });
  const adminClient = axios.create({
    baseURL: BASE_URL,
    maxRedirects: 0,
    validateStatus: () => true,
  });

  // Helper to extract session cookie from headers
  const getCookie = (res) => {
    const sc = res.headers['set-cookie'];
    return sc ? sc.map((c) => c.split(';')[0]).join('; ') : '';
  };

  // Login Member
  const mLoginRes = await memberClient.post(
    '/auth/login',
    'email=member@fitzone.com&password=Member@123',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const memberCookie = getCookie(mLoginRes);
  memberClient.defaults.headers.common['Cookie'] = memberCookie;

  // Login Admin
  const aLoginRes = await adminClient.post(
    '/auth/login',
    'email=admin@fitzone.com&password=Admin@123',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const adminCookie = getCookie(aLoginRes);
  adminClient.defaults.headers.common['Cookie'] = adminCookie;

  // ── TEST 3.1: Active Membership QR Generation & Scan ──
  console.log('\n[Scenario 1] Active Membership');
  const now = new Date();
  memberUser.membership = defaultPlan._id;
  memberUser.membershipActivatedAt = now;
  memberUser.membershipExpiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days active
  memberUser.isActive = true;
  await memberUser.save();

  // Dashboard check
  const dashRes1 = await memberClient.get('/member/dashboard');
  assert(dashRes1.status === 200, 'Member dashboard loads for active member (200)');
  assert(dashRes1.data.includes('Active'), 'Member dashboard displays "Active" status');

  // QR Generation check
  const qrGen1 = await memberClient.post('/member/qr/generate');
  assert(qrGen1.status === 200 && qrGen1.data.success === true, 'Active member can generate QR token (200)');
  const token1 = qrGen1.data.token;
  assert(typeof token1 === 'string' && token1.length > 0, 'Active QR token generated successfully');

  // Scanner check
  const scanRes1 = await adminClient.post('/admin/scan/validate', { token: token1 });
  assert(scanRes1.data.success === true, 'Admin scanner grants entry for active member');
  assert(scanRes1.data.message.includes('Access Granted'), 'Scanner response confirms Access Granted');

  // ── TEST 3.2: Grace Period Membership QR Generation & Scan ──
  console.log('\n[Scenario 2] Grace Period (Day 1 - 24 hours past expiry)');
  memberUser.membershipExpiresAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day past expiry -> 2 days grace remaining
  await memberUser.save();

  // Dashboard check
  const dashRes2 = await memberClient.get('/member/dashboard');
  assert(dashRes2.status === 200, 'Member dashboard loads for grace member (200)');
  assert(dashRes2.data.includes('Grace Period'), 'Member dashboard displays Grace Period badge');
  assert(dashRes2.data.includes('remaining in your grace period'), 'Member dashboard displays Grace Period warning banner');

  // QR Generation check
  const qrGen2 = await memberClient.post('/member/qr/generate');
  assert(qrGen2.status === 200 && qrGen2.data.success === true, 'Grace period member can generate QR token (200)');
  const token2 = qrGen2.data.token;

  // Scanner check
  const scanRes2 = await adminClient.post('/admin/scan/validate', { token: token2 });
  assert(scanRes2.data.success === true, 'Admin scanner grants entry for member in grace period');
  assert(scanRes2.data.status === 'grace', 'Scanner identifies member status as grace');

  // ── TEST 3.3: Expired Membership (Past 3-Day Grace Period) ──
  console.log('\n[Scenario 3] Expired Membership (4 days past expiry, grace ended)');
  memberUser.membershipExpiresAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days past expiry (> 3d grace)
  await memberUser.save();

  // Dashboard check
  const dashRes3 = await memberClient.get('/member/dashboard');
  assert(dashRes3.data.includes('Expired'), 'Member dashboard displays "Expired" status');
  assert(dashRes3.data.includes('Gym Entry Pass Disabled') || dashRes3.data.includes('Renew Membership'), 'Member dashboard displays Disabled Pass & Renew button');

  // QR Generation check: MUST BE BLOCKED BY BACKEND (403)
  const qrGen3 = await memberClient.post('/member/qr/generate');
  assert(qrGen3.status === 403, 'Expired member QR generation rejected with 403 Forbidden');
  assert(qrGen3.data.success === false, 'QR generation response success is false');
  assert(qrGen3.data.message.includes('Membership Expired'), 'Rejection message explains membership is expired');

  // Scanner check: Attempting entry with old token or any token for expired member
  // Generate an entry manually in DB for the expired user to test scanner rejection
  const expiredEntryToken = 'expired_test_token_' + Date.now();
  await GymEntry.create({
    member: memberUser._id,
    token: expiredEntryToken,
    expiresAt: new Date(Date.now() + 30000),
    used: false,
  });
  const scanRes3 = await adminClient.post('/admin/scan/validate', { token: expiredEntryToken });
  assert(scanRes3.data.success === false, 'Scanner DENIES gym entry for member after grace period');
  assert(scanRes3.data.message.includes('Membership Expired') && scanRes3.data.message.includes('Denied'), 'Scanner response states Entry Denied & Expired');

  // ── TEST 3.4: Payment & Membership Renewal ──
  console.log('\n[Scenario 4] Renewal After Verified Payment');
  // Member submits offline payment request
  const submitPayRes = await memberClient.post(
    '/member/payment/offline',
    `planId=${defaultPlan._id}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  assert(submitPayRes.status === 302, 'Member offline payment request submitted (302)');

  // Find the pending payment
  const pendingPayment = await Payment.findOne({ member: memberUser._id, status: 'pending' }).sort({ createdAt: -1 });
  assert(pendingPayment !== null, 'Pending payment record found in database');

  // Admin verifies the offline payment
  const verifyRes = await adminClient.post(
    `/admin/payments/${pendingPayment._id}/verify`,
    {},
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  assert(verifyRes.status === 302, 'Admin verified offline payment (302)');

  // Verify updated user record in DB
  const renewedUser = await User.findById(memberUser._id);
  assert(renewedUser.membership.toString() === defaultPlan._id.toString(), 'Renewed user has active plan assigned');
  assert(renewedUser.membershipExpiresAt !== null, 'Renewed user has membershipExpiresAt timestamp');
  assert(renewedUser.membershipExpiresAt.getTime() > Date.now(), 'Renewed user expiry date is set in the future');

  // Verify member can immediately generate QR again
  const qrGen4 = await memberClient.post('/member/qr/generate');
  assert(qrGen4.status === 200 && qrGen4.data.success === true, 'Renewed member can generate QR code again (200)');

  // Verify scanner accepts the renewed member
  const scanRes4 = await adminClient.post('/admin/scan/validate', { token: qrGen4.data.token });
  assert(scanRes4.data.success === true, 'Admin scanner grants entry for renewed member');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

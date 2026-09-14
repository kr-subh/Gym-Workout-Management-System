/**
 * Reusable Membership Helper Utility
 * 
 * Enforces backend-calculated membership status and exact 3-day grace period logic.
 * Never trust frontend dates.
 */

const GRACE_PERIOD_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse human-readable duration strings (e.g. '1 Month', '3 Months', '6 Months', '1 Year')
 * into exact number of days.
 */
const parseDurationDays = (durationStr) => {
  if (!durationStr) return 30;
  const str = durationStr.toString().toLowerCase();
  const match = str.match(/(\d+)/);
  const num = match ? parseInt(match[1], 10) : 1;
  if (str.includes('year')) return num * 365;
  if (str.includes('month')) return num * 30;
  if (str.includes('week')) return num * 7;
  if (str.includes('day')) return num;
  return 30;
};

/**
 * Calculate membership status with exact 3-day grace period.
 * 
 * States:
 * 1. ACTIVE: Current date is on or before membership expiry date (now <= expiryDate)
 * 2. GRACE:  Membership expiry date has passed, but the 3-day grace period has not ended
 *            (expiryDate < now <= expiryDate + 3 days)
 * 3. EXPIRED: The 3-day grace period has ended (now > expiryDate + 3 days) or no membership
 * 
 * @param {Object} user - User document or memory object with membership and membershipExpiresAt
 * @param {Date} [referenceDate=new Date()] - Optional date for time simulation/testing
 * @returns {Object} status details
 */
const getMembershipStatus = (user, referenceDate = new Date()) => {
  const now = new Date(referenceDate);

  if (!user || (!user.membership && !user.membershipExpiresAt)) {
    return {
      status: 'expired',
      label: 'No Membership',
      isAllowedEntry: false,
      canGenerateQr: false,
      expiryDate: null,
      graceExpiryDate: null,
      daysLeft: 0,
      graceDaysRemaining: 0,
      warningMessage: null,
    };
  }

  // Determine the base expiry date
  let expiryDate = null;
  if (user.membershipExpiresAt) {
    expiryDate = new Date(user.membershipExpiresAt);
  } else if (user.membership) {
    // If user has a membership but no explicit expiresAt, infer from createdAt or now
    const baseDate = user.membershipActivatedAt || user.createdAt || now;
    const durationDays = parseDurationDays(user.membership.duration || '1 Month');
    expiryDate = new Date(new Date(baseDate).getTime() + durationDays * MS_PER_DAY);
  } else {
    return {
      status: 'expired',
      label: 'No Membership',
      isAllowedEntry: false,
      canGenerateQr: false,
      expiryDate: null,
      graceExpiryDate: null,
      daysLeft: 0,
      graceDaysRemaining: 0,
      warningMessage: null,
    };
  }

  // Exact 3-day grace period
  const graceExpiryDate = new Date(expiryDate.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY);

  // 1. ACTIVE: now <= expiryDate
  if (now.getTime() <= expiryDate.getTime()) {
    const diffMs = expiryDate.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / MS_PER_DAY));

    return {
      status: 'active',
      label: 'Active',
      isAllowedEntry: true,
      canGenerateQr: true,
      expiryDate,
      graceExpiryDate,
      daysLeft,
      graceDaysRemaining: GRACE_PERIOD_DAYS,
      warningMessage: null,
    };
  }

  // 2. GRACE: expiryDate < now <= graceExpiryDate
  if (now.getTime() <= graceExpiryDate.getTime()) {
    const remainingGraceMs = graceExpiryDate.getTime() - now.getTime();
    // Calculate remaining full/partial grace days (1, 2, or 3)
    const graceDaysRemaining = Math.max(1, Math.ceil(remainingGraceMs / MS_PER_DAY));
    const expiredDaysAgo = Math.floor((now.getTime() - expiryDate.getTime()) / MS_PER_DAY) + 1;

    const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      status: 'grace',
      label: 'Grace Period',
      isAllowedEntry: true,
      canGenerateQr: true,
      expiryDate,
      graceExpiryDate,
      daysLeft: 0,
      graceDaysRemaining,
      expiredDaysAgo,
      warningMessage: `⚠️ Grace Period: Your membership expired on ${formattedExpiry}. You have ${graceDaysRemaining} day${graceDaysRemaining === 1 ? '' : 's'} remaining in your grace period. Please renew to avoid losing gym access.`,
    };
  }

  // 3. EXPIRED: now > graceExpiryDate
  const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    status: 'expired',
    label: 'Expired',
    isAllowedEntry: false,
    canGenerateQr: false,
    expiryDate,
    graceExpiryDate,
    daysLeft: 0,
    graceDaysRemaining: 0,
    warningMessage: `❌ Membership Expired: Your plan and grace period have expired (ended on ${formattedExpiry}). Gym entry is disabled until renewal.`,
  };
};

/**
 * Calculate the new expiry date upon successful payment renewal.
 * 
 * Rules:
 * - If currently active and unexpired (currentExpiresAt > now), extend from current expiry date.
 * - If expired or in grace period (currentExpiresAt <= now or missing), start from now.
 * 
 * @param {Date|string|null} currentExpiresAt 
 * @param {number} durationDays 
 * @param {Date} [referenceDate=new Date()]
 * @returns {Date} new expiry date
 */
const calculateNewExpiry = (currentExpiresAt, durationDays, referenceDate = new Date()) => {
  const now = new Date(referenceDate);
  const days = Number(durationDays) || 30;

  if (currentExpiresAt) {
    const current = new Date(currentExpiresAt);
    if (current.getTime() > now.getTime()) {
      // Active: extend from current expiry
      return new Date(current.getTime() + days * MS_PER_DAY);
    }
  }

  // Expired or Grace: start fresh from now
  return new Date(now.getTime() + days * MS_PER_DAY);
};

module.exports = {
  GRACE_PERIOD_DAYS,
  parseDurationDays,
  getMembershipStatus,
  calculateNewExpiry,
};

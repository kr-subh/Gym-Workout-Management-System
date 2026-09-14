// Prevent browser caching of protected pages
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

// User must be logged in
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
};

// Admin only
const isAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  res.status(403).render('error', {
    title: 'Access Denied',
    statusCode: 403,
    message: 'You do not have permission to access this page.',
  });
};

// Trainer only
const isTrainer = (req, res, next) => {
  if (req.session && req.session.role === 'trainer') {
    return next();
  }
  res.status(403).render('error', {
    title: 'Access Denied',
    statusCode: 403,
    message: 'This area is restricted to trainers.',
  });
};

// Member only
const isMember = (req, res, next) => {
  if (req.session && req.session.role === 'member') {
    return next();
  }
  res.status(403).render('error', {
    title: 'Access Denied',
    statusCode: 403,
    message: 'This area is restricted to members.',
  });
};

module.exports = { noCache, isAuthenticated, isAdmin, isTrainer, isMember };

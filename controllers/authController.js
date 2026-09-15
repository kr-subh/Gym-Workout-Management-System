const bcrypt = require('bcryptjs');
const User   = require('../models/User');

// Helper to redirect users based on their assigned role
const redirectByRole = (res, role) => {
  if (role === 'admin')   return res.redirect('/admin/dashboard');
  if (role === 'trainer') return res.redirect('/trainer/dashboard');
  return res.redirect('/member/dashboard');
};

// GET /auth/register — Show registration form
const getRegister = (req, res) => {
  if (req.session && req.session.userId) {
    return redirectByRole(res, req.session.role);
  }
  const role = ['admin', 'trainer', 'member'].includes(req.query.role) ? req.query.role : 'member';
  res.render('auth/register', {
    title: role === 'admin' ? 'Admin Registration' : (role === 'trainer' ? 'Trainer Registration' : 'Register'),
    error: null,
    formData: { role },
    selectedRole: role,
  });
};

// POST /auth/register — Create a new member, trainer, or admin account
const postRegister = async (req, res, next) => {
  const { name, email, phone, password, confirmPassword, dietPreference, role, specialization, experience, adminCode } = req.body;
  const userRole = ['admin', 'trainer', 'member'].includes(role) ? role : 'member';

  // Form validations
  if (!name || !email || !password || !confirmPassword) {
    return res.render('auth/register', {
      title: 'Register',
      error: 'Name, email, and password are required.',
      formData: req.body,
      selectedRole: userRole,
    });
  }

  if (password !== confirmPassword) {
    return res.render('auth/register', {
      title: 'Register',
      error: 'Passwords do not match.',
      formData: req.body,
      selectedRole: userRole,
    });
  }

  if (password.length < 6) {
    return res.render('auth/register', {
      title: 'Register',
      error: 'Password must be at least 6 characters.',
      formData: req.body,
      selectedRole: userRole,
    });
  }

  // Admin accounts require a security code to prevent unauthorized registration
  if (userRole === 'admin') {
    const validCode = process.env.ADMIN_REGISTRATION_CODE || 'subh@123';
    if (!adminCode || adminCode.trim() !== validCode) {
      return res.render('auth/register', {
        title: 'Register',
        error: 'Invalid Admin Security Code.',
        formData: req.body,
        selectedRole: userRole,
      });
    }
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.render('auth/register', {
        title: 'Register',
        error: 'An account with this email already exists.',
        formData: req.body,
        selectedRole: userRole,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : undefined,
      password: hashedPassword,
      role: userRole,
      specialization: userRole === 'trainer' ? (specialization ? specialization.trim() : 'Fitness & Strength Coaching') : undefined,
      experience: userRole === 'trainer' ? (experience ? experience.trim() : '3+ Years') : undefined,
      dietPreference: userRole === 'member' ? (dietPreference || undefined) : undefined,
    });

    res.redirect(`/auth/login?registered=1&role=${userRole}`);
  } catch (err) {
    console.error('[Register Error]:', err.message);
    res.render('auth/register', {
      title: 'Register',
      error: 'Something went wrong during registration. Please try again.',
      formData: req.body,
      selectedRole: userRole,
    });
  }
};

// GET /auth/login — Show login form
const getLogin = (req, res) => {
  if (req.session && req.session.userId) {
    return redirectByRole(res, req.session.role);
  }
  const role = ['admin', 'trainer', 'member'].includes(req.query.role) ? req.query.role : 'member';
  res.render('auth/login', {
    title: role === 'admin' ? 'Admin Login' : (role === 'trainer' ? 'Trainer Login' : 'Login'),
    error: null,
    success: req.query.registered ? 'Account created successfully! Please log in.' : null,
    formData: {},
    selectedRole: role,
  });
};

// POST /auth/login — Authenticate user and initialize session
const postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('auth/login', {
      title: 'Login',
      error: 'Email and password are required.',
      success: null,
      formData: { email },
    });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Invalid email or password.',
        success: null,
        formData: { email },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Invalid email or password.',
        success: null,
        formData: { email },
      });
    }

    // Set session data
    req.session.userId = user._id.toString();
    req.session.role   = user.role;
    req.session.name   = user.name;

    const returnTo = req.session.returnTo || null;
    delete req.session.returnTo;

    if (returnTo) return res.redirect(returnTo);
    return redirectByRole(res, user.role);
  } catch (err) {
    console.error('[Login Error]:', err.message);
    res.render('auth/login', {
      title: 'Login',
      error: 'Something went wrong during login. Please try again.',
      success: null,
      formData: { email },
    });
  }
};

// POST /auth/logout — Destroy session and clear cookie
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[Logout Error]:', err.message);
    res.clearCookie('gymSessionId');
    res.redirect('/auth/login');
  });
};

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  logout,
};

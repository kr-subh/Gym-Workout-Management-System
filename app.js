require('dotenv').config();
const express       = require('express');
const path          = require('path');
const session       = require('express-session');
const connectDB     = require('./config/db');
const { seedMemberships } = require('./config/seedMemberships');
const homeRoutes    = require('./routes/homeRoutes');
const authRoutes    = require('./routes/authRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const memberRoutes  = require('./routes/memberRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app  = express();
const PORT = process.env.PORT || 5050;

// Connect to MongoDB Atlas and seed default plans if empty
connectDB().then(() => seedMemberships());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  name: 'gymSessionId',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,          // set true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Make session user available in all EJS templates
app.use((req, res, next) => {
  res.locals.sessionUser = req.session.userId
    ? { id: req.session.userId, name: req.session.name, role: req.session.role }
    : null;
  next();
});

// Routes
app.use('/',        homeRoutes);
app.use('/auth',    authRoutes);
app.use('/admin',   adminRoutes);
app.use('/trainer', trainerRoutes);
app.use('/member',  memberRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
});

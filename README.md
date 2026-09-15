# FitZone — Modern Gym & Membership Management System

FitZone is a production-grade, full-stack gym management platform engineered for fitness centers, athletic clubs, and personal training studios. Built on **Node.js**, **Express.js**, **EJS**, and **MongoDB Atlas**, it delivers an end-to-end operational suite covering member onboarding, tiered subscriptions, automated access control via dynamic QR passes, multi-channel payment verification, trainer workout programming, and biometric progress tracking.

---

## 📌 Problem Statement

Traditional gym management suffers from several operational and security bottlenecks:
1. **Pass Sharing & Fraud**: Static gym ID cards, barcodes, or mobile screenshots are routinely shared among friends, leading to unauthorized entry and revenue leakage.
2. **Payment Bypasses**: Systems that trust frontend callbacks for payment confirmation can be exploited, activating memberships without verified fund transfers.
3. **Abrupt Access Cutoffs**: Members whose plans expire often experience immediate lockouts at the turnstile, causing friction and negative member experiences before they have an opportunity to renew.
4. **Disjointed Trainer-Athlete Workflows**: Workout routines, diet recommendations, and progress logs are frequently scattered across messaging apps and spreadsheets rather than integrated into the gym's management ecosystem.

**FitZone solves these challenges** with server-authoritative state management, rotating 30-second cryptographic QR tokens, an exact 3-day grace period window, dual online (Razorpay) and offline (front desk) payment reconciliation, and dedicated role-based portals for Admins, Trainers, and Members.

---

## ⚡ Main Features

- **Dynamic QR Gym Access Control**: Rotating, cryptographic one-time QR codes with a strict 30-second TTL to eliminate pass-sharing and screenshot replays.
- **Automated Attendance Logging**: Valid entrance scans instantly record timestamped attendance records for members.
- **Dual Payment Infrastructure**:
  - **Online**: Razorpay Test Mode integration with server-side HMAC SHA-256 signature verification.
  - **Offline**: Front-desk cash/POS workflow with admin review and approval controls.
- **Exact 3-Day Grace Period Engine**: Server-calculated status lifecycle (Active → Grace Period → Expired) with smart renewal date extension logic.
- **Role-Based Access Control (RBAC)**: Enforced middleware isolation across Admin, Trainer, and Member routes.
- **Coach Assignment & Programming**: Admin-managed trainer assignment; coaches design custom workout splits and targeted macro nutrition plans.
- **Biometric Progress & Weight Logging**: Members record weigh-ins and track progress trends toward target goals.
- **Centralized Feature Tier Gating**: Declarative feature checks ensuring advanced analytics and custom diets are unlocked according to membership tier.
- **Premium Responsive UI**: Dark luxury gym aesthetic with glassmorphism cards, interactive 3D perspective hover tilts, and mobile navigation drawers.

---

## 👥 Three User Roles

FitZone enforces strict role-based authorization:

### 1. Admin
- **Member Management**: Search, filter, inspect profiles, assign certified trainers, and manage member statuses.
- **Trainer Management**: Onboard new trainers, update specialties, and manage coach profiles.
- **Plan Management (CRUD)**: Create, edit, and delete subscription tiers (Normal, Pro, Pro+).
- **Payment Reconciliation**: Review pending offline payments with one-click **Verify** (activates plan) or **Reject** capabilities.
- **Gym Entrance Scanner**: Web-based barcode/QR scanner to validate arriving members and grant/deny entrance.

### 2. Trainer
- **Assigned Athlete Roster**: View only members assigned to them by the Admin.
- **Custom Workout Split Builder**: Build day-by-day routines with exercises, sets, and rep ranges.
- **Diet Regimen Planning**: Formulate daily meal schedules, macro targets, and diet preferences (Vegetarian, Non-Vegetarian, Vegan, Eggetarian).
- **Member Progress Monitoring**: Track weight logs and attendance rates of assigned athletes.

### 3. Member
- **Personalized Dashboard**: View active plan details, coach details, today's workout, and current status.
- **Dynamic Entrance Pass**: Generate short-lived (30s) QR codes to scan at gym entrance.
- **Plan Selection & Payments**: Browse tiers, initiate Razorpay Test Mode checkout, or submit offline payment requests.
- **Workout & Diet Viewer**: Access trainer-assigned routines and nutrition schedules.
- **Weight Logging & Streak Tracking**: Track personal weight milestones and attendance streaks.

---

## 🏆 Membership Levels

FitZone organizes services into three distinct tiers:

| Tier | Duration | Price | Included Features |
|------|----------|-------|-------------------|
| **Normal Fitness** | 1 Month | ₹1,499 | Gym floor & standard equipment access, dynamic QR gym entry pass, general workout routine, basic profile & attendance tracking. |
| **Pro Athlete** | 3 Months | ₹3,499 | *All Normal features* + Personalized coach-crafted workout split, customized dietary regimen, body weight tracking & analytics, priority locker access. |
| **Pro+ Elite Performance** | 6 Months | ₹6,499 | *All Pro features* + 1-on-1 certified trainer dedication, advanced weekly progress analytics, supplement protocol guidance, sauna & steam access. |

---

## 🛠 Technology Stack

- **Runtime Environment**: Node.js (v18+)
- **Server Framework**: Express.js (v4.x)
- **View Engine**: EJS (Embedded JavaScript templates)
- **Database & ODM**: MongoDB Atlas with Mongoose ODM (v8.x)
- **Authentication & Sessions**: `express-session` with HTTP-only session cookies and `bcryptjs` password hashing
- **Payment Gateway**: Razorpay Node.js SDK (Test Mode) + Node `crypto` HMAC-SHA256 signature verification
- **QR Code Engine**: `qrcode` library for dynamic data-URL generation + Node `crypto` random token generation
- **Styling**: Modern Vanilla CSS (Custom design system, dark luxury gym theme, CSS 3D perspective transforms)
- **Typography**: Google Fonts (*Outfit* display, *Inter* body)

---

## 🏛 MVC Architecture & Project Structure

FitZone follows the classic Model-View-Controller (MVC) pattern to separate business logic, data models, and presentation:

```
Gym/
├── config/
│   ├── db.js                 # MongoDB connection & connection resilience
│   └── seedMemberships.js    # Automatic seeding of default membership tiers
├── controllers/
│   ├── adminController.js     # Admin dashboard, member/trainer management, entrance scanner
│   ├── authController.js      # Registration, authentication, login/logout, role routing
│   ├── homeController.js      # Public landing page with 3D showcase & coach profiles
│   ├── memberController.js    # Member dashboard, QR generation, workout/diet views, weight logs
│   ├── membershipController.js# Membership plan catalog & admin CRUD
│   ├── paymentController.js   # Razorpay order creation, signature verification, offline review
│   └── trainerController.js   # Trainer dashboard, workout builder, diet planner
├── middleware/
│   ├── authMiddleware.js      # Route protection, noCache, role gates (isAdmin, isTrainer, isMember)
│   ├── errorMiddleware.js     # 404 handler and central error renderer
│   └── membershipMiddleware.js# Declarative tier feature-gating middleware
├── models/
│   ├── Attendance.js          # Gym visit records (date, time, method)
│   ├── DietPlan.js            # Daily meal plans & macro specifications
│   ├── GymEntry.js            # 30-second QR tokens, expiration, and single-use status
│   ├── Membership.js          # Subscription plans, durations, pricing, and features
│   ├── Payment.js             # Financial records (Online Razorpay / Offline front-desk)
│   ├── User.js                # Users (Admin, Trainer, Member) with bcrypt hashes
│   ├── Weight.js              # Biometric weigh-in history
│   └── WorkoutPlan.js         # Daily exercises, sets, reps, and notes
├── public/
│   ├── css/
│   │   └── style.css          # Comprehensive design system & luxury dark theme
│   └── images/                # High-resolution fitness & coach imagery
├── routes/
│   ├── adminRoutes.js         # /admin routes
│   ├── authRoutes.js          # /auth routes
│   ├── homeRoutes.js          # / root landing page
│   ├── memberRoutes.js        # /member routes
│   └── trainerRoutes.js       # /trainer routes
├── utils/
│   └── membershipHelper.js    # Server-calculated status, 3-day grace, & renewal math
├── views/
│   ├── admin/                 # Admin management & scanner templates
│   ├── auth/                  # Login & registration views
│   ├── member/                # Member dashboard, pass, plans, payment, workout, diet
│   ├── partials/              # Header, navigation, and footer partials
│   ├── trainer/               # Trainer dashboard, workout/diet management views
│   ├── error.ejs              # Universal error presentation view
│   └── index.ejs              # Rich landing page with 3D perspective hero card
├── .env                       # Environment variables (excluded by .gitignore)
├── .gitignore                 # Excludes .env, node_modules, logs, and OS files
├── app.js                     # Express application bootstrap & route mounting
└── package.json               # Project dependencies and startup scripts
```

---

## 🗄 MongoDB Atlas Setup

1. **Create a MongoDB Atlas Account**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up/log in.
2. **Deploy a Free Cluster**:
   - Select **M0 (Free Tier)** and choose your preferred cloud provider and region.
3. **Database User & Access**:
   - Under **Database Access**, create a database user with read and write privileges (e.g. `gym_admin`). Note the username and password.
4. **Network Access**:
   - Under **Network Access**, add an IP Access List entry.
   - For local development and flexible hosting, add `0.0.0.0/0` (Allow Access from Anywhere) or specify your server IP.
5. **Get Connection String**:
   - Click **Connect** → **Drivers** (Node.js).
   - Copy the URI and replace `<password>` with your database user password:
     ```
     mongodb+srv://<username>:<password>@<cluster-url>/gymdb?retryWrites=true&w=majority
     ```

---

## 🔐 Environment Variables (`.env`)

Create a `.env` file in the project root:

```env
PORT=5050
NODE_ENV=development
SESSION_SECRET=f38b69b5e0c51d95d12cb84ef757095908ce901bc0dd89a87d605ff5744cb892
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/gymdb?retryWrites=true&w=majority
RAZORPAY_KEY_ID=rzp_test_1DP5mmOlF5G5ag
RAZORPAY_KEY_SECRET=thiswillberaboratory
ADMIN_REGISTRATION_CODE=subh@123
```

| Variable | Description | Example / Notes |
|----------|-------------|-----------------|
| `PORT` | Local or production HTTP port | `5050` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `SESSION_SECRET` | 64-char cryptographically secure key for session encryption | Cryptographically generated hex string |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `RAZORPAY_KEY_ID` | Razorpay Test Key ID (public to client) | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Test Key Secret (**kept strictly on backend**) | Private secret key |
| `ADMIN_REGISTRATION_CODE` | Security passkey required to register an Admin account | `subh@123` |

---

## 🚀 Installation & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (v9+)
- Active internet connection for MongoDB Atlas & Razorpay Test Mode

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-repo/gym-management.git
cd gym-management
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env   # Or create .env with credentials described above
```

### 3. Run Locally
```bash
# Development mode (automatic reload with nodemon)
npm run dev

# Production startup
npm start
```
The application will start at: `http://localhost:5050`

---

## 🔑 Demo Login Credentials

Upon startup, default accounts and subscription tiers are seeded automatically if the database is clean:

| Role | Email | Password | Capabilities |
|------|-------|----------|--------------|
| **Admin** | `admin@fitzone.com` | `Admin@123` | Member & trainer management, plan CRUD, offline payment approval, QR entrance scanner. |
| **Trainer** | `trainer1@fitzone.com` | `Trainer@123` | View assigned members, create & edit custom workout plans, configure tailored diet plans. |
| **Member** | `member@fitzone.com` | `Member@123` | Access pass (dynamic QR), view assigned routines, browse plans, make online/offline payments, log body weight. |

---

## 💳 Razorpay Test Mode Payment System

FitZone follows security best practices for payment gateway integrations:

1. **Plan Selection**: Member initiates checkout on `/member/plans/pay/:planId`.
2. **Order Creation**:
   - Client requests `POST /member/payment/create-order`.
   - Backend calculates the order amount based on the database price (never trust frontend prices) and creates an order via the Razorpay SDK.
   - Server creates a `Payment` document with status `pending`.
   - Only `orderId`, `amount`, `currency`, and `RAZORPAY_KEY_ID` are sent to frontend (`RAZORPAY_KEY_SECRET` is never exposed).
3. **Client-Side Modal**: Razorpay Checkout modal opens with test mode enabled.
4. **Backend Signature Verification**:
   - Upon completion, Razorpay returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
   - Client sends these to `POST /member/payment/verify`.
   - Backend computes:
     ```javascript
     const expectedSignature = crypto
       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
       .update(razorpay_order_id + '|' + razorpay_payment_id)
       .digest('hex');
     ```
   - If signatures match, payment status becomes `paid` and the membership is activated.
   - If signatures mismatch, payment is marked `failed` and access is denied.

---

## 📱 Dynamic QR Gym-Entry System

The dynamic QR entrance pass is designed for zero fraud and automated operations:

### 30-Second Expiration (TTL)
- When a member opens their entrance pass on `/member/dashboard`, a secure token is generated via `POST /member/qr/generate`.
- An opaque 64-character random cryptographic token is generated using `crypto.randomBytes(32).toString('hex')` (contains no PII).
- The token is saved in the database with an exact expiration time: `expiresAt = now + 30 seconds`.
- The frontend re-fetches a new token every 30 seconds, rendering screenshots and forwarded photos expired before they can be reused.

### One-Time Validation (Anti-Replay)
- The admin or front-desk receptionist scans the pass at `/admin/scan`.
- Backend executes `POST /admin/scan/validate`:
  1. Checks if token exists.
  2. Verifies `used === false` (strictly single-use).
  3. Verifies `now <= expiresAt` (checks 30s TTL).
  4. Verifies the member's membership status is **Active** or in **Grace Period**.
  5. Atomically flags the token as `used = true` and `usedAt = now`.
  6. Automatically records a visit in the `Attendance` collection with date and time.
- Any attempt to scan the token a second time returns: `QR Code Already Used` and denies entry.

---

## ⏳ 3-Day Membership Grace Period Logic

Membership status is calculated exclusively on the backend using the centralized helper [utils/membershipHelper.js](file:///Users/subhashkumaryadav/Desktop/Gym/utils/membershipHelper.js):

```
       ACTIVE                       GRACE PERIOD (72h)                     EXPIRED
├────────────────────────────┼─────────────────────────────────┼────────────────────────► Time
                     membershipExpiresAt               graceExpiryDate (expiresAt + 3 days)
                     [QR Works / Entry OK]       [Warning Banner / Entry OK]      [QR Locked / Entry Denied]
```

### 1. ACTIVE (`now <= membershipExpiresAt`)
- Status displays **Active** with green badge.
- Dynamic QR generation is enabled.
- Entrance scanner grants entry.

### 2. GRACE (`membershipExpiresAt < now <= membershipExpiresAt + 3 days`)
- Status displays **Grace Period** with warning badge.
- Warning banner alerts the member with countdown: *"Your membership expired on [Date]. You have X days remaining in your grace period. Please renew to avoid losing gym access."*
- Dynamic QR code generation **remains enabled**.
- Entrance scanner grants entry with a grace warning indicator.

### 3. EXPIRED (`now > membershipExpiresAt + 3 days` or no plan)
- Status displays **Expired** with red badge.
- QR code generation is **strictly blocked** (returns HTTP 403).
- Entrance scanner **denies entry**.
- Dashboard displays a **Renew Membership** call-to-action button.

### Smart Renewal Date Calculation
Upon verified payment renewal:
- **Renewing while Active**: The new expiration date extends from the existing expiration date (`currentExpiry + planDurationDays`).
- **Renewing while in Grace or Expired**: The new expiration date starts fresh from the moment payment is verified (`now + planDurationDays`).

---

## 🚢 Production Deployment Instructions

FitZone is packaged for zero-friction deployment on any Node.js hosting platform (Render, Railway, Fly.io, Heroku, AWS EC2, DigitalOcean):

### Deploying on Render / Railway

1. **Push to GitHub**:
   Ensure your repository is pushed to GitHub (the included `.gitignore` ensures `.env` is omitted).
2. **Create New Web Service**:
   - Connect your GitHub repository.
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Configure Environment Variables**:
   In your host's dashboard (e.g. Render Environment tab), supply:
   - `NODE_ENV` = `production`
   - `PORT` = `5050` (or leave default assigned by platform)
   - `SESSION_SECRET` = *(Generate a 64-character random string)*
   - `MONGODB_URI` = `mongodb+srv://<username>:<password>@cluster.mongodb.net/gymdb?retryWrites=true&w=majority`
   - `RAZORPAY_KEY_ID` = *(Your Razorpay Live or Test Key ID)*
   - `RAZORPAY_KEY_SECRET` = *(Your Razorpay Live or Test Secret)*
4. **Ensure Atlas Network Access**:
   Make sure MongoDB Atlas has `0.0.0.0/0` in Network Access so the cloud container can reach the database.
5. **HTTPS Cookies**:
   In production with SSL/HTTPS enabled, update `cookie.secure = true` in [app.js](file:///Users/subhashkumaryadav/Desktop/Gym/app.js) if required by your reverse proxy configuration.

---

## 🧪 Regression & Verification Tests

To run the automated test suite verifying status calculations, renewal dates, QR tokens, and access control:

```bash
node scratch/test_expiry_grace.js
```
*Executes 61 automated tests across all status transitions, grace period boundaries, token lifetimes, and entrance permissions.*

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
FitZone © 2026. Built with passion for fitness & performance.
# Gym-Membership-Workout-Plan-Management-System
# Gym-Workout-Management-System

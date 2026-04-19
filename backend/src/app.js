const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  createParentPath: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'RAHAT-ONE API is running',
    timestamp: new Date().toISOString()
  });
});

// Test Odoo connection endpoint
app.get('/test-odoo', async (req, res) => {
  try {
    const odooAdapter = require('./adapters/odooAdapter');
    const uid = await odooAdapter.authenticate();

    res.json({
      success: true,
      message: 'Odoo connection successful',
      uid: uid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Odoo connection failed',
      error: error.message
    });
  }
});

// List available databases
app.get('/test-databases', async (req, res) => {
  try {
    const xmlrpc = require('xmlrpc');
    const client = xmlrpc.createClient({
      host: 'localhost',
      port: 8069,
      path: '/xmlrpc/2/db'
    });

    client.methodCall('list', [], (error, databases) => {
      if (error) {
        res.status(500).json({ success: false, error: error.message });
      } else {
        res.json({ success: true, databases });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import routes
const onboardingRoutes = require('./routes/onboardingRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const hrVerificationRoutes = require('./routes/hrVerificationRoutes');
const lookupRoutes = require('./routes/lookupRoutes');
const authRoutes = require('./routes/authRoutes');
const leaveRoutes = require('./routes/leavesRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const hrRoutes = require('./routes/hrRoutes');
const auditRoutes = require('./routes/auditRoutes');
const branchRoutes = require('./routes/branchRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const departmentRoutes = require('./routes/departmentRoutes');

// DEBUG: Check what we imported
console.log('onboardingRoutes:', typeof onboardingRoutes);
console.log('registrationRoutes:', typeof registrationRoutes);
console.log('hrVerificationRoutes:', typeof hrVerificationRoutes);
console.log('lookupRoutes:', typeof lookupRoutes);
console.log('authRoutes:', typeof authRoutes);
console.log('leaveRoutes:', typeof leaveRoutes);
console.log('expenseRoutes:', typeof expenseRoutes);
console.log('employeeRoutes:', typeof employeeRoutes);
console.log('hrRoutes:', typeof hrRoutes);
console.log('auditRoutes:', typeof auditRoutes);
console.log('branchRoutes:', typeof branchRoutes);
console.log('attendanceRoutes:', typeof attendanceRoutes);
console.log('departmentRoutes:', typeof departmentRoutes);


// Register routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/hr/verification', hrVerificationRoutes);
app.use('/api/lookup', lookupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/departments', departmentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

module.exports = app;

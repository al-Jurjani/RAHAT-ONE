const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
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

module.exports = app;

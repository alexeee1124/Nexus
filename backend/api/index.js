const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent browser caching of API responses
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Database Connection (Executes on boot in Serverless)
const connectDB = require('../config/db');
connectDB();

// Mount Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api', require('../routes/api'));
app.use('/api/admin', require('../routes/admin'));

// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Nexus V2 Middleman API is Online', timestamp: new Date() });
});

// We will export the app for Vercel instead of calling app.listen directly
// In local development, we can run a dev server script later.
module.exports = app;

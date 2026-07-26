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

// Analytics Tracker
const metricsTracker = require('../utils/metricsTracker');
app.use('/api', (req, res, next) => {
    const start = process.hrtime();
    metricsTracker.recordRequest(req);
    
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const ms = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
        if (metricsTracker.recordLatency) {
            metricsTracker.recordLatency(ms);
        }
    });
    
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

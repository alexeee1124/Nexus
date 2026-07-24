const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Nexus V2 Middleman API is Online', timestamp: new Date() });
});

// We will export the app for Vercel instead of calling app.listen directly
// In local development, we can run a dev server script later.
module.exports = app;

const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');

// Import the existing express app
const app = require('./api/index.js');

// Create the HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Pass the io instance to the request object if needed by other routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all route to serve the frontend for SPA navigation (if needed)
// Keep-Alive Ping Route for Render
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize Realtime Engine
const realtime = require('./realtime');
realtime.init(io);

// Start the server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`[NEXUS C2] Server running on port ${PORT}`);
});

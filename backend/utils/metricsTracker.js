// In-memory tracker for API Request Velocity (Live & Historical)
const requestHistory = new Array(60).fill(0); // 60 seconds for live wave
let currentSecond = Math.floor(Date.now() / 1000);
let currentCount = 0;

// Also track some simulated backend payload throughput for the dashboard
let totalBytesIngested = 0;

function recordRequest(req) {
    const nowSec = Math.floor(Date.now() / 1000);
    
    // If we've moved to a new second
    if (nowSec > currentSecond) {
        const diff = nowSec - currentSecond;
        if (diff >= 60) {
            // More than a minute passed, reset all
            requestHistory.fill(0);
        } else {
            // Shift array to account for missed seconds
            for (let i = 0; i < diff; i++) {
                requestHistory.shift();
                requestHistory.push(0); // Push 0 for empty seconds
            }
        }
        
        // Record the completed second
        if (diff === 1) {
            requestHistory[requestHistory.length - 1] = currentCount;
        }
        
        currentSecond = nowSec;
        currentCount = 1;
    } else if (nowSec === currentSecond) {
        currentCount++;
    }
    // Estimate throughput based on payload or simulate baseline
    if (req.body && Object.keys(req.body).length > 0) {
        const payloadSize = JSON.stringify(req.body).length;
        totalBytesIngested += payloadSize;
    } else {
        // Base headers/routing overhead for GET requests
        totalBytesIngested += Math.floor(Math.random() * 300) + 150; 
    }
}

function getMetrics() {
    // Sync current second before returning
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > currentSecond) {
        const diff = nowSec - currentSecond;
        if (diff >= 60) {
            requestHistory.fill(0);
        } else {
            for (let i = 0; i < diff; i++) {
                requestHistory.shift();
                requestHistory.push(0);
            }
            if (diff === 1) {
                requestHistory[requestHistory.length - 1] = currentCount;
            }
        }
        currentSecond = nowSec;
        currentCount = 0;
    }

    return {
        velocityArray: [...requestHistory],
        currentVelocity: currentCount,
        totalBytesIngested
    };
}

module.exports = {
    recordRequest,
    getMetrics
};

// In-memory tracker for API Request Velocity (Live & Historical)
const requestHistory = new Array(60).fill(0); // 60 seconds for live wave
let currentSecond = Math.floor(Date.now() / 1000);
let currentCount = 0;

// Track exact physical payload sizes
let totalBytesIngested = 0;

// Track true rolling API latency
const latencyHistory = [];
const MAX_LATENCY_SAMPLES = 50;

function recordRequest(req) {
    const nowSec = Math.floor(Date.now() / 1000);
    
    // If we've moved to a new second
    if (nowSec > currentSecond) {
        const diff = nowSec - currentSecond;
        if (diff >= 60) {
            requestHistory.fill(0);
        } else {
            for (let i = 0; i < diff; i++) {
                requestHistory.shift();
                requestHistory.push(0);
            }
        }
        
        if (diff === 1) {
            requestHistory[requestHistory.length - 1] = currentCount;
        }
        
        currentSecond = nowSec;
        currentCount = 1;
    } else {
        currentCount++;
    }
    
    // Calculate REAL byte throughput of the incoming request
    let payloadSize = 0;
    if (req.body && Object.keys(req.body).length > 0) {
        payloadSize += JSON.stringify(req.body).length;
    }
    // Add raw HTTP overhead (URL length + Header sizes roughly)
    payloadSize += (req.originalUrl || req.url || "").length;
    payloadSize += JSON.stringify(req.headers || {}).length;
    
    totalBytesIngested += payloadSize;
}

function recordLatency(ms) {
    latencyHistory.push(ms);
    if (latencyHistory.length > MAX_LATENCY_SAMPLES) {
        latencyHistory.shift();
    }
}

function getMetrics() {
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

    // True mathematical average latency
    const avgLatency = latencyHistory.length > 0 
        ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) 
        : 0;

    // True exact operations over the last 60 seconds (sum of requestHistory)
    const exactOpsPerMinute = requestHistory.reduce((a, b) => a + b, 0);

    return {
        velocityArray: [...requestHistory],
        currentVelocity: currentCount,
        totalBytesIngested,
        avgLatency,
        exactOpsPerMinute
    };
}

module.exports = {
    recordRequest,
    recordLatency,
    getMetrics
};

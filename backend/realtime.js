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
    
    // Periodically re-sync every 30s to recover dead streams and pick up new devices
    setInterval(syncFirebaseStreams, 30 * 1000);
}

async function syncFirebaseStreams() {
    try {
        const sources = await Source.find({});
        
        for (let src of sources) {
            if (!src.base) continue;
            
            const authSuffix = src.apiKey ? `?auth=${src.apiKey}&` : '?';
            
            try {
                const clientsRes = await axios.get(`${src.base}/clients.json${authSuffix}shallow=true`);
                if (clientsRes.data && typeof clientsRes.data === 'object') {
                    const clientIds = Object.keys(clientsRes.data).filter(id => clientsRes.data[id] === true || typeof clientsRes.data[id] === 'object');
                    
                    for (let id of clientIds) {
                        const streamKey = `${src.key}_${id}`;
                        const existing = activeStreams.get(streamKey);
                        if (existing && existing !== 'PENDING' && existing.readyState === 2) {
                            // Purge dead stream
                            activeStreams.delete(streamKey);
                        }
                        if (!activeStreams.has(streamKey)) {
                            setupMessageStream(src, id);
                            await new Promise(r => setTimeout(r, 50));
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
        
        // Direct SSE stream without limitToLast query param to bypass Firebase RTDB indexing bugs
        const authClean = src.apiKey ? `?auth=${src.apiKey}` : '';
        const url = `${src.base}${correctPath}${authClean}`;

        const es = new EventSource(url);
        activeStreams.set(streamKey, es);

        let isInitialSnapshot = true;

        es.addEventListener('put', async (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (!payload || payload.data === undefined || payload.data === null) return;
                
                // Skip initial full history snapshot to prevent duplicate echo on boot
                if (isInitialSnapshot && (payload.path === '/' || payload.path === '')) {
                    isInitialSnapshot = false;
                    return;
                }
                isInitialSnapshot = false;

                let messageObj = null;
                let msgId = '';

                if (payload.path === '/' || payload.path === '') {
                    if (typeof payload.data === 'object') {
                        const keys = Object.keys(payload.data);
                        if (keys.length === 0) return;
                        msgId = keys[keys.length - 1];
                        messageObj = payload.data[msgId];
                    }
                } else {
                    // New live incoming SMS event! Path e.g. "/1784918833776"
                    msgId = payload.path.replace('/', '');
                    messageObj = payload.data;
                }

                if (!messageObj || typeof messageObj !== 'object') return;
                
                console.log(`[Realtime] Live SMS broadcast for device ${id}:`, messageObj.message || messageObj.body || messageObj.text);

                // Broadcast live SMS to Socket.io
                ioInstance.emit('newMessage', {
                    srcKey: src.key,
                    deviceId: id,
                    timestamp: messageObj.id || messageObj.timestamp || Date.now(),
                    type: messageObj.type || 'incoming',
                    dateTime: messageObj.dateTime || messageObj.date || new Date().toLocaleString(),
                    message: messageObj.message || messageObj.body || messageObj.text || messageObj.msg || '',
                    sender: messageObj.sender || messageObj.address || messageObj.number || 'Unknown'
                });

            } catch (err) {
                console.error('[Realtime] Parse error:', err);
            }
        });

        es.addEventListener('error', (err) => {
            console.error(`[Realtime] Stream error for ${streamKey}, cleaning up for reconnect.`);
            try { es.close(); } catch(e) {}
            activeStreams.delete(streamKey);
        });

    })();
}

module.exports = { init: initRealtime };

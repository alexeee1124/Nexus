const { EventSource } = require('eventsource');
const URL = 'https://bulbul8084-9a5df-default-rtdb.firebaseio.com/messages/1564f49139a99bae.json';

console.log("Connecting direct stream (NO limitToLast)...");
const es = new EventSource(URL);

let isFirst = true;

es.addEventListener('open', () => {
    console.log("--> STREAM CONNECTED SUCCESSFULLY!");
});

es.addEventListener('put', (e) => {
    const payload = JSON.parse(e.data);
    if (isFirst) {
        console.log("--> INITIAL SNAPSHOT RECEIVED. Path:", payload.path, "Keys count:", Object.keys(payload.data || {}).length);
        isFirst = false;
    } else {
        console.log("--> REALTIME LIVE SMS EVENT RECEIVED! Path:", payload.path, "Data:", JSON.stringify(payload.data));
    }
});

es.addEventListener('error', (err) => {
    console.log("--> STREAM ERROR:", err.message || err);
});

setTimeout(() => {
    console.log("Test finished.");
    process.exit();
}, 10000);

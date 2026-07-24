const { EventSource } = require('eventsource');
const URL = 'https://bulbul8084-9a5df-default-rtdb.firebaseio.com/messages/1564f49139a99bae.json?orderBy="$key"&limitToLast=1';

console.log("Connecting EventSource to live path:", URL);
const es = new EventSource(URL);

es.addEventListener('open', () => {
    console.log("--> EVENTSOURCE OPENED!");
});

es.addEventListener('put', (e) => {
    console.log("--> PUT EVENT RECEIVED:", e.data);
});

es.addEventListener('patch', (e) => {
    console.log("--> PATCH EVENT RECEIVED:", e.data);
});

es.addEventListener('error', (e) => {
    console.log("--> EVENTSOURCE ERROR:", e.status, e.message);
});

setTimeout(() => {
    console.log("Done test.");
    process.exit();
}, 12000);

const { EventSource } = require('eventsource');
const DB_URL = 'https://hacker-news.firebaseio.com/v0/updates.json?orderBy="$key"&limitToLast=1';
console.log('Connecting...');
const es = new EventSource(DB_URL);
es.addEventListener('put', (e) => {
    console.log('PUT EVENT:', e.data.substring(0, 50));
});
es.addEventListener('error', (e) => {
    console.log('ERR:', e.status, e.message);
});
setTimeout(() => process.exit(), 5000);

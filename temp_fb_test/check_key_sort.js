const axios = require('axios');
const BASE = 'https://bulbul8084-9a5df-default-rtdb.firebaseio.com/messages/1564f49139a99bae.json';

async function checkKeys() {
    try {
        const res = await axios.get(`${BASE}?orderBy="$key"&limitToLast=5`);
        console.log("limitToLast=5 keys:", Object.keys(res.data || {}));
        
        const res1 = await axios.get(`${BASE}?orderBy="$key"&limitToLast=1`);
        console.log("limitToLast=1 key:", Object.keys(res1.data || {}));
        
        const full = await axios.get(`${BASE}?shallow=true`);
        const allKeys = Object.keys(full.data || {});
        console.log("Total keys:", allKeys.length);
        console.log("First 3 keys:", allKeys.slice(0, 3));
        console.log("Last 3 keys in raw object:", allKeys.slice(-3));
    } catch(e) {
        console.log("Error:", e.message);
    }
}

checkKeys();

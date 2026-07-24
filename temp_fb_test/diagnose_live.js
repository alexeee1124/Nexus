const axios = require('axios');
const BASE = 'https://bulbul8084-9a5df-default-rtdb.firebaseio.com';

async function diagnose() {
    console.log("Diagnosing Firebase URL:", BASE);
    
    // 1. Check shallow clients
    try {
        const res = await axios.get(`${BASE}/clients.json?shallow=true`);
        console.log("Shallow /clients.json status:", res.status);
        console.log("Shallow /clients.json data:", Object.keys(res.data || {}).slice(0, 5));
        
        const clientIds = Object.keys(res.data || {});
        if (clientIds.length > 0) {
            const sampleId = clientIds[0];
            console.log("\nTesting paths for sample client ID:", sampleId);
            
            const paths = [
                `/messages/${sampleId}.json`,
                `/clients/${sampleId}/messages.json`,
                `/sms/${sampleId}.json`,
                `/clients/${sampleId}/sms.json`
            ];
            
            for (let p of paths) {
                try {
                    const pRes = await axios.get(`${BASE}${p}?shallow=true`);
                    console.log(`Path ${p} => data keys count:`, pRes.data ? (typeof pRes.data === 'object' ? Object.keys(pRes.data).length : 'non-object') : 'null/empty');
                    if (pRes.data) {
                        // Fetch 1 item full
                        const itemRes = await axios.get(`${BASE}${p}?orderBy="$key"&limitToLast=1`);
                        console.log(`  Sample data from ${p}:`, JSON.stringify(itemRes.data));
                    }
                } catch(e) {
                    console.log(`Path ${p} => error:`, e.message);
                }
            }
        }
    } catch(e) {
        console.log("Error querying /clients.json:", e.message);
    }
}

diagnose();

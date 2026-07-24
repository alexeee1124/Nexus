const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Source = require('./models/Source');
const https = require('https');

async function testFirebase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const source = await Source.findOne({ base: { $ne: null } });
        if (!source) {
            console.log('No sources found');
            process.exit(0);
        }
        
        console.log('Testing source:', source.label);
        const authSuffix = source.apiKey ? `?auth=${source.apiKey}` : '';
        const url = `${source.base}/clients.json${authSuffix}&shallow=true`; // just get keys first
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                const firstClient = Object.keys(parsed)[0];
                console.log('First client ID:', firstClient);
                
                // Now fetch that client
                const clientUrl = `${source.base}/clients/${firstClient}.json${authSuffix}`;
                https.get(clientUrl, (res2) => {
                    let cdata = '';
                    res2.on('data', d => cdata += d);
                    res2.on('end', () => {
                        const cparsed = JSON.parse(cdata);
                        console.log('Client keys:', Object.keys(cparsed));
                        if (cparsed.messages) {
                            console.log('Messages exist in client node! Count:', Object.keys(cparsed.messages).length);
                        } else {
                            console.log('No messages in client node.');
                            // Test if it's in /messages/id
                            const msgUrl = `${source.base}/messages/${firstClient}.json${authSuffix}&shallow=true`;
                            https.get(msgUrl, (res3) => {
                                let mdata = '';
                                res3.on('data', d => mdata += d);
                                res3.on('end', () => {
                                    console.log('Root messages response:', mdata);
                                    process.exit(0);
                                });
                            });
                        }
                    });
                });
            });
        }).on('error', e => console.error(e));
        
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testFirebase();

const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Replace the broken executeDeleteMsg logic
const oldDeleteLogic = `    try {
        await proxyFirebase(dev._src, dev._id, p, 'DELETE');
        let msgs = cache[dev._src+':'+dev._id];
        if (msgs) {`;

const newDeleteLogic = `    try {
        const res = await fetch(\`/api/messages/\${dev._src}/\${dev._id}\`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${localStorage.getItem('token')}\`
            },
            body: JSON.stringify({ fbPath: msg._fbPath, fbKey: msg._fbKey })
        });
        
        if (!res.ok) throw new Error('Delete failed');

        let msgs = cache[dev._src+':'+dev._id];
        if (msgs) {`;

html = html.replace(oldDeleteLogic, newDeleteLogic);
fs.writeFileSync('frontend/index.html', html);
console.log('Fixed executeDeleteMsg');

const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

const regex = /async function executeDeleteMsg\(\) \{[\s\S]*?\}(?=\s*async function|\s*\/\/ --- APK EXTRACTION)/;

const newFunc = `async function executeDeleteMsg() {
    if(!msgToDelete) return;
    const { dev, msg } = msgToDelete;
    const btn = document.getElementById('delMsgBtn');
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#fff;"></div>';
    
    try {
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
        if (msgs) {
            cache[dev._src+':'+dev._id] = msgs.filter(x => x._localId != msg._localId);
        }
        renderTab(true);
        document.getElementById('delMsgModal').classList.remove('active');
        msgToDelete = null;
    } catch(e) {
        customAlert('Delete Failed', 'Failed to delete the message. The database may be locked.', 'error');
    } finally {
        btn.innerHTML = 'Delete';
    }
}`;

html = html.replace(regex, newFunc);
fs.writeFileSync('frontend/index.html', html);
console.log('Fixed executeDeleteMsg properly');

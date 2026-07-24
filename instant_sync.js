const fs = require('fs');

// --- 1. BACKEND CHANGES ---
let apiCode = fs.readFileSync('backend/routes/api.js', 'utf8');

const newPostDatabases = `router.post('/databases', protect, async (req, res) => {
    try {
        const { key, label, base, apiKey, color } = req.body;
        const owner = req.user.role === 'admin' ? null : req.user._id;
        
        // Server-side Deduplication: Reject identical Firebase URLs system-wide
        const existingBase = await Source.findOne({ base });
        if (existingBase) {
            return res.status(400).json({ success: false, message: 'Firebase URL is already connected to Nexus' });
        }
        
        // Fetch devices and calculate stats INSTANTLY before saving
        const authSuffix = apiKey ? \`?auth=\${apiKey}\` : '';
        const fetchUrl = \`\${base}/clients.json\${authSuffix}\`;
        
        let newDevices = [];
        let stats = { total: 0, online: 0, offline: 0 };
        
        const data = await fetchFirebase(fetchUrl);
        
        if (data && typeof data === 'object') {
            const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v]).filter(x => x[1]) : Object.entries(data);
            for (const [id, info] of entries) {
                if (info && typeof info === 'object') {
                    newDevices.push({
                        _id: id,
                        _src: key,
                        ...info
                    });
                    
                    stats.total++;
                    if (info.status === true) {
                        stats.online++;
                    } else {
                        stats.offline++;
                    }
                }
            }
        } else {
             // If completely unreachable, return a connection failure to frontend
             return res.status(400).json({ success: false, message: 'Failed to connect to Firebase URL or invalid API Key.' });
        }
        
        const source = await Source.create({
            key, label, base, apiKey, color, owner
        });
        
        res.status(201).json({ success: true, source, stats, newDevices });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Database key already exists' });
        res.status(500).json({ success: false, message: 'Server error creating database' });
    }
});`;

apiCode = apiCode.replace(/router\.post\('\/databases', protect, async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: 'Server error creating database' \}\);\s*\}\s*\}\);/, newPostDatabases);
fs.writeFileSync('backend/routes/api.js', apiCode);

// --- 2. FRONTEND CHANGES ---
let htmlCode = fs.readFileSync('frontend/index.html', 'utf8');

const newAddDb = `async function addDb() {
    const lbl = document.getElementById('newDbLabel').value.trim();
    let url = document.getElementById('newDbUrl').value.trim();
    
    if(!lbl || !url) return customAlert('Missing Fields', 'Provide both a label and a valid Firebase URL.');
    if(url.endsWith('/')) url = url.slice(0, -1);
    
    const key = lbl.toLowerCase().replace(/[^a-z0-9]/g, '');
    const apiKey = document.getElementById('newDbApiKey').value.trim();
    
    const btn = document.getElementById('addDbBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }
    
    try {
        const payload = { key, label: lbl, base: url };
        if (apiKey) payload.apiKey = apiKey;
        
        const res = await fetch('/api/databases', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${localStorage.getItem('token')}\`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (!data.success) {
            resetAddBtn(btn);
            return customAlert('Connection Failed', data.message || 'Could not validate database.');
        }
        
        // Push locally for immediate UI response
        if (editingDbIdx >= 0) {
            SOURCES[editingDbIdx] = data.source;
        } else {
            SOURCES.push(data.source);
        }
        
        // Push the newly discovered devices instantly into the UI without doing a global fetchAll
        if (data.newDevices && data.newDevices.length > 0) {
             devices.push(...data.newDevices);
             devices.sort((a,b) => (b.status?1:0) - (a.status?1:0));
        }
        
        if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();
        if (typeof updateStats === 'function') updateStats();
        
        resetAddBtn(btn);
        
        document.getElementById('newDbLabel').value = '';
        document.getElementById('newDbUrl').value = '';
        document.getElementById('newDbApiKey').value = '';
        editingDbIdx = -1;
        
        const addFormTitle = document.getElementById('addFormTitle');
        if (addFormTitle) {
            addFormTitle.textContent = 'Add New Source';
            addFormTitle.style.color = 'var(--text-muted)';
        }
        
        const stats = data.stats || { total: 0, online: 0, offline: 0 };
        const detailsHtml = \`
            <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: center; font-family: var(--font-mono);">
                <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 20px; padding: 6px 12px; font-size: 0.75rem; color: var(--cyan); display: flex; align-items: center; gap: 6px; font-weight: 700; box-shadow: 0 2px 10px rgba(0,240,255,0.1);">
                    Total <span style="background: var(--cyan); color: #000; border-radius: 10px; padding: 2px 6px;">\${stats.total}</span>
                </div>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 6px 12px; font-size: 0.75rem; color: var(--green); display: flex; align-items: center; gap: 6px; font-weight: 700; box-shadow: 0 2px 10px rgba(16,185,129,0.1);">
                    Online <span style="background: var(--green); color: #000; border-radius: 10px; padding: 2px 6px;">\${stats.online}</span>
                </div>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 20px; padding: 6px 12px; font-size: 0.75rem; color: var(--red); display: flex; align-items: center; gap: 6px; font-weight: 700; box-shadow: 0 2px 10px rgba(239,68,68,0.1);">
                    Offline <span style="background: var(--red); color: #000; border-radius: 10px; padding: 2px 6px;">\${stats.offline}</span>
                </div>
            </div>
        \`;
        customAlert('Connection Successful', \`Database <b>'\${lbl}'</b> was securely connected and saved.<br>\${detailsHtml}\`, 'success');
        
    } catch (e) {
        resetAddBtn(btn);
        return customAlert('API Error', 'Failed to communicate with proxy backend.', 'error');
    }
}`;

htmlCode = htmlCode.replace(/async function addDb\(\) \{[\s\S]*?resetAddBtn\(btn\);\s*return customAlert\('API Error', 'Failed to communicate with proxy backend\.', 'error'\);\s*\}\s*\}/, newAddDb);
fs.writeFileSync('frontend/index.html', htmlCode);

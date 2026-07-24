const fs = require('fs');

let code = fs.readFileSync('frontend/index.html', 'utf8');

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
        
        await fetchAll(true);
        if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();
        
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
        
        // Now calculate stats purely from the frontend array since the backend doesn't send mock stats anymore
        const sDevs = devices.filter(d => d._src === key);
        const stats = {
            total: sDevs.length,
            online: sDevs.filter(d => d.status).length,
            offline: sDevs.length - sDevs.filter(d => d.status).length
        };
        
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

code = code.replace(/async function addDb\(\) \{[\s\S]*?resetAddBtn\(btn\);\s*return customAlert\('API Error', 'Failed to communicate with proxy backend\.'\);\s*\}\s*\}/, newAddDb);


const newDeleteDb = `async function deleteDb(key) {
    customConfirm('Disconnect Source', \`Are you sure you want to permanently disconnect this Firebase source (\${key})? All associated devices and intelligence will be dropped.\`, async () => {
        try {
            const res = await fetch(\`/api/databases/\${key}\`, {
                method: 'DELETE',
                headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
            });
            const data = await res.json();
            
            if (data.success) {
                customAlert('Source Disconnected', \`Database '\${key}' has been disconnected.\`, 'success');
                // Wait for background sync to complete then force the grid to re-render
                await fetchAll(true);
                if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();
            } else {
                customAlert('Disconnection Failed', data.message || 'Could not disconnect database.', 'error');
            }
        } catch(e) {
            customAlert('API Error', 'Failed to communicate with proxy backend.', 'error');
        }
    });
}`;
code = code.replace(/async function deleteDb\(key\) \{[\s\S]*?customAlert\('API Error', 'Failed to communicate with proxy backend\.', 'error'\);\s*\}\s*\}\);\s*\}/, newDeleteDb);


fs.writeFileSync('frontend/index.html', code);

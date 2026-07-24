const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Fix copyToClip innerText -> innerHTML
html = html.replace(/const orig = btnEl\.innerText;/g, 'const orig = btnEl.innerHTML;');
html = html.replace(/btnEl\.innerText = '✅';/g, "btnEl.innerHTML = '✅';");
html = html.replace(/btnEl\.innerText = orig;/g, "btnEl.innerHTML = orig;");

// 2. Fix openAddDbDrawer state reset
const openAddDbRegex = /function openAddDbDrawer\(\) \{[\s\S]*?modal\.classList\.add\('active'\);\s*\}/;
const newOpenAddDb = `function openAddDbDrawer() {
    const modal = document.getElementById('dbModal');
    if (modal) {
        const leftPanel = modal.querySelector('.bulk-left');
        if (leftPanel) leftPanel.style.display = 'none';
        modal.classList.add('active');
        
        editingDbIdx = -1;
        if(document.getElementById('newDbLabel')) document.getElementById('newDbLabel').value = '';
        if(document.getElementById('newDbUrl')) document.getElementById('newDbUrl').value = '';
        if(document.getElementById('newDbApiKey')) document.getElementById('newDbApiKey').value = '';
        
        const addFormTitle = document.getElementById('addFormTitle');
        if (addFormTitle) {
            addFormTitle.textContent = 'Add / Edit Database Node';
            addFormTitle.style.color = '#fff';
        }
        const btn = document.getElementById('addDbBtn');
        if(btn) {
            btn.textContent = '+ Connect Source';
            btn.style.background = 'var(--cyan)';
            btn.style.color = '#000';
        }
    }`;
html = html.replace(openAddDbRegex, newOpenAddDb);

// 3. Fix addDb POST/PUT logic
const addDbFetchRegex = /const res = await fetch\('\/api\/databases', \{[\s\S]*?body: JSON\.stringify\(payload\)\s*\}\);/;
const newAddDbFetch = `let res;
        if (editingDbIdx >= 0) {
            const srcKey = SOURCES[editingDbIdx].key;
            res = await fetch(\`/api/databases/\${srcKey}\`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${localStorage.getItem('token')}\`
                },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/databases', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${localStorage.getItem('token')}\`
                },
                body: JSON.stringify(payload)
            });
        }`;
html = html.replace(addDbFetchRegex, newAddDbFetch);

// 4. Force override Header Buttons (fixing the wrapping and SVG)
const headerButtonsRegex = /<div style="display: flex; gap: 12px; align-items: center;">[\s\S]*?<\/div>/;
const newHeaderButtons = `<div style="display: flex; gap: 12px; align-items: center;">
                        <input type="file" id="dbBulkAddInputAdmin" accept=".txt" style="display: none;" onchange="handleDbBulkAdd(event)">
                        <button class="f-btn" style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.2); color: var(--cyan); padding: 8px 16px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap;" onclick="document.getElementById('dbBulkAddInputAdmin').click()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Bulk Add
                        </button>
                        <button class="f-btn" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-main); padding: 8px 16px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap;" onclick="exportDatabases()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export
                        </button>
                        <button class="f-btn" style="background: var(--cyan); color: #000; padding: 8px 16px; font-weight: 800; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap;" onclick="openAddDbDrawer()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Source
                        </button>
                    </div>`;
html = html.replace(headerButtonsRegex, newHeaderButtons);


// 5. Force override DB Icons
const dbIconsRegex = /<div style="display: flex; gap: 8px;">\s*<button class="icon-btn" title="Copy URL"[\s\S]*?<\/div>/g;
const newDbIcons = `<div style="display: flex; gap: 8px;">
                    <button title="Copy URL" onclick="copyToClip('\${s.base || s.url || ''}', this)" style="color: var(--cyan); background: rgba(0,240,255,0.1); border: 1px solid rgba(0,240,255,0.2); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; transition: 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></button>
                    <button title="Edit Database" onclick="editDb(\${idx})" style="color: var(--amber); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; transition: 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                    <button title="Delete Database" onclick="deleteDb('\${s.key}')" style="color: var(--red); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; transition: 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
                </div>`;
html = html.replace(dbIconsRegex, newDbIcons);

// 6. Force override URL Box
const urlBoxRegex = /<div style="background: rgba\(0,0,0,0\.3\)[^>]*>\s*\$\{esc\(s\.base \|\| s\.url \|\| 'URL Hidden'\)\}\s*<\/div>/g;
const newUrlBox = `<div style="background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 12px 16px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-main); font-weight: 500; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                \${esc(s.base || s.url || 'URL Hidden')}
            </div>`;
html = html.replace(urlBoxRegex, newUrlBox);


fs.writeFileSync('frontend/index.html', html);
console.log('Robust patch complete');

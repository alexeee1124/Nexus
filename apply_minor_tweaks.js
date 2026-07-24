const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Edit the addDb success popup logic
const successAlertRegex = /const stats = data\.stats \|\| \{ total: 0, online: 0, offline: 0 \};[\s\S]*?customAlert\('Connection Successful', `Database <b>'\$\{lbl\}'<\/b> was securely connected and saved\.<br>\$\{detailsHtml\}`, 'success'\);/;

const newSuccessAlert = `const wasEdit = (editingDbIdx >= 0);
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
        
        if (wasEdit) {
            customAlert('Update Successful', \`Database <b>'\${lbl}'</b> was successfully updated and saved.\`, 'success');
        } else {
            customAlert('Connection Successful', \`Database <b>'\${lbl}'</b> was securely connected and saved.<br>\${detailsHtml}\`, 'success');
        }`;

html = html.replace(successAlertRegex, newSuccessAlert);

// We must also prevent editingDbIdx from being reset BEFORE this logic block runs.
// Right now, `editingDbIdx = -1;` is called BEFORE the success alert block.
// So we must remove it from where it is and place it AFTER.
html = html.replace(/editingDbIdx = -1;\s*const addFormTitle = document\.getElementById\('addFormTitle'\);/, `const addFormTitle = document.getElementById('addFormTitle');`);

const finalAlertBlock = `if (wasEdit) {
            customAlert('Update Successful', \`Database <b>'\${lbl}'</b> was successfully updated and saved.\`, 'success');
        } else {
            customAlert('Connection Successful', \`Database <b>'\${lbl}'</b> was securely connected and saved.<br>\${detailsHtml}\`, 'success');
        }
        editingDbIdx = -1;`;
html = html.replace(/if \(wasEdit\) \{[\s\S]*?\}, 'success'\);\s*\}/, finalAlertBlock);


// 2. Add Back to Top Button
const gridRegex = /<div id="adminDbGrid" style="display: grid; grid-template-columns: repeat\(auto-fill, minmax\(380px, 1fr\)\); gap: 20px;">\s*<!-- Database Cards injected here -->\s*<\/div>/;
const gridReplacement = `<div id="adminDbGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px;">
                    <!-- Database Cards injected here -->
                </div>
                <button onclick="document.getElementById('adminTabDatabases').scrollTo({top: 0, behavior: 'smooth'})" style="position: fixed; bottom: 40px; right: 40px; background: rgba(0,240,255,0.1); border: 1px solid rgba(0,240,255,0.3); color: var(--cyan); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); backdrop-filter: blur(4px); transition: 0.2s; z-index: 100;" onmouseover="this.style.background='var(--cyan)'; this.style.color='#000'" onmouseout="this.style.background='rgba(0,240,255,0.1)'; this.style.color='var(--cyan)'" title="Back to Top">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>`;

html = html.replace(gridRegex, gridReplacement);

fs.writeFileSync('frontend/index.html', html);
console.log("Tweaks applied successfully.");

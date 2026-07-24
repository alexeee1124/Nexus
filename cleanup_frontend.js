const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Remove scanTelecom and the Profex Engine entirely
const scanTelecomRegex = /\/\/ ═══ TELECOM INTELLIGENCE ENGINE \(PROFEX\) ═══[\s\S]*?function scanTelecom[\s\S]*?\}\s*(?=\/\/ ═══ BULK SMS MANAGER ═══)/;
html = html.replace(scanTelecomRegex, '');

// 2. Remove all UI toggles and state assignments for CAN_VIEW_TELECOM and canViewTelecomIntel
html = html.replace(/<label[^>]*>\s*<div class="switch">\s*<input type="checkbox" id="permViewIntel">\s*<span class="slider"><\/span>\s*<\/div>\s*Grant Telecom Intel Access\s*<\/label>/g, '');
html = html.replace(/<label[^>]*>\s*<div class="switch">\s*<input type="checkbox" \$\{u\.permissions && u\.permissions\.canViewTelecomIntel \? 'checked' : ''\} onchange="toggleUserPerm\('\$\{u\._id\}', 'canViewTelecomIntel', this\.checked\)">\s*<span class="slider"><\/span>\s*<\/div>\s*<span[^>]*>Telecom Intel Access<\/span>\s*<\/label>/g, '');
html = html.replace(/window\.CAN_VIEW_TELECOM = data\.role === 'admin' \|\| data\.permissions\?\.canViewTelecomIntel;/g, '');
html = html.replace(/const canViewTelecomIntel = document\.getElementById\('permViewIntel'\)\.checked;/g, '');
html = html.replace(/canViewTelecomIntel/g, ''); // Nuke any remaining references safely in the frontend payload

// Fix trailing commas if they appeared in payload mapping
html = html.replace(/permissions:\s*\{\s*canEditPhone,\s*canUseAutoDiscovery,\s*\}/g, 'permissions: { canEditPhone, canUseAutoDiscovery }');


// 3. Purge Dead Code: renderUserList()
const renderUserListRegex = /async function renderUserList\(\) \{[\s\S]*?\}(?=\s*async function createUser\(\) \{)/;
html = html.replace(renderUserListRegex, '');

// 4. Purge Dead Code: openUserManager()
const openUserManagerRegex = /async function openUserManager\(\) \{[\s\S]*?\}(?=\s*async function renderUserList)/;
// Note: If renderUserList is already gone, just match up to the next block
const openUserManagerRegex2 = /async function openUserManager\(\) \{[\s\S]*?\}(?=\s*(async function createUser\(\) \{|async function renderUserList))/;
html = html.replace(openUserManagerRegex2, '');


// 5. Fix remaining untyped customAlerts
html = html.replace(
    /customAlert\('Invite Accepted', `Securely connected to <b>\$\{label\}<\/b>\. This \nis a temporary session - it will not be saved to your vault\.`\);/g,
    "customAlert('Invite Accepted', `Securely connected to <b>${label}</b>. This \nis a temporary session - it will not be saved to your vault.`, 'success');"
);
html = html.replace(
    /customAlert\('Invite Link Copied', `\$\{copied \? 'A secure invite link' : 'The invite link'\} for <b>\$\{esc\(s\.label\)\}<\/b> \$\{copied \? 'has been copied to your clipboard' : 'is ready'\}. Anyone with this link can connect instantly\.\$\{!copied \? '<br><br><code style="word-break:break-all;font-size:0\.75rem;">' \+ esc\(inviteUrl\) \+ '<\/code>' : ''\}`\);/g,
    "customAlert('Invite Link Copied', `${copied ? 'A secure invite link' : 'The invite link'} for <b>${esc(s.label)}</b> ${copied ? 'has been copied to your clipboard' : 'is ready'}. Anyone with this link can connect instantly.${!copied ? '<br><br><code style=\"word-break:break-all;font-size:0.75rem;\">' + esc(inviteUrl) + '</code>' : ''}`, 'success');"
);
html = html.replace(
    /customAlert\('API Error', 'Failed to communicate with proxy backend\.'\);/g,
    "customAlert('API Error', 'Failed to communicate with proxy backend.', 'error');"
);
html = html.replace(
    /customAlert\("Export Failed", "No databases connected\."\);/g,
    'customAlert("Export Failed", "No databases connected.", "error");'
);


fs.writeFileSync('frontend/index.html', html);
console.log('Frontend cleanup complete.');

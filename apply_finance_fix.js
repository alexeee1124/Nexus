const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Fix TXN_REGEX
html = html.replace(
    /(const TXN_REGEX = \[\s*)\/\(\?:debited\|credited\|withdrawn\|deposited\)\(\?:\\s\+\(\?:by\|with\|for\|of\)\)\?\\s\+\(\?:INR\|Rs\\\.?\?\|₹\)\\s\*([^\/]+)\/i,/g,
    '$1/(?:debited|credited|withdrawn|deposited)(?:\\s+(?:by|with|for|of))?\\s+(?:INR|Rs\\.?|₹)?\\s*([0-9,]+\\.?[0-9]*)/i,'
);

html = html.replace(
    /\/\(\?:INR\|Rs\\\.?\?\|₹\)\\s\*\(\[0-9,\]\+\\\.\[0-9\]\*\)\\s\+\(\?:debited\|credited\|withdrawn\)\/i/g,
    '/(?:INR|Rs\\.?|₹)?\\s*([0-9,]+\\.?[0-9]*)\\s+(?:debited|credited|withdrawn)/i'
);

// 2. Fix 3-month filter and add sorting
const oldFilter = `                    // 3-Month Date Filter
                    const msgDateStr = m.dateTime || m.date || '';
                    if (msgDateStr) {
                        const msgDate = new Date(msgDateStr);
                        const threeMonthsAgo = new Date();
                        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                        if (msgDate < threeMonthsAgo) return; // Skip if older than 3 months
                    }`;

const newFilter = `                    // 3-Month Filter using ID
                    if (m.id) {
                        const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
                        if (m.id < threeMonthsAgo) return;
                    }`;

html = html.replace(oldFilter, newFilter);

const oldIf = `if (parsedBankMsgs.length === 0) {`;
const newIf = `parsedBankMsgs.sort((a,b) => (b.rawMsg.id || 0) - (a.rawMsg.id || 0));
            if (parsedBankMsgs.length === 0) {`;

html = html.replace(oldIf, newIf);

// 3. Fix CSS Grid gap (height: 100%)
html = html.replace(
    /style="background:var\(--bg-card\); border:1px solid var\(--border\); border-radius:var\(--radius-md\); padding:16px; display:flex; flex-direction:column; gap:12px; transition:var\(--trans\);"/g,
    'style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; display:flex; flex-direction:column; gap:12px; transition:var(--trans); height:100%; box-sizing:border-box;"'
);

fs.writeFileSync('frontend/index.html', html);
console.log('Finance UI fixed');

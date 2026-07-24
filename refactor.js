const fs = require('fs');

// --- 1. BACKEND FIXES (api.js) ---
let apiCode = fs.readFileSync('backend/routes/api.js', 'utf8');

// Fix A: Remove duplicate /admin/users route
apiCode = apiCode.replace(/\/\/ @route   GET \/api\/admin\/users[\s\S]*?module\.exports = router;/, 'module.exports = router;');

// Fix B: API Key Injection for Devices
apiCode = apiCode.replace(/const data = await fetchFirebase\(`\$\{src\.base\}\/clients\.json`\);/, "const authSuffix = src.apiKey ? `?auth=${src.apiKey}` : '';\n            const data = await fetchFirebase(`${src.base}/clients.json${authSuffix}`);");

// Fix C: API Key Injection for Messages
apiCode = apiCode.replace(/const data = await fetchFirebase\(`\$\{source\.base\}\$\{p\}`\);/, "const authSuffix = source.apiKey ? `?auth=${source.apiKey}` : '';\n            const data = await fetchFirebase(`${source.base}${p}${authSuffix}`);");

// Fix D: Remove Mock Stats from POST /databases
apiCode = apiCode.replace(/\/\/ Return a mock stats object to prevent the frontend detailsHtml from showing undefined\s*const stats = \{ total: 0, online: 0, offline: 0 \};\s*res\.status\(201\)\.json\(\{ success: true, source, stats \}\);/, 'res.status(201).json({ success: true, source });');

// Fix E: Make execute endpoint accept dynamic methods, and delete the hardcoded delete endpoint
const oldExecute = /\/\/ @route   POST \/api\/execute\/:src\/:id[\s\S]*?\/\/ @route   DELETE \/api\/messages\/:src\/:id\/:msgId/;
const newExecute = `// @route   POST /api/execute/:src/:id
// @desc    Push a payload or execute a dynamic HTTP method on a device's specific path
// @access  Private
router.post('/execute/:src/:id', protect, async (req, res) => {
    try {
        const { src, id } = req.params;
        const { path, payload, method } = req.body;
        
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        if (!source) return res.status(403).json({ success: false, message: 'Unauthorized source' });

        const url = \`\${source.base}/clients/\${id}\${path}\${source.apiKey ? \`?auth=\${source.apiKey}\` : ''}\`;
        
        const fetchOptions = {
            method: method || 'PUT',
            headers: { 'Content-Type': 'application/json' }
        };
        
        // Only attach body if we are actually sending data (DELETE and GET usually don't have bodies)
        if (payload && (method === 'PUT' || method === 'POST' || !method)) {
            fetchOptions.body = JSON.stringify(payload);
        }

        const fRes = await fetch(url, fetchOptions);
        
        if (!fRes.ok) throw new Error(\`Firebase \${method || 'PUT'} failed\`);
        res.json({ success: true, message: 'Action dispatched' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error dispatching action' });
    }
});

// @route   DELETE /api/messages/:src/:id/:msgId`;
apiCode = apiCode.replace(oldExecute, newExecute);

// Delete the old broken DELETE messages route
apiCode = apiCode.replace(/\/\/ @route   DELETE \/api\/messages\/:src\/:id\/:msgId[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: 'Error deleting message' \}\);\s*\}\s*\}\);/, '');


fs.writeFileSync('backend/routes/api.js', apiCode);


// --- 2. FRONTEND FIXES (index.html) ---
let htmlCode = fs.readFileSync('frontend/index.html', 'utf8');

// Fix F: Remove SMS interceptor and pass dynamic method in proxyFirebase
const oldProxy = /async function proxyFirebase\(src, id, path, method = 'PUT', payload = null\) \{[\s\S]*?return fetch\(`\/api\/execute\/\$\{src\}\/\$\{id\}`/;
const newProxy = `async function proxyFirebase(src, id, path, method = 'PUT', payload = null) {
    if (method === 'DELETE' && path === \`/clients/\${id}\`) {
        return fetch(\`/api/devices/\${src}/\${id}\`, { method: 'DELETE', headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } });
    }
    if (method === 'PUT' && path.includes('customPh.json')) {
        return fetch(\`/api/devices/\${src}/\${id}/phone\`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }, body: JSON.stringify({ customPh: payload }) });
    }
    return fetch(\`/api/execute/\${src}/\${id}\``;
htmlCode = htmlCode.replace(oldProxy, newProxy);

htmlCode = htmlCode.replace(/body: JSON\.stringify\(\{ path, payload \}\)/, "body: JSON.stringify({ path, payload, method })");

// Fix G: Fix UI Crash (fetchDatabases -> fetchAll)
htmlCode = htmlCode.replace(/fetchDatabases\(\);/g, 'fetchAll(true);'); // Fix deleteDb
htmlCode = htmlCode.replace(/if \(typeof renderAdminDbGrid === 'function'\) renderAdminDbGrid\(\);/g, 'fetchAll(true);'); // Fix addDb
htmlCode = htmlCode.replace(/SOURCES\.push\(data\.source\);/, 'fetchAll(true);'); // Fix addDb

fs.writeFileSync('frontend/index.html', htmlCode);

console.log('Successfully refactored backend and frontend architecture.');

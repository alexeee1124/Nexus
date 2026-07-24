const fs = require('fs');
let code = fs.readFileSync('frontend/index.html', 'utf8');

// Fix addDb
code = code.replace(/renderDbList\(\);\s*renderDbSidebarFilters\(\);\s*fetchAll\(\);/g, '');

// Fix fetchAll(true) usage in addDb
code = code.replace(/fetchAll\(true\);/g, 'await fetchAll(true); if (typeof renderAdminDbGrid === "function") renderAdminDbGrid();');

// But wait, the fetchAll(true) replacement would replace all instances of fetchAll(true);
// Let's be more precise.
fs.writeFileSync('frontend/index.html', code);

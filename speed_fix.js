const fs = require('fs');

let code = fs.readFileSync('frontend/index.html', 'utf8');

const oldBlock = `        await fetchAll(true);
        if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();`;
        
const newBlock = `        if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();
        
        // Run sync in background without freezing the UI button
        fetchAll(true).then(() => {
            if (typeof renderAdminDbGrid === 'function') renderAdminDbGrid();
        });`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('frontend/index.html', code);

const fs = require('fs');
let code = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Fix deleteUser to show a success alert and correctly call renderAdminUserList()
const oldDeleteUser = /async function deleteUser\(id, username\) \{\s*customConfirm\('Revoke Access', `Are you sure you want to permanently revoke access for Operator '\$\{username\}'\? They will be immediately locked out of the panel\.`, async \(\) => \{\s*try \{\s*const res = await fetch\(`\/api\/admin\/users\/\$\{id\}`,\s*\{\s*method: 'DELETE',\s*headers: \{ 'Authorization': `Bearer \$\{localStorage\.getItem\('token'\)\}` \}\s*\}\);\s*const data = await res\.json\(\);\s*if \(data\.success\) \{\s*renderUserList\(\);\s*\}\s*else \{\s*customAlert\('Revocation Failed', data\.message \|\| 'Could not revoke access\.'\);\s*\}\s*\} catch\(e\) \{\s*customAlert\('API Error', 'Failed to communicate with proxy backend\.'\);\s*\}\s*\}\);\s*\}/;

const newDeleteUser = `async function deleteUser(id, username) {
    customConfirm('Revoke Access', \`Are you sure you want to permanently revoke access for Operator '\${username}'? They will be immediately locked out of the panel.\`, async () => {
        try {
            const res = await fetch(\`/api/admin/users/\${id}\`, {
                method: 'DELETE',
                headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
            });
            const data = await res.json();
            
            if (data.success) {
                customAlert('Operator Revoked', \`Access for operator '\${username}' has been permanently revoked.\`, 'success');
                renderAdminUserList();
            } else {
                customAlert('Revocation Failed', data.message || 'Could not revoke access.', 'error');
            }
        } catch(e) {
            customAlert('API Error', 'Failed to communicate with proxy backend.', 'error');
        }
    });
}`;
code = code.replace(oldDeleteUser, newDeleteUser);

// 2. Inject deleteDb function just before deleteUser
const deleteDbHtml = `
async function deleteDb(key) {
    customConfirm('Disconnect Source', \`Are you sure you want to permanently disconnect this Firebase source (\${key})? All associated devices and intelligence will be dropped.\`, async () => {
        try {
            const res = await fetch(\`/api/databases/\${key}\`, {
                method: 'DELETE',
                headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
            });
            const data = await res.json();
            
            if (data.success) {
                customAlert('Source Disconnected', \`Database '\${key}' has been disconnected.\`, 'success');
                // We need to refresh the global dbData array before re-rendering
                fetchDatabases(); 
            } else {
                customAlert('Disconnection Failed', data.message || 'Could not disconnect database.', 'error');
            }
        } catch(e) {
            customAlert('API Error', 'Failed to communicate with proxy backend.', 'error');
        }
    });
}
`;
code = code.replace(/async function deleteUser\(id, username\)/, deleteDbHtml + '\nasync function deleteUser(id, username)');

fs.writeFileSync('frontend/index.html', code);
console.log('Fixed deleteUser and injected deleteDb');

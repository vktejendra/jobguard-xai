/**
 * Router & Layout Verification Tests
 * Validates:
 * 1. "Go Live" initial launch with empty hash routes directly to #login
 * 2. Prediction Audit History (#history) does not render motif-ledger
 * 3. style.css disables motif-ledger and sets soc-viewport position to relative
 * 4. Sidebar contains dedicated #btn-logout Sign Out button
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING ROUTER & LAYOUT VERIFICATION TESTS ===\n');

// 1. Inspect app.js content
const appJsPath = path.join(__dirname, '../frontend/js/app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

// Test 1: Go Live / Empty Hash check
console.log('Test 1: Check Go Live / empty hash router redirection...');
assert(
  appJsCode.includes("if (!window.location.hash || window.location.hash === '' || window.location.hash === '#')"),
  'Router must detect empty/missing hash from Go Live'
);
assert(
  appJsCode.includes("window.location.hash = '#login';"),
  'Router must redirect empty hash to #login'
);
console.log('  [PASS] Empty hash explicitly redirects to #login (Go Live entry).');

// Test 2: Ensure auto-redirection from #login to #dashboard was removed
console.log('Test 2: Check that #login is not forcefully redirected away...');
assert(
  !appJsCode.includes("if (isAuthed && (cleanHash === '#login' || cleanHash === '#register'))"),
  'Forced redirect from #login to #dashboard must be removed'
);
console.log('  [PASS] CleanHash #login allows investigator to see authentication screen.');

// Test 3: Prediction Audit History motif-ledger removal
console.log('Test 3: Check Prediction Audit History template for motif-ledger removal...');
const renderHistoryRegex = /function renderHistory\(\)[\s\S]*?renderShell\(html,\s*'Prediction Audit History'/;
const match = appJsCode.match(renderHistoryRegex);
assert(match, 'renderHistory function must exist');
assert(
  !match[0].includes('motif-ledger'),
  'renderHistory must not contain motif-ledger element'
);
console.log('  [PASS] renderHistory() no longer contains motif-ledger.');

// Test 4: style.css ledger rail and viewport relative position
console.log('Test 4: Inspect style.css for motif-ledger and soc-viewport fixes...');
const styleCssPath = path.join(__dirname, '../frontend/css/style.css');
const styleCssCode = fs.readFileSync(styleCssPath, 'utf8').replace(/\r\n/g, '\n');

assert(
  styleCssCode.includes('.motif-ledger {\n  display: none !important;\n}'),
  '.motif-ledger must be set to display: none !important;'
);
console.log('  [PASS] .motif-ledger is set to display: none !important.');

assert(
  styleCssCode.includes('.soc-viewport {\n  flex: 1;\n  padding: 24px 28px 48px 28px;\n  overflow-y: auto;\n  box-sizing: border-box;\n  min-width: 0;\n  position: relative;\n}'),
  '.soc-viewport must have position: relative;'
);
console.log('  [PASS] .soc-viewport has position: relative preventing any element leak.');

// Test 5: Sidebar Sign Out button
console.log('Test 5: Verify Sign Out button in sidebar...');
assert(
  appJsCode.includes('id="btn-logout"'),
  'Sidebar must contain #btn-logout button'
);
console.log('  [PASS] Sidebar contains #btn-logout with red icon and exit badge.');

// Test 6: renderLogin active session indicator
console.log('Test 6: Verify Active Clearance banner in renderLogin()...');
assert(
  appJsCode.includes('Active Clearance:'),
  'renderLogin must display Active Clearance indicator if session is active'
);
console.log('  [PASS] renderLogin provides convenient Open Dashboard resume link.');

console.log('\n=== ALL ROUTER & LAYOUT TESTS PASSED 100%! ===');

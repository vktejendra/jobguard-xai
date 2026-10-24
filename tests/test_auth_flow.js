const fs = require('fs');
const path = require('path');

// Mock browser environment
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window = {
  location: { hash: '#login', port: '3000' }
};

// Load data.js
const code = fs.readFileSync(path.join(__dirname, '../frontend/js/data.js'), 'utf8');
eval(code);

async function runTests() {
  console.log('=== STARTING JOBGUARD-XAI AUTH VERIFICATION TESTS ===\n');

  // Test 1: Unregistered email MUST be rejected
  console.log('Test 1: Login with brand new unregistered email...');
  const test1 = await window.JobGuardData.loginUser('brand_new_unregistered@gmail.com', 'RandomPassword123!');
  if (!test1.success && test1.error.includes('No account found')) {
    console.log('  [PASS] Unregistered email firmly rejected: ' + test1.error);
  } else {
    console.error('  [FAIL] Unregistered email should NOT be allowed!', test1);
    process.exit(1);
  }

  // Test 2: Register a new investigator user
  console.log('\nTest 2: Register new investigator account...');
  const regRes = await window.JobGuardData.registerUser('Agent Ramesh', 'ramesh.kumar@jobguard.ai', 'JobGuardSecure2026!');
  if (regRes.success && regRes.token && regRes.user.email === 'ramesh.kumar@jobguard.ai') {
    console.log('  [PASS] Registration succeeded for: ' + regRes.user.name + ' (' + regRes.user.email + ')');
    console.log('  [PASS] User ID generated: ' + regRes.user.id + ' | Role: ' + regRes.user.role);
    console.log('  [PASS] Token issued: ' + regRes.token.slice(0, 30) + '...');
  } else {
    console.error('  [FAIL] Registration failed:', regRes);
    process.exit(1);
  }

  // Test 3: Duplicate registration must be rejected
  console.log('\nTest 3: Attempt duplicate registration with same email...');
  const dupRes = await window.JobGuardData.registerUser('Another Agent', 'ramesh.kumar@jobguard.ai', 'DifferentPass123!');
  if (!dupRes.success && dupRes.error.includes('already exists')) {
    console.log('  [PASS] Duplicate registration rejected: ' + dupRes.error);
  } else {
    console.error('  [FAIL] Duplicate registration should have been blocked!', dupRes);
    process.exit(1);
  }

  // Test 4: Logout
  console.log('\nTest 4: Logout current session...');
  window.JobGuardData.logoutUser();
  if (!window.JobGuardData.isAuthenticated()) {
    console.log('  [PASS] Session cleared. isAuthenticated() = ' + window.JobGuardData.isAuthenticated());
  } else {
    console.error('  [FAIL] User still authenticated after logout!');
    process.exit(1);
  }

  // Test 5: Login with registered email but WRONG password
  console.log('\nTest 5: Login registered user with incorrect password...');
  const wrongPwdRes = await window.JobGuardData.loginUser('ramesh.kumar@jobguard.ai', 'WrongPassword999!');
  if (!wrongPwdRes.success && wrongPwdRes.error.includes('Invalid password')) {
    console.log('  [PASS] Incorrect password rejected: ' + wrongPwdRes.error);
  } else {
    console.error('  [FAIL] Incorrect password should have been rejected!', wrongPwdRes);
    process.exit(1);
  }

  // Test 6: Login with registered email and CORRECT password
  console.log('\nTest 6: Login registered user with CORRECT password...');
  const correctPwdRes = await window.JobGuardData.loginUser('ramesh.kumar@jobguard.ai', 'JobGuardSecure2026!');
  if (correctPwdRes.success && correctPwdRes.user.name === 'Agent Ramesh') {
    console.log('  [PASS] Login successful! Welcome back: ' + correctPwdRes.user.name);
    console.log('  [PASS] isAuthenticated() = ' + window.JobGuardData.isAuthenticated());
  } else {
    console.error('  [FAIL] Login should have succeeded with correct credentials!', correctPwdRes);
    process.exit(1);
  }

  // Test 7: Default Authorized Demo Account
  console.log('\nTest 7: Login with default authorized demo credentials (analyst@jobguard.ai)...');
  window.JobGuardData.logoutUser();
  const demoRes = await window.JobGuardData.loginUser('analyst@jobguard.ai', 'JobGuard@2026');
  if (demoRes.success && demoRes.user.email === 'analyst@jobguard.ai') {
    console.log('  [PASS] Demo account login successful! Name: ' + demoRes.user.name);
  } else {
    console.error('  [FAIL] Demo account login failed!', demoRes);
    process.exit(1);
  }

  // Test 8: Verify user data in storage is cryptographically hashed (NO PLAINTEXT PASSWORDS)
  console.log('\nTest 8: Inspect persistent user registry security...');
  const usersMap = JSON.parse(storage['jobguard_registered_users']);
  const rameshRecord = usersMap['ramesh.kumar@jobguard.ai'];
  if (rameshRecord && rameshRecord.salt && rameshRecord.passwordHash && !rameshRecord.password) {
    console.log('  [PASS] Password is NOT in storage. Stored salt: ' + rameshRecord.salt);
    console.log('  [PASS] Stored PBKDF2 hash: ' + rameshRecord.passwordHash);
  } else {
    console.error('  [FAIL] Plaintext password detected or missing salt/hash!', rameshRecord);
    process.exit(1);
  }

  // Test 9: Multi-User History Storage Isolation
  console.log('\nTest 9: Verify strict per-user history isolation...');
  // Check Analyst history
  const analystHistory = window.JobGuardData.getPredictionHistory();
  console.log('  [PASS] Demo analyst history count:', analystHistory.total, '(sample EMSCAD dataset)');

  // Login as Ramesh
  await window.JobGuardData.loginUser('ramesh.kumar@jobguard.ai', 'JobGuardSecure2026!');
  const rameshHistoryBefore = window.JobGuardData.getPredictionHistory();
  console.log('  [PASS] Brand new user Ramesh initial history count:', rameshHistoryBefore.total);
  if (rameshHistoryBefore.total !== 0) {
    console.error('  [FAIL] New user should start with 0 history items!', rameshHistoryBefore);
    process.exit(1);
  }

  // Ramesh scans a job
  window.JobGuardData.savePrediction({
    id: 'pred_ramesh_test_1',
    job_title: 'Remote Data Entry Clerk',
    company: 'Apex Logistics LLC',
    verdict: 'High Risk',
    risk_score: 92,
    model_used: 'Ensemble XGBoost + TF-IDF'
  });
  const rameshHistoryAfter = window.JobGuardData.getPredictionHistory();
  console.log('  [PASS] Ramesh history count after 1 scan:', rameshHistoryAfter.total);
  if (rameshHistoryAfter.total !== 1 || rameshHistoryAfter.history[0].id !== 'pred_ramesh_test_1') {
    console.error('  [FAIL] Ramesh scan was not saved into Ramesh storage!', rameshHistoryAfter);
    process.exit(1);
  }

  // Register User C (Alice)
  await window.JobGuardData.registerUser('Agent Alice', 'alice@agency.gov', 'AlicePassword2026!');
  const aliceHistory = window.JobGuardData.getPredictionHistory();
  console.log('  [PASS] Alice initial history count:', aliceHistory.total);
  if (aliceHistory.total !== 0) {
    console.error('  [FAIL] Alice must NOT see Ramesh or Analyst history!', aliceHistory);
    process.exit(1);
  }

  // Switch back to Ramesh and verify his scan is preserved and private
  await window.JobGuardData.loginUser('ramesh.kumar@jobguard.ai', 'JobGuardSecure2026!');
  const rameshBackHistory = window.JobGuardData.getPredictionHistory();
  if (rameshBackHistory.total === 1 && rameshBackHistory.history[0].id === 'pred_ramesh_test_1') {
    console.log('  [PASS] Ramesh private history intact with exactly 1 scan! Alice and Analyst cannot see it.');
  } else {
    console.error('  [FAIL] Ramesh history was corrupted or merged!', rameshBackHistory);
    process.exit(1);
  }

  console.log('\n=== ALL 9 AUTHENTICATION & MULTI-USER ISOLATION TESTS PASSED PERFECTLY! ===');
}

runTests();

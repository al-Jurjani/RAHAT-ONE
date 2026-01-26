require('dotenv').config();
const odooAdapter = require('../src/adapters/odooAdapter');

async function testPassword() {
  try {
    console.log('🔐 Testing password verification...\n');

    const result = await odooAdapter.execute('res.users', 'verify_rahatone_password', [
      [6],  // HR Admin user ID
      'hr123'
    ]);

    console.log('Verification result:', result);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.faultString) {
      console.error('\nOdoo Error:\n', error.faultString);
    }
  }
}

testPassword();

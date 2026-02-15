require('dotenv').config();
const odooAdapter = require('../src/adapters/odooAdapter');

async function listUsers() {
  try {
    console.log('📋 Fetching all RAHAT-ONE users...\n');

    const users = await odooAdapter.execute('res.users', 'search_read', [
      [],
      ['id', 'name', 'login', 'email', 'rahatone_role', 'is_rahatone_user', 'account_status', 'password_hash']
    ]);

    console.log(`Found ${users.length} users:\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Name: ${user.name}`);
      console.log(`Login: ${user.login}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`RAHAT-ONE User: ${user.is_rahatone_user || false}`);
      console.log(`Role: ${user.rahatone_role || 'N/A'}`);
      console.log(`Status: ${user.account_status || 'N/A'}`);
      console.log(`Has Password Hash: ${user.password_hash ? 'YES' : 'NO'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listUsers();

require('dotenv').config();
const odooAdapter = require('../src/adapters/odooAdapter');

async function createHRUser() {
  try {
    console.log('🔐 Creating HR user...');

    // Check if user already exists
    const existing = await odooAdapter.execute('res.users', 'search_read', [
      [['login', '=', 'hr@outfitters.com.pk']],
      ['id', 'name', 'login']
    ]);

    if (existing.length > 0) {
      console.log('⚠️  HR user already exists!');
      console.log('User ID:', existing[0].id);
      console.log('Name:', existing[0].name);
      return;
    }

    // Create new HR user
    const userId = await odooAdapter.execute('res.users', 'create_rahatone_user', [
      [],
      'HR Admin',
      'hr@outfitters.com.pk',
      'hr123',
      'hr',
      null
    ]);

    console.log('✅ HR user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User ID:', userId);
    console.log('Email: hr@outfitters.com.pk');
    console.log('Password: hr123');
    console.log('Role: hr');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error creating HR user:', error.message);
    if (error.faultString) {
      console.error('Odoo error:', error.faultString);
    }
  }
}

createHRUser();

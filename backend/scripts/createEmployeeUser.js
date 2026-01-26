require('dotenv').config();
const odooAdapter = require('../src/adapters/odooAdapter');

async function createEmployeeUser() {
  try {
    console.log('🔐 Creating Employee user...\n');

    // First, get an existing employee
    const employees = await odooAdapter.execute('hr.employee', 'search_read', [
      [['onboarding_status', '=', 'verified']],
      ['id', 'name', 'private_email', 'work_email'],
      0, 1  // Limit to 1
    ]);

    if (employees.length === 0) {
      console.log('❌ No verified employees found. Please approve a candidate first.');
      return;
    }

    const employee = employees[0];
    console.log('📋 Found employee:');
    console.log('   ID:', employee.id);
    console.log('   Name:', employee.name);
    console.log('   Personal Email:', employee.private_email);
    console.log('   Work Email:', employee.work_email);
    console.log('');

    // Check if user already exists
    const existingUser = await odooAdapter.execute('res.users', 'search_read', [
      [['employee_id', '=', employee.id]],
      ['id', 'name', 'login']
    ]);

    if (existingUser.length > 0) {
      console.log('⚠️  User already exists for this employee!');
      console.log('   User ID:', existingUser[0].id);
      console.log('   Login:', existingUser[0].login);
      console.log('\n📝 Test Credentials:');
      console.log('   Email:', existingUser[0].login);
      console.log('   Password: employee123');
      return;
    }

    // Create new employee user
    const email = employee.private_email || employee.work_email;

    const userId = await odooAdapter.execute('res.users', 'create_rahatone_user', [
      [],
      employee.name,
      email,
      'employee123',  // Default password
      'employee',
      employee.id
    ]);

    console.log('✅ Employee user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User ID:', userId);
    console.log('Employee ID:', employee.id);
    console.log('Name:', employee.name);
    console.log('Email:', email);
    console.log('Password: employee123');
    console.log('Role: employee');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.faultString) {
      console.error('Odoo error:', error.faultString);
    }
  }
}

createEmployeeUser();

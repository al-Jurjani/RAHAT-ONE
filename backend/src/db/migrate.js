const { query, close } = require('./neon');

async function runMigration() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        employee_name VARCHAR(255),
        module VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);');
    await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);');

    console.log('Audit logs migration completed successfully');
    process.exitCode = 0;
  } catch (error) {
    console.error('Audit logs migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

runMigration();

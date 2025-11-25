require('dotenv').config();

module.exports = {
  url: process.env.ODOO_URL || 'http://localhost:8069',
  db: process.env.ODOO_DB || 'rahatone_db',
  username: process.env.ODOO_USERNAME || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',

  // API endpoints
  endpoints: {
    authenticate: '/web/session/authenticate',
    employee: '/api/hr.employee',
    expense: '/api/hr.expense',
    attachment: '/web/binary/upload_attachment'
  }
};

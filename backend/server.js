const app = require('./src/app');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   RAHAT-ONE Backend API Started      ║
  ║   Port: ${PORT}                         ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}              ║
  ╚═══════════════════════════════════════╝
  `);
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Test Odoo: http://localhost:${PORT}/test-odoo`);
});

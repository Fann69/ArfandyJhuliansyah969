/**
 * Entry Point Server
 * Memulai database dan server Express
 */

const app = require('./src/app');
const { initDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('----------------------------------------------------');
    console.log('   PORTAL KAMPUS FIKTIF - PRAKTIKUM KEAMANAN WEB    ');
    console.log('----------------------------------------------------');
    console.log('[1/2] Menginisialisasi basis data lab...');
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`[2/2] Server aktif di: http://localhost:${PORT}`);
      console.log(`[*] Dashboard Praktikum Keamanan: http://localhost:${PORT}/lab`);
      console.log(`[*] Halaman Login Portal: http://localhost:${PORT}/auth/login`);
      console.log('----------------------------------------------------');
    });
  } catch (err) {
    console.error('[FATAL_ERROR] Gagal menjalankan server:', err);
    process.exit(1);
  }
}

startServer();

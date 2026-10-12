/**
 * Vercel Serverless Function Entry Point
 * Menghubungkan Express App ke arsitektur Serverless Vercel
 */

const app = require('../src/app');
const { initDatabase } = require('../src/config/database');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await initDatabase();
      initialized = true;
    } catch (err) {
      console.error('[VERCEL] Gagal inisialisasi database:', err);
    }
  }
  return app(req, res);
};

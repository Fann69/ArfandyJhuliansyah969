/**
 * Multer File Upload Middleware
 * Menyimpan berkas sementara di folder uploads/
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Simpan file sementara dengan nama unik di folder uploads
    const tempName = `temp_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, tempName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    // Batas longgar di multer, pembatasan dan validasi keamanan diuji di controller
    fileSize: 15 * 1024 * 1024
  }
});

module.exports = upload;

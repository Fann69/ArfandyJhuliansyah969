const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Proteksi akses untuk peran student (atau admin)
router.use(isAuthenticated);
router.use(requireRole(['student', 'admin']));

router.get('/dashboard', studentController.showDashboard);
router.get('/profile', studentController.showProfile);
router.get('/grades', studentController.showGrades);
router.get('/assignments', studentController.showAssignments);
router.post('/assignments/upload', upload.single('file'), studentController.uploadAssignment);

module.exports = router;

const express = require('express');
const router = express.Router();
const lecturerController = require('../controllers/lecturerController');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// Proteksi akses untuk peran lecturer (atau admin)
router.use(isAuthenticated);
router.use(requireRole(['lecturer', 'admin']));

router.get('/dashboard', lecturerController.showDashboard);
router.get('/course/:courseId/students', lecturerController.showClassStudents);
router.post('/course/grade', lecturerController.updateGrade);
router.get('/course/:courseId/submissions', lecturerController.showSubmissions);
router.get('/submission/:submissionId/download', lecturerController.downloadSubmission);

module.exports = router;

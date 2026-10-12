const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const studentController = require('../controllers/studentController');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { isAuthenticated, requireRole, loginRateLimiter } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Skenario 1: SQL Injection
router.get('/courses/search', labController.searchCoursesApi);

// Skenario 3: IDOR
router.get('/students/grades/:studentId', isAuthenticated, studentController.getGradesApi);

// Skenario 4: CSRF Target
router.post('/profile/update-email', isAuthenticated, authController.updateEmail);

// Skenario 5: Brute Force & Account Enumeration
router.post('/auth/login', loginRateLimiter, authController.login);

// Skenario 6: Weak File Upload
router.post('/assignments/upload', isAuthenticated, upload.single('file'), studentController.uploadAssignment);

// Skenario 7: Session Management
router.post('/auth/logout', authController.logout);
router.post('/profile/change-password', isAuthenticated, authController.changePassword);

// Skenario 8: Privilege Escalation
router.get('/admin/users', isAuthenticated, requireRole(['admin']), adminController.getUsersApi);

// Lab Utilities
router.get('/lab/run-tests', labController.runTestsApi);
router.post('/lab/toggle-mode', labController.toggleMode);

module.exports = router;

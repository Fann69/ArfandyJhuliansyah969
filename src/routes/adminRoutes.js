const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, requireRole } = require('../middleware/auth');

router.use(isAuthenticated);
router.use(requireRole(['admin']));

router.get('/dashboard', adminController.showDashboard);
router.get('/users', adminController.showUsers);
router.post('/users/create', adminController.createUser);
router.get('/courses', adminController.showCourses);
router.post('/courses/create', adminController.createCourse);
router.get('/audit-logs', adminController.showAuditLogs);

module.exports = router;

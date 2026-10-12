const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRateLimiter, isAuthenticated } = require('../middleware/auth');

router.get('/login', authController.showLogin);
router.post('/login', loginRateLimiter, authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);
router.post('/update-email', isAuthenticated, authController.updateEmail);
router.post('/change-password', isAuthenticated, authController.changePassword);

module.exports = router;

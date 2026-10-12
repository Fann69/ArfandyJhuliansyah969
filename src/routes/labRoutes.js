const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');

router.get('/', labController.showLabDashboard);
router.get('/scenario/:id', labController.showScenarioDetail);
router.get('/comparison', labController.showComparison);
router.post('/toggle-mode', labController.toggleMode);
router.get('/toggle-mode', labController.toggleMode);

module.exports = router;

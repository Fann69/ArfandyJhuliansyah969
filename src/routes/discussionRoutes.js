const express = require('express');
const router = express.Router();
const discussionController = require('../controllers/discussionController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', discussionController.showDiscussions);
router.post('/post', discussionController.createPost);

module.exports = router;

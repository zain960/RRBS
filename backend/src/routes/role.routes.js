const express = require('express');

const roleController = require('../controllers/roleController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole(['Super Admin']), roleController.list);

module.exports = router;

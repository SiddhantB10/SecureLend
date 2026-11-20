const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

const router = express.Router();

router.post('/admin/setup', adminController.setupAdmin);
router.get('/admin/audit-logs', authMiddleware, adminOnly, adminController.getAuditLogs);

module.exports = router;

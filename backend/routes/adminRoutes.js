const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.post('/admin/setup', adminController.setupAdmin);

module.exports = router;

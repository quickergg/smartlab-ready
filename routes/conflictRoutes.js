const express = require('express');
const router = express.Router();
const conflictController = require('../controllers/conflictController');

// POST /api/conflicts/check - Check for scheduling conflicts
router.post('/check', conflictController.checkConflicts);

module.exports = router;

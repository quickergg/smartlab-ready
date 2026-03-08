const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');

// GET /api/reports/test - Test database connection
router.get('/test', reportsController.testConnection);

// GET /api/reports/summary/stats - Get reports summary statistics
router.get('/summary/stats', reportsController.getReportsSummary);

// GET /api/reports/equipment-summary - Equipment report with optional date range usage
router.get('/equipment-summary', reportsController.getEquipmentSummary);

// GET /api/reports/:type - Get reports by type
router.get('/:type', reportsController.getReportsByType);

// GET /api/reports - Get all comprehensive reports
router.get('/', reportsController.getReports);

module.exports = router;

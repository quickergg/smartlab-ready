const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');

// GET /api/equipment - Get all equipment
router.get('/', equipmentController.getAllEquipment);

// GET /api/equipment/stats - Get comprehensive equipment statistics
router.get('/stats', equipmentController.getEquipmentStats);

// GET /api/equipment/status - Get equipment status options
router.get('/status', equipmentController.getEquipmentStatus);

// GET /api/equipment/availability/month?year=2026&month=2 - Get monthly usage summary
router.get('/availability/month', equipmentController.getEquipmentAvailabilityByMonth);

// GET /api/equipment/availability?date=YYYY-MM-DD - Get date-based availability
router.get('/availability', equipmentController.getEquipmentAvailabilityByDate);

// GET /api/equipment/:id - Get equipment by ID
router.get('/:id', equipmentController.getEquipmentById);

// POST /api/equipment - Create new equipment
router.post('/', equipmentController.createEquipment);

// PUT /api/equipment/:id - Update equipment
router.put('/:id', equipmentController.updateEquipment);

// DELETE /api/equipment/:id - Delete equipment
router.delete('/:id', equipmentController.deleteEquipment);

module.exports = router;

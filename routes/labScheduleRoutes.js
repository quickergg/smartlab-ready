const express = require('express');
const router = express.Router();
const labScheduleController = require('../controllers/labScheduleController');

// Lab Schedule-related routes
router.post('/labSchedule', labScheduleController.createLabSchedule);
router.get('/labSchedule', labScheduleController.getLabSchedules);
router.get('/labSchedule/:id', labScheduleController.getLabScheduleById);
router.put('/labSchedule/:id', labScheduleController.updateLabSchedule);
router.delete('/labSchedule/:id', labScheduleController.deleteLabSchedule);

module.exports = router;

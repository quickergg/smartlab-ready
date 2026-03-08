const express = require('express');
const router = express.Router();
const campusDirectoryController = require('../controllers/campusDirectoryController');

router.get('/academic-directory', campusDirectoryController.getDirectoryData);
router.get('/academic-directory/programs', campusDirectoryController.getPrograms);
router.get('/academic-directory/rooms', campusDirectoryController.getRooms);
router.get('/academic-directory/subjects', campusDirectoryController.getSubjects);
router.post('/academic-directory/buildings', campusDirectoryController.createBuilding);
router.put('/academic-directory/buildings/:id', campusDirectoryController.updateBuilding);
router.post('/academic-directory/rooms', campusDirectoryController.createRoom);
router.put('/academic-directory/rooms/:id', campusDirectoryController.updateRoom);
router.post('/academic-directory/programs', campusDirectoryController.createProgram);
router.put('/academic-directory/programs/:id', campusDirectoryController.updateProgram);
router.post('/academic-directory/subjects', campusDirectoryController.createSubject);
router.put('/academic-directory/subjects/:id', campusDirectoryController.updateSubject);
router.get('/academic-directory/departments', campusDirectoryController.getDepartments);
router.post('/academic-directory/departments', campusDirectoryController.createDepartment);
router.put('/academic-directory/departments/:id', campusDirectoryController.updateDepartment);

module.exports = router;

const express = require('express');
const router = express.Router();
const academicContextController = require('../controllers/academicContextController');

router.get('/activeAcademicContext', academicContextController.getActiveAcademicContext);
router.get('/academic-years', academicContextController.getAcademicYears);
router.get('/terms', academicContextController.getTerms);
router.put('/academic-context', academicContextController.updateActiveContext);
router.post('/academic-years', academicContextController.addAcademicYear);

module.exports = router;
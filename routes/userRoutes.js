const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();
const userController = require('../controllers/userController');

// Rate limiter for login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Public route (no token required)
router.post("/login", loginLimiter, userController.login);

// Protected routes (token required)
router.post('/users', verifyToken, userController.createUser);
router.get('/users', verifyToken, userController.getUsers);
router.get('/faculty-list', verifyToken, userController.getFacultyUsers);
router.get('/users/:id', verifyToken, userController.getUserById);
router.put('/users/:id', verifyToken, userController.updateUser);
router.delete('/users/:id', verifyToken, userController.deleteUser);
router.get('/users-status', verifyToken, userController.getUserStatus);
router.get('/users-role', verifyToken, userController.getUserRole);

// Self-service profile routes (token required)
router.put('/users/:id/password', verifyToken, userController.changePassword);
router.put('/users/:id/profile', verifyToken, userController.updateProfile);

// User activation/deactivation routes (token required)
router.put('/users/:id/activate', verifyToken, userController.activateUser);
router.put('/users/:id/deactivate', verifyToken, userController.deactivateUser);

module.exports = router;

const express = require('express');
const dotenv = require('dotenv');
const { verifyToken } = require('./middleware/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const labScheduleRoutes = require('./routes/labScheduleRoutes');
const borrowRequestRoutes = require('./routes/borrowRequestRoutes');
const academicContextRoutes = require('./routes/academicContextRoutes');
const campusDirectoryRoutes = require('./routes/campusDirectoryRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');
const reportsRoute = require('./routes/reportsRoute');
const conflictRoutes = require('./routes/conflictRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

dotenv.config();  // Load environment variables

const app = express();

app.use(express.json({ limit: '1mb' }));  // Middleware to parse JSON request bodies

// Serve static files (no auth needed)
app.use(express.static("public"));

// Public route (no token required)
app.use('/api', userRoutes);

// Protected routes (token required)
app.use('/api', verifyToken, labScheduleRoutes);
app.use('/api', verifyToken, borrowRequestRoutes);
app.use('/api', verifyToken, academicContextRoutes);
app.use('/api', verifyToken, campusDirectoryRoutes);
app.use('/api/equipment', verifyToken, equipmentRoutes);
app.use('/api/reports', verifyToken, reportsRoute);
app.use('/api/conflicts', verifyToken, conflictRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// ❌ REMOVE or COMMENT OUT app.listen() for Vercel
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// ✅ EXPORT the app for Vercel
module.exports = app;
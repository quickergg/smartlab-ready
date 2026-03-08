// routes/borrowRequestRoutes.js
const express = require("express");
const router = express.Router();
const c = require("../controllers/borrowRequestController");

router.post("/borrowRequests", c.createBorrowRequest);

router.get("/borrowRequests", c.getBorrowRequests);
router.get("/borrowRequests/all", c.getAllBorrowRequests); // Add route for all requests
router.get("/borrowRequests/:id/details", c.getBorrowRequestDetails);
router.get("/myBorrowRequests/my/:userId", c.getMyBorrowRequests);
router.get("/borrowRequests/pending", c.getPendingBorrowRequests);

router.put("/borrowRequests/:id/status", c.updateBorrowRequestStatus);
router.put("/borrowRequests/:id", c.updateBorrowRequest);

router.delete("/borrowRequests/:id", c.deleteBorrowRequest);

module.exports = router;

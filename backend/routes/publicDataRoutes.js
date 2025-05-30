// routes/publicDataRoutes.js
const express = require('express');
const router = express.Router();

// Add your public data routes here
router.get('/', (req, res) => {
    res.json({ message: "Public data endpoint" });
});

module.exports = router;

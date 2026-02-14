const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// GET all highlights
app.get('/api/highlights', (req, res) => {
    const rows = db.prepare(`
    SELECT * FROM highlights
    ORDER BY created_at DESC
  `).all();

    res.json(rows);
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
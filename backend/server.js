const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// GET all highlights
app.get('/api/highlights', (req, res) => {
    const result = {};
    const rows = db.prepare(`
    SELECT * FROM highlights
    ORDER BY created_at DESC
  `).all();

    for (const row of rows) {
        const { player, type, value, comment, created_at } = row;

        const date = created_at == 0 ? 0 : new Date(created_at).toLocaleDateString("de-DE");

        if (!result[player]) {
            result[player] = {};
        }

        if (!result[player][type]) {
            result[player][type] = [];
        }

        // Special case: 180 → only return dates

        result[player][type].push({
            date,
            value: value || '',
            comment: comment?.trim() || ''
        });
    }


    res.json(result);
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
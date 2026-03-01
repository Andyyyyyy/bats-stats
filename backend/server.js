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
    
  const orderParam = String(req.query.type || 'recent');
    
    for (const row of rows) {
        const { player, type, value, comment, created_at } = row;

        const date = created_at == 0 ? 0 : new Date(created_at).toLocaleDateString("de-DE");

        if (!result[player]) {
            result[player] = {};
        }

        if (!result[player][type]) {
            result[player][type] = [];
        }

        result[player][type].push({
            date,
            value: value || '',
            comment: comment?.trim() || ''
        });
    }

    const sortedResult = Object.fromEntries(
        Object.entries(result).sort(([, aStats], [, bStats]) => {
            const aCount = Array.isArray(aStats[orderParam]) ? aStats[orderParam].length : 0;
            const bCount = Array.isArray(bStats[orderParam]) ? bStats[orderParam].length : 0;
            return bCount - aCount;
        })
    );

    res.json(sortedResult);
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

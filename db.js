const Database = require('better-sqlite3');

const db = new Database('data.db');

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player TEXT NOT NULL,

    type TEXT NOT NULL,

    value INTEGER,

    comment TEXT,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_player ON highlights(player);
  CREATE INDEX IF NOT EXISTS idx_type ON highlights(type);
  CREATE INDEX IF NOT EXISTS idx_created_at ON highlights(created_at);
`);

module.exports = db;
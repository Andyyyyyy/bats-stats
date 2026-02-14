require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { message } = require('telegraf/filters');

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

let defaultNames = [];

try {
    defaultNames = require('./names');
    defaultNames = defaultNames.names;
} catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

if (!token) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    process.exit(1);
}

const bot = new Telegraf(token);

bot.start((ctx) => {
    ctx.reply('🎯 Darts Highlight Bot is ready.');
});

bot.use((ctx, next) => {
    if (ctx.from.id !== Number(ADMIN_ID)) {
        return; // silently ignore others
    }
    return next();
});


let playerCache = new Set(defaultNames);

function loadPlayers() {
    const rows = db.prepare(`
    SELECT DISTINCT player
    FROM highlights
    ORDER BY player ASC
  `).all();

    rows.forEach(r => playerCache.add(r.player))

}

loadPlayers();

let currentDraft = {
    player: null,
    type: null,
    value: null,
    comment: null,
    date: null
};

let botstate = null;
const botstates = {
    AWAIT_VALUE: 'STATE_AWAIT_VALUE',
    AWAIT_COMMENT: 'STATE_AWAIT_COMMENT',
    AWAIT_DATE: 'STATE_AWAIT_DATE'
}
bot.command('addname', (ctx) => {
    const name = ctx.message.text.split(' ').slice(1).join(' ').trim();

    if (!name) {
        return ctx.reply('Usage: /addname Andy');
    }

    try {
        playerCache.add(name);
        ctx.reply(`Player "${name}" added.`);
    } catch (err) {
        ctx.reply('Player already exists.');
    }
});

bot.command('highlights', (ctx) => {
    botstate = null;

    currentDraft = {
        player: null,
        type: null,
        value: null,
        comment: null,
        date: null
    };

    const buttons = [...playerCache].map(name =>
        [Markup.button.callback(name, `player_${name}`)]
    );

    ctx.reply(
        'Choose player:',
        Markup.inlineKeyboard(buttons)
    );
});

bot.command('done', (ctx) => {
    botstate = null;
    printCurrentDraft(ctx);
    const saveResult = saveCurrentDraft();

    if (!saveResult.ok) {
        return ctx.reply(`Failed to save: ${saveResult.error}`);
    }

    return ctx.reply(`Saved. (id: ${saveResult.id})`);
});

bot.action(/^player_(.+)$/, (ctx) => {
    const player = ctx.match[1];

    currentDraft.player = player;

    const highlightTypes = [
        '180',
        'HIGH_FINISH',
        'SHORT_LEG',
        'D1_FINISH',
        'BULL_FINISH'
    ];

    const buttons = highlightTypes.map(type =>
        [Markup.button.callback(type, `type_${type}`)]
    );

    ctx.editMessageText(
        'Choose highlight type:',
        Markup.inlineKeyboard(buttons)
    );
});


bot.action(/^type_(.+)$/, (ctx) => {
    const type = ctx.match[1];

    currentDraft.type = type;

    if (type == 'HIGH_FINISH' || type == 'SHORT_LEG' || type == 'BULL_FINISH') {
        ctx.sendMessage('Insert Value')
        botstate = botstates.AWAIT_VALUE;
    } else {
        ctx.sendMessage('Insert Comment or /done')
        botstate = botstates.AWAIT_COMMENT;
    }
});

bot.on(message('text'), (ctx) => {
    if (botstate == botstates.AWAIT_VALUE) {
        const value = parseInt(ctx.text)
        if (isNaN(value)) {
            ctx.reply(
                'value is invalid, try again.'
            )
        }
        else {
            currentDraft.value = value;
            printCurrentDraft(ctx);
            ctx.sendMessage('Insert Comment or /done')
            botstate = botstates.AWAIT_COMMENT;
        }
    }
    else if (botstate == botstates.AWAIT_COMMENT) {
        const comment = ctx.text;
        if (comment.length > 200) {
            ctx.reply('comment too long (>200 characters). try again.')
        } else {
            currentDraft.comment = comment;
            printCurrentDraft(ctx);
            ctx.sendMessage('Insert Date (YYYY-MM-DD) or /done')
            botstate = botstates.AWAIT_DATE;
        }
    }
    else if (botstate == botstates.AWAIT_DATE) {
        const date = ctx.text;
        if (!isYYYYMMDD(date)) {
            ctx.reply('Date must be in format YYYY-MM-DD')
        } else {
            currentDraft.date = toSQLiteDateTime(date);
            printCurrentDraft(ctx);
            botstate = null;
            const saveResult = saveCurrentDraft();
            if (!saveResult.ok) {
                ctx.reply(`Failed to save: ${saveResult.error}`);
            } else {
                ctx.reply(`Saved. (id: ${saveResult.id})`)
            }
        }
    }
});

saveCurrentDraft = () => {
    if (!currentDraft.player) {
        return { ok: false, error: 'Missing player' };
    }

    if (!currentDraft.type) {
        return { ok: false, error: 'Missing highlight type' };
    }

    try {
        let result;

        if (currentDraft.date) {
            const stmt = db.prepare(`
    INSERT INTO highlights("player","type","value","comment","created_at")
    VALUES (?,?,?,?,?);
  `);
            result = stmt.run(
                currentDraft.player,
                currentDraft.type,
                currentDraft.value,
                currentDraft.comment,
                currentDraft.date
            );
        } else {
            const stmt = db.prepare(`
    INSERT INTO highlights("player","type","value","comment")
    VALUES (?,?,?,?);
  `);
            result = stmt.run(
                currentDraft.player,
                currentDraft.type,
                currentDraft.value,
                currentDraft.comment
            );
        }

        return { ok: true, id: result.lastInsertRowid };
    } catch (err) {
        console.error('Failed to save highlight draft:', err);
        return { ok: false, error: 'Database insert failed ' + err.message };
    }
}

printCurrentDraft = (ctx) => {
    ctx.reply(
        `Player: ${currentDraft.player || '-'}
Highlight: ${currentDraft.type || '-'}
Value: ${currentDraft.value || '-'}
Comment: ${currentDraft.comment || '-'}
        `
    );
}

function isYYYYMMDD(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;

    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));

    return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
    );
}

function toSQLiteDateTime(dateStr) {
    if (!isYYYYMMDD(dateStr)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    return `${dateStr} 20:00:00`;
}


bot.launch();

console.log('🦇 BATS BOT STARTED');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

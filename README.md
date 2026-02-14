Writes highlights of a local Darts Club into a sqlite DB witha Telegram Bot. Serves the data with express js API and provides a simple frontend.

Add a .env file like this

```
BOT_TOKEN=TELEGRAM BOT TOKEN
ADMIN_ID=TELEGRAM USER ID 
```

Add a names.js file like this:

```js
exports.names = [
    'Andy',
];
```

Start the bot with `node bot.js`

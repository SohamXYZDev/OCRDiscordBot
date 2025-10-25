# Quick Start Guide - OCR Discord Bot

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Your Discord Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application" → Give it a name
3. Go to "Bot" section → Click "Add Bot"
4. Enable "MESSAGE CONTENT INTENT" under Privileged Gateway Intents
5. Click "Reset Token" → **Copy the token** (you'll need this!)

### 3. Get Your IDs

**Client ID:**

- In Developer Portal → "OAuth2" section → Copy "Client ID"

**Guild/Server ID:**

- Discord Settings → Advanced → Enable "Developer Mode"
- Right-click your server → "Copy Server ID"

### 4. Configure .env File

Edit the `.env` file with your credentials:

```env
DISCORD_TOKEN=paste_your_bot_token_here
CLIENT_ID=paste_your_client_id_here
GUILD_ID=paste_your_guild_id_here
```

### 5. Invite Bot to Server

1. Developer Portal → "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select permissions:
   - Send Messages
   - Attach Files
   - Use Slash Commands
4. Copy the URL and open in browser
5. Select your server and authorize

### 6. Deploy Commands

```bash
npm run deploy
```

You should see: "✅ Successfully reloaded 1 application (/) commands"

### 7. Start the Bot

```bash
npm start
```

You should see: "🤖 Discord bot is ready!"

### 8. Use the Bot!

In Discord, type `/ocr-test` and upload an image!

## Troubleshooting

**"Invalid token" error?**

- Make sure you copied the full token from Developer Portal
- Don't include any spaces or quotes

**Commands not showing up?**

- Run `npm run deploy` again
- Restart Discord (Ctrl+R)
- Make sure bot has proper permissions

**Bot not responding?**

- Check if bot shows as online in your server
- Verify MESSAGE CONTENT INTENT is enabled
- Check console for errors

## File Structure

```
OCRDiscordBot/
├── commands/
│   └── ocr-test.js      ← OCR slash command
├── index.js             ← Main bot file (start here)
├── deploy-commands.js   ← Registers slash commands
├── .env                 ← Your secrets (DON'T SHARE!)
└── package.json         ← Dependencies
```

## Need Help?

- Check README_DISCORD.md for detailed documentation
- Discord.js Guide: https://discordjs.guide/
- Make sure Node.js version is 16.9.0 or higher

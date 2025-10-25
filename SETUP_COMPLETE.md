# 🤖 Discord Bot Conversion Complete!

Your OCR program has been successfully converted into a Discord bot with slash commands!

## 📁 New Files Created

### Core Bot Files

- **`index.js`** - Main bot entry point, handles Discord connection and command loading
- **`deploy-commands.js`** - Deploys slash commands to your Discord guild
- **`check-config.js`** - Utility to verify your configuration is correct

### Commands

- **`commands/ocr-test.js`** - Slash command that accepts an image and performs OCR

### Configuration

- **`.env`** - Stores your Discord bot token and IDs (KEEP SECRET!)
- **`.env.example`** - Template for environment variables

### Documentation

- **`QUICKSTART.md`** - Quick step-by-step setup guide
- **`README_DISCORD.md`** - Detailed documentation and troubleshooting

### Updated Files

- **`package.json`** - Added Discord.js and dotenv dependencies
- **`.gitignore`** - Added .env and temp/ to prevent committing secrets

## 🚀 How to Use

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your Bot

Edit `.env` file and add:

- `DISCORD_TOKEN` - From Discord Developer Portal
- `CLIENT_ID` - Your application's client ID
- `GUILD_ID` - Your Discord server ID

### 3. Check Configuration

```bash
npm run check
```

### 4. Deploy Commands

```bash
npm run deploy
```

### 5. Start Bot

```bash
npm start
```

### 6. Use in Discord

Type `/ocr-test` and attach an image!

## 🎯 Key Features

### Slash Command: `/ocr-test`

- Accepts image attachment as parameter
- Downloads and preprocesses image for better OCR
- Shows progress updates during processing
- Returns cleaned, formatted text
- Handles long results by creating text files
- Automatically cleans up temporary files

### OCR Processing

- Uses Tesseract.js for text extraction
- Sharp for image preprocessing (resize, grayscale, contrast, sharpen)
- Advanced text cleaning for betting slips:
  - Fixes team names (A&M, etc.)
  - Cleans player names with apostrophes
  - Handles monetary values and odds
  - Removes UI artifacts and icons
  - Fixes common OCR errors

### Guild Deployment

- Commands deployed to specific guild (instant updates)
- No waiting for global command propagation
- Easy to update and test

## 📋 Available Commands

```bash
npm start       # Start the Discord bot
npm run deploy  # Deploy/update slash commands
npm run check   # Verify configuration
npm run ocr     # Run standalone OCR (original functionality)
```

## 🔧 Environment Variables

Required in `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
```

## 📚 Documentation

- **QUICKSTART.md** - Fast setup guide
- **README_DISCORD.md** - Complete documentation
- **Discord.js Guide** - https://discordjs.guide/

## 🛡️ Security

✅ `.env` is in `.gitignore`
✅ `.env.example` shows structure without secrets
✅ Temporary files are cleaned up automatically
✅ Token validation before deployment

## 🎨 Command Structure

Each command is a separate file in `commands/` with:

- `data` - SlashCommandBuilder definition
- `execute()` - Command logic

Easy to add more commands - just create new files in `commands/`!

## ⚡ Quick Test

After setup:

1. Make sure bot shows as online in Discord
2. Type `/` in any channel
3. You should see `/ocr-test` appear
4. Upload an image and watch it work!

## 📝 Next Steps

1. ✅ Read QUICKSTART.md
2. ✅ Set up your `.env` file
3. ✅ Run `npm install`
4. ✅ Run `npm run check`
5. ✅ Run `npm run deploy`
6. ✅ Run `npm start`
7. ✅ Test `/ocr-test` in Discord!

---

**Need help?** Check README_DISCORD.md for detailed troubleshooting!

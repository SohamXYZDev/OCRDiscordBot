# OCR Discord Bot Setup Guide

## Prerequisites

- Node.js 16.9.0 or higher
- A Discord account
- A Discord server where you have admin permissions

## Discord Bot Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - MESSAGE CONTENT INTENT
5. Click "Reset Token" and copy your bot token (keep this secret!)

### 2. Get Your Application/Client ID

1. Go to the "OAuth2" section
2. Copy your "Client ID"

### 3. Get Your Guild/Server ID

1. Open Discord and go to User Settings
2. Go to "Advanced" and enable "Developer Mode"
3. Right-click on your server name and click "Copy Server ID"

### 4. Invite Bot to Your Server

1. In the Developer Portal, go to "OAuth2" > "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Attach Files
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit the `.env` file and add your credentials:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
```

### 3. Deploy Commands

Deploy slash commands to your guild (instant updates):

```bash
npm run deploy
```

### 4. Start the Bot

```bash
npm start
```

## Usage

### OCR Test Command

Use the `/ocr-test` command in Discord:

1. Type `/ocr-test` in any channel
2. Upload an image when prompted
3. Wait for the bot to process the image
4. Receive the extracted text!

The bot will:

- Download and preprocess the image for better OCR accuracy
- Extract text using Tesseract OCR
- Clean and format the extracted text
- Return the results with confidence statistics

## Project Structure

```
OCRDiscordBot/
├── commands/           # Slash commands
│   └── ocr-test.js    # OCR command
├── temp/              # Temporary files (auto-created)
├── index.js           # Main bot file
├── deploy-commands.js # Command deployment script
├── ocr.js            # Original standalone OCR script
├── .env              # Environment variables (DO NOT COMMIT)
├── .env.example      # Example environment file
└── package.json      # Dependencies
```

## Troubleshooting

### Bot doesn't respond

- Make sure the bot is online (check console for "Discord bot is ready!")
- Verify bot has proper permissions in your server
- Check if commands were deployed successfully

### Commands not showing up

- Run `npm run deploy` again
- Make sure CLIENT_ID and GUILD_ID are correct in `.env`
- Wait a few seconds and restart Discord

### OCR errors

- Ensure the uploaded file is an image
- Check that the image is clear and readable
- Verify sharp and tesseract.js are installed correctly

## Security Notes

- **NEVER** commit your `.env` file to git
- Keep your bot token secret
- The `.gitignore` file should already exclude `.env`
- If your token is exposed, reset it immediately in the Developer Portal

## Additional Features

The OCR cleaning function handles:

- Sports team names (including special cases like A&M)
- Player names with apostrophes
- Betting odds and monetary values
- UI artifacts and symbols
- Common OCR misreads

## Support

For issues or questions, please check the Discord.js documentation:

- [Discord.js Guide](https://discordjs.guide/)
- [Discord.js Documentation](https://discord.js.org/)

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

console.log('🔍 Checking Discord Bot Configuration...\n');

let hasErrors = false;

// Check DISCORD_TOKEN
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_bot_token_here') {
    console.log('❌ DISCORD_TOKEN is missing or not set');
    console.log('   → Get it from: https://discord.com/developers/applications');
    console.log('   → Go to Bot section and reset token\n');
    hasErrors = true;
} else {
    console.log('✅ DISCORD_TOKEN is set');
}

// Check CLIENT_ID
if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your_client_id_here') {
    console.log('❌ CLIENT_ID is missing or not set');
    console.log('   → Get it from: https://discord.com/developers/applications');
    console.log('   → Go to OAuth2 section and copy Client ID\n');
    hasErrors = true;
} else {
    console.log('✅ CLIENT_ID is set');
}

// Check GUILD_ID
if (!process.env.GUILD_ID || process.env.GUILD_ID === 'your_guild_id_here') {
    console.log('❌ GUILD_ID is missing or not set');
    console.log('   → Enable Developer Mode in Discord');
    console.log('   → Right-click your server and Copy Server ID\n');
    hasErrors = true;
} else {
    console.log('✅ GUILD_ID is set');
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
    console.log('\n⚠️  Configuration incomplete!');
    console.log('Please update the .env file with your Discord credentials.\n');
    console.log('See QUICKSTART.md for detailed setup instructions.\n');
} else {
    console.log('\n✅ All configuration values are set!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run deploy');
    console.log('2. Run: npm start');
    console.log('3. Use /ocr-test in Discord!\n');
}

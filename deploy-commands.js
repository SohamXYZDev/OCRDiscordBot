import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Load all command files
const commandsPath = join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    
    if ('data' in command.default) {
        commands.push(command.default.data.toJSON());
        console.log(`✅ Loaded command: ${command.default.data.name}`);
    } else {
        console.warn(`⚠️  Command at ${filePath} is missing required "data" property.`);
    }
}

// Construct REST instance
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        // For guild-based deployment (faster, instant updates)
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands for guild.`);
        console.log('Commands deployed:');
        data.forEach(cmd => console.log(`  • /${cmd.name}`));
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';

config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const CHANNEL_ID = '1433575427175092314';
const IMAGES_DIR = './images/batch_test';

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const file = fs.createWriteStream(filepath);
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

client.once('ready', async () => {
    console.log('Logged in as ' + client.user.tag);
    console.log('Fetching messages from channel...');
    
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 100 });
        const imageMessages = messages.filter(msg => msg.attachments.size > 0);
        
        console.log('Found ' + imageMessages.size + ' messages with attachments');
        
        let imageCount = 0;
        const downloadedImages = [];
        
        for (const [, message] of imageMessages) {
            for (const [, attachment] of message.attachments) {
                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                    imageCount++;
                    const filename = 'test_' + imageCount + '.png';
                    const filepath = path.join(IMAGES_DIR, filename);
                    
                    console.log('Downloading image ' + imageCount);
                    
                    try {
                        await downloadImage(attachment.url, filepath);
                        downloadedImages.push({ number: imageCount, filename: filename, filepath: filepath });
                        console.log('  Saved as ' + filename);
                    } catch (error) {
                        console.error('  Failed: ' + error.message);
                    }
                }
            }
        }
        
        console.log('Total images downloaded: ' + downloadedImages.length);
        
        fs.writeFileSync(path.join(IMAGES_DIR, 'manifest.json'), JSON.stringify({
            downloadDate: new Date().toISOString(),
            channelId: CHANNEL_ID,
            totalImages: downloadedImages.length,
            images: downloadedImages
        }, null, 2));
        
        console.log('Manifest saved. Next: Run batch-test-ocr.js');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);

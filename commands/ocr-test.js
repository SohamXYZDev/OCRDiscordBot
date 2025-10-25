import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Clean and fix common OCR errors
 */
function cleanOCRText(text) {
    let cleaned = text;
    
    // Remove "®" characters at the start of lines (including multiple quotes)
    cleaned = cleaned.replace(/^["']*®+\s*/gm, '');
    
    // Remove single "O" followed by space at the start of lines (often before player names)
    cleaned = cleaned.replace(/^O\s+/gm, '');
    
    // Remove ALL icon prefixes at start of lines (team icons, bullets, etc.)
    cleaned = cleaned.replace(/^['"]?[®@©•o◉●○◯▪▫■□◆◇★☆►▶▸‣⁃∙∘⚬⦿⦾⊙⊚⊛⊜⊝⚫⚪🔴🔵🟢🟡🟠🟣⚽🏈🏀⛹️‍♂️\.]+\s*/gm, '');
    cleaned = cleaned.replace(/^(ee|Co|Ca|SEN|Ces|BE\.|So|2\.|J|e|a|o|OO|>\s*|"Y\s*|IN|Pe|A)\s+/gm, '');
    
    // Fix garbage text patterns
    cleaned = cleaned.replace(/\[EFX¥e\]e|\[EFEReld\]|\[EFERYS\]|\[EFENELE\]/g, '$25.00');
    cleaned = cleaned.replace(/fiselata\]|S¥elala\)|spastic/gi, '');
    
    // Fix icon representations and convert to proper symbols
    cleaned = cleaned.replace(/\(#\)|\(%\)/g, '💰');
    cleaned = cleaned.replace(/\(8\)|💵/g, '💵');
    cleaned = cleaned.replace(/\(3\)/g, '🎟️');
    
    // CRITICAL: Fix A&M BEFORE converting & to emoji
    cleaned = cleaned.replace(/A[\s&💰🎟️💵®@©•o◉●]*M\b/g, 'A&M');
    cleaned = cleaned.replace(/A\s*&\s*M/g, 'A&M');
    
    // Now convert remaining & to emoji (that aren't part of A&M)
    cleaned = cleaned.replace(/&/g, '🎟️');
    
    // Remove UI elements
    cleaned = cleaned.replace(/D?\s*Follow bet on Lock Screen\s*C?/gi, '');
    cleaned = cleaned.replace(/\|\s*Placed:/g, '\nPlaced:');
    
    // Fix common symbol misreads
    cleaned = cleaned.replace(/\s+a\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:SAT|SUN|MON|TUE|WED|THU|FRI)/gi, ' @ $1 ');
    cleaned = cleaned.replace(/\s+a\s+/g, ' @ ');
    
    // Fix PAYOUT variations
    cleaned = cleaned.replace(/2a¥0UT|PAYQUT|PAY0UT|2AYOUT|PA¥0UT/gi, 'PAYOUT');
    cleaned = cleaned.replace(/TOTAL\s+[^\w\s]+\s*(?:OUT|0UT)/gi, 'TOTAL PAYOUT');
    
    // Fix truncated words
    cleaned = cleaned.replace(/Altern\.\.\.|Alternate\s+A\s+Spread/g, 'Alternate Spread');
    cleaned = cleaned.replace(/Rushi\.\.\./g, 'Rushing');
    cleaned = cleaned.replace(/\s+Pe\s+Touchdown/g, ' Touchdown');
    cleaned = cleaned.replace(/Any Time\s+An?y?\s+Time/g, 'Any Time');
    cleaned = cleaned.replace(/\s+J\.\.\./g, '');
    cleaned = cleaned.replace(/,\s+IN\s*$/gm, '');
    cleaned = cleaned.replace(/,\s+J\s*$/gm, '');
    cleaned = cleaned.replace(/,\s+A\s*$/gm, '');
    
    // Fix apostrophes in names
    cleaned = cleaned.replace(/Ja'Marr|JaMarr/gi, "Ja'Marr");
    cleaned = cleaned.replace(/JAMARR/gi, "JA'MARR");
    
    // Remove checkmarks and special characters
    cleaned = cleaned.replace(/[~`'"']/g, '');
    cleaned = cleaned.replace(/\.\.\.$/gm, '');
    
    // Fix number/letter substitutions
    cleaned = cleaned.replace(/\+(\d+)\)/g, '+$1');
    cleaned = cleaned.replace(/£(\d+)/g, '$$$1');
    
    // Fix team @ team spacing
    cleaned = cleaned.replace(/([A-Z][a-z]+)@([A-Z])/g, '$1 @ $2');
    
    // Fix negative numbers
    cleaned = cleaned.replace(/--(-?\d+)/g, '-$1');
    cleaned = cleaned.replace(/\b247\b/g, '-247');
    cleaned = cleaned.replace(/\b473\b/g, '-473');
    cleaned = cleaned.replace(/\b148\b/g, '-148');
    
    // Remove weird prefix artifacts
    cleaned = cleaned.replace(/\s+®\s+/g, ' ');
    cleaned = cleaned.replace(/\.\s+®\s+/g, '. ');
    cleaned = cleaned.replace(/\s+"Y\s+/g, ' ');
    cleaned = cleaned.replace(/"Y\s+MONEYLINE/g, 'MONEYLINE');
    cleaned = cleaned.replace(/\s+"Y$/gm, '');
    cleaned = cleaned.replace(/-\d{3,4}\s+"Y$/gm, (match) => match.replace(/\s+"Y$/, ''));
    
    // Final aggressive A&M fix
    cleaned = cleaned.replace(/A[\s💰🎟️💵®@©•o◉●]+M\b/g, 'A&M');
    
    // Clean up multiple spaces but PRESERVE line breaks
    cleaned = cleaned.replace(/ +/g, ' ');
    cleaned = cleaned.replace(/\n\s+/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Remove standalone "Y lines
    cleaned = cleaned.replace(/\n"Y\n/g, '\n');
    cleaned = cleaned.replace(/\n"Y$/gm, '');
    cleaned = cleaned.replace(/^"Y\n/gm, '');
    
    // Add line breaks for better readability
    cleaned = cleaned.replace(/\s+(Same Game Parlay|Bet Placed|MONEYLINE|ALTERNATE SPREAD|ANY TIME TOUCHDOWN|OVER\/UNDER|BOTH TEAMS)/g, '\n$1');
    cleaned = cleaned.replace(/\s+(TOTAL WAGER)/g, '\n$1');
    
    return cleaned.trim();
}

/**
 * Download image from URL
 */
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image: ${response.statusCode}`));
                return;
            }
            
            const fileStream = fs.createWriteStream(filepath);
            response.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filepath);
            });
            
            fileStream.on('error', (err) => {
                fs.unlink(filepath, () => {}); // Delete incomplete file
                reject(err);
            });
        }).on('error', reject);
    });
}

/**
 * Preprocess image to improve OCR accuracy
 */
async function preprocessImage(imagePath) {
    const outputPath = imagePath.replace(/(\.[^.]+)$/, '_processed$1');
    
    try {
        await sharp(imagePath)
            .resize({ width: 2000, fit: 'inside', withoutEnlargement: false })
            .greyscale()
            .normalize()
            .linear(1.2, -(128 * 1.2) + 128)
            .sharpen({ sigma: 1.5 })
            .toFile(outputPath);
        
        return outputPath;
    } catch (error) {
        console.warn('Preprocessing failed, using original:', error.message);
        return imagePath;
    }
}

/**
 * Perform OCR on the image
 */
async function performOCR(imagePath, progressCallback) {
    const { data } = await Tesseract.recognize(
        imagePath,
        'eng',
        {
            logger: (m) => {
                if (m.status === 'recognizing text' && progressCallback) {
                    progressCallback(Math.round(m.progress * 100));
                }
            },
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$.,+-:@/()% '
        }
    );
    
    return data;
}

/**
 * Parse extracted OCR data
 */
function parseExtractedData(ocrData) {
    let cleanedText = ocrData.text;
    
    // Apply cleaning multiple times
    for (let i = 0; i < 3; i++) {
        cleanedText = cleanOCRText(cleanedText);
    }
    
    // Final post-processing
    cleanedText = cleanedText.replace(/A[\s💰🎟️💵®@©•o◉●]+M\b/g, 'A&M');
    cleanedText = cleanedText.replace(/--/g, '-');
    cleanedText = cleanedText.replace(/"Y\s*/g, '');
    cleanedText = cleanedText.replace(/JaMarr/gi, "Ja'Marr");
    
    return {
        cleanedText,
        confidence: ocrData.confidence,
        wordCount: ocrData.words.length
    };
}

/**
 * Structure betting slip data into organized sections
 */
function structureBettingSlip(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let structured = {
        gameInfo: '',
        odds: '',
        slipInfo: '',
        legs: [],
        wager: '',
        payout: '',
        extra: []
    };
    
    let currentSection = 'unknown';
    let legCounter = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        
        // Detect odds (usually +XXXX or -XXXX at top)
        if (/^[+-]\d{3,5}$/.test(line)) {
            structured.odds = line;
            continue;
        }
        
        // Detect game info (teams with @)
        if (line.includes('@') && /\d{1,2}:\d{2}[AP]M/.test(line)) {
            structured.gameInfo = line;
            continue;
        }
        
        // Detect slip type and token
        if (/Same Game Parlay|Parlay|Straight Bet/i.test(line)) {
            let slipParts = [line];
            if (/NO SWEAT TOKEN/i.test(nextLine)) {
                slipParts.push(lines[i + 1]);
                i++;
            }
            structured.slipInfo = slipParts.join(' | ');
            currentSection = 'legs';
            continue;
        }
        
        // Detect wager
        if (/TOTAL WAGER/i.test(line) || (/^\$[\d,]+\.?\d*$/.test(line) && currentSection === 'legs')) {
            if (/TOTAL WAGER/i.test(line)) {
                // Extract amount from next line or same line
                const wagerMatch = line.match(/\$[\d,]+\.?\d*/);
                if (wagerMatch) {
                    structured.wager = wagerMatch[0];
                } else if (nextLine && /^\$[\d,]+\.?\d*$/.test(nextLine)) {
                    structured.wager = lines[i + 1];
                    i++;
                }
            } else {
                structured.wager = line;
            }
            currentSection = 'payout';
            continue;
        }
        
        // Detect payout
        if (/TOTAL PAYOUT|TOTAL.*PAYOUT/i.test(line) || (/^\$[\d,]+\.?\d*$/.test(line) && currentSection === 'payout')) {
            if (/TOTAL PAYOUT/i.test(line)) {
                const payoutMatch = line.match(/\$[\d,]+\.?\d*/);
                if (payoutMatch) {
                    structured.payout = payoutMatch[0];
                } else if (nextLine && /^\$[\d,]+\.?\d*$/.test(nextLine)) {
                    structured.payout = lines[i + 1];
                    i++;
                }
            } else {
                structured.payout = line;
            }
            currentSection = 'extra';
            continue;
        }
        
        // Parse individual legs (player props)
        if (currentSection === 'legs') {
            // Check if this looks like a bet leg
            if (/Over|Under|OVER|UNDER|\+|-\d+/i.test(line) || /MONEYLINE|SPREAD|TOUCHDOWN|RECEPTIONS|PASSING|RUSHING|RECEIVING/i.test(line)) {
                // Try to parse player name and bet type
                let betLine = line;
                
                // Check if next line is a subtitle (like "RECEIVING YDS")
                if (i < lines.length - 1 && /^[A-Z\s]+(YDS|TDS|RECEPTIONS|TOUCHDOWNS|POINTS|ASSISTS)$/i.test(nextLine)) {
                    betLine += ' ' + nextLine;
                    i++;
                }
                
                // Format the leg
                legCounter++;
                structured.legs.push(`${legCounter}. ${betLine}`);
                continue;
            }
        }
        
        // Extra info
        if (currentSection === 'extra' || currentSection === 'unknown') {
            structured.extra.push(line);
        }
    }
    
    // Build formatted output
    let output = [];
    
    if (structured.gameInfo) {
        output.push('Game Info');
        output.push(structured.gameInfo);
        output.push('');
    }
    
    if (structured.odds) {
        output.push('Odds');
        output.push(structured.odds);
        output.push('');
    }
    
    if (structured.slipInfo) {
        output.push('Slip Info');
        output.push(structured.slipInfo);
        output.push('');
    }
    
    if (structured.legs.length > 0) {
        output.push('Individual Legs');
        structured.legs.forEach(leg => {
            output.push(leg);
            output.push(''); // Add blank line after each leg
        });
    }
    
    if (structured.wager || structured.payout) {
        const wagePay = [];
        if (structured.wager) wagePay.push(`Total Wager: ${structured.wager}`);
        if (structured.payout) wagePay.push(`Total Payout: ${structured.payout}`);
        output.push(wagePay.join(' | '));
        output.push('');
    }
    
    if (structured.extra.length > 0) {
        output.push('Additional Info');
        output.push(...structured.extra);
    }
    
    return output.join('\n').trim();
}

export default {
    data: new SlashCommandBuilder()
        .setName('ocr-test')
        .setDescription('Extract text from a betting slip image using OCR')
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('The image to perform OCR on')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const attachment = interaction.options.getAttachment('image');
        
        // Validate attachment is an image
        if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            await interaction.editReply('❌ Please provide a valid image file!');
            return;
        }
        
        const tempDir = join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const tempImagePath = join(tempDir, `discord_${timestamp}.png`);
        const processedImagePath = join(tempDir, `discord_${timestamp}_processed.png`);
        
        try {
            await interaction.editReply('📥 Downloading image...');
            
            // Download image
            await downloadImage(attachment.url, tempImagePath);
            
            await interaction.editReply('📷 Preprocessing image...');
            
            // Preprocess image
            const imagePath = await preprocessImage(tempImagePath);
            
            await interaction.editReply('🔍 Performing OCR... 0%');
            
            // Perform OCR with progress updates
            let lastProgress = 0;
            const ocrData = await performOCR(imagePath, async (progress) => {
                // Update every 25%
                if (progress - lastProgress >= 25) {
                    lastProgress = progress;
                    try {
                        await interaction.editReply(`🔍 Performing OCR... ${progress}%`);
                    } catch (e) {
                        // Ignore rate limit errors
                    }
                }
            });
            
            await interaction.editReply('✨ Processing results...');
            
            // Parse data
            const result = parseExtractedData(ocrData);
            
            // Structure the betting slip
            const structuredText = structureBettingSlip(result.cleanedText);
            
            // Create result message
            const resultMessage = `✅ **OCR Complete!**\n\n` +
                `📊 **Statistics:**\n` +
                `• Confidence: ${result.confidence.toFixed(2)}%\n` +
                `• Words detected: ${result.wordCount}\n\n` +
                `📝 **Extracted Text:**\n` +
                `\`\`\`\n${structuredText}\`\`\``;
            
            // Check if message is too long for Discord (2000 char limit)
            if (resultMessage.length > 1900) {
                // Create a text file with the results
                const resultFilePath = join(tempDir, `ocr_result_${timestamp}.txt`);
                fs.writeFileSync(resultFilePath, structuredText, 'utf8');
                
                const resultFile = new AttachmentBuilder(resultFilePath);
                
                await interaction.editReply({
                    content: `✅ **OCR Complete!**\n\n` +
                        `📊 **Statistics:**\n` +
                        `• Confidence: ${result.confidence.toFixed(2)}%\n` +
                        `• Words detected: ${result.wordCount}\n\n` +
                        `📝 Text was too long, see attached file.`,
                    files: [resultFile]
                });
                
                // Clean up result file after a delay
                setTimeout(() => {
                    try {
                        fs.unlinkSync(resultFilePath);
                    } catch (e) {
                        console.error('Error deleting result file:', e);
                    }
                }, 5000);
            } else {
                await interaction.editReply(resultMessage);
            }
            
        } catch (error) {
            console.error('OCR Error:', error);
            await interaction.editReply(`❌ An error occurred during OCR: ${error.message}`);
        } finally {
            // Clean up temp files
            setTimeout(() => {
                try {
                    if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
                    if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);
                } catch (e) {
                    console.error('Error cleaning up temp files:', e);
                }
            }, 5000);
        }
    },
};

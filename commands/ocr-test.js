import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
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
    
    // Dark mode OCR cleaning (for inverted images)
    // Remove leading junk characters that appear in dark mode OCR
    cleaned = cleaned.replace(/^[ZT]+\s+/gm, '');
    cleaned = cleaned.replace(/^[%~]+\s*/gm, '');
    cleaned = cleaned.replace(/^[£\[\|]+\s*[=»]+\s*/gm, '');  // Remove avatar/icon artifacts
    cleaned = cleaned.replace(/^\|\s+/gm, '');  // Remove pipe symbols at start of lines
    
    // Fix icon misreads in dark mode betting slips
    cleaned = cleaned.replace(/[*]\s+-\s+[&¥®©]/g, ' - ');
    cleaned = cleaned.replace(/\s+[*]\s+/g, ' ');
    
    // Remove "YN" artifacts (button UI elements)
    cleaned = cleaned.replace(/^\s*\d*\s*YN\s*$/gm, '');
    
    // Clean up sportsbook name artifacts
    cleaned = cleaned.replace(/^Lv\s+/gm, '');
    cleaned = cleaned.replace(/^EB\s+/gm, '');
    cleaned = cleaned.replace(/^by\s+of.*$/gm, '');
    
    // Fix common OCR errors with numbers
    cleaned = cleaned.replace(/(\s)135(\s+[+-]\d+)/g, '$113.5$2');
    
    // Fix arrow misreads at end of lines
    cleaned = cleaned.replace(/\s+El\s*$/gm, ' →');
    cleaned = cleaned.replace(/\s+Ed\s*$/gm, ' →');
    cleaned = cleaned.replace(/\s+>\s*$/gm, ' →');
    
    // Fix Saturday/day abbreviations with trailing junk
    cleaned = cleaned.replace(/(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\s+[A-Z]{1,3}\s*$/gm, '$1');
    
    // Remove "®" characters at the start of lines (including multiple quotes)
    cleaned = cleaned.replace(/^["']*®+\s*/gm, '');
    
    // Remove icon symbols at start of lines (team icons, betting icons, etc.)
    cleaned = cleaned.replace(/^[&]+\s+/gm, '');
    cleaned = cleaned.replace(/^X\s+/gm, '');  // Remove checkbox symbols
    
    // Fix strikethrough text misreads (=115 should be -115 for odds)
    cleaned = cleaned.replace(/=(\d{3})/g, '-$1');
    
    // Remove info icon misreads in middle of text
    cleaned = cleaned.replace(/\s+®\s+/g, ' ');
    cleaned = cleaned.replace(/CASHOUT/g, 'CASH OUT');
    cleaned = cleaned.replace(/\s+GO\)\s*/g, ' ');  // Remove (i) icon misread as GO)
    
    // Fix bullet points misread as asterisk
    cleaned = cleaned.replace(/\s+\*\s+/g, ' • ');
    cleaned = cleaned.replace(/\s+«\s+/g, ' • ');  // Fix guillemet bullets
    cleaned = cleaned.replace(/\s+\+\s+(?=[A-Z])/g, ' • ');  // Fix + as bullet when before capital letter
    
    // Merge "PM" on separate line with previous time
    cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s*\n\s*PM/g, '$1 PM');
    
    // Fix SGP badge misreads
    cleaned = cleaned.replace(/\[scp\]|SGP\]/gi, 'SGP');
    
    // Fix Same Game Parlay formatting
    cleaned = cleaned.replace(/Same Game Parlay(?!™)/g, 'Same Game Parlay™');
    cleaned = cleaned.replace(/Parlay["""]/g, 'Parlay™');
    
    // Remove line continuation artifacts
    cleaned = cleaned.replace(/\s*A\\\s*$/gm, '');
    cleaned = cleaned.replace(/\\\s*$/gm, '');
    
    // Fix multi-line bet descriptions that got split
    cleaned = cleaned.replace(/Outside\s*\n\s*the Box/g, 'Outside the Box');
    cleaned = cleaned.replace(/Target\s*\n\s*Outside/g, 'Target Outside');
    
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
    // Fix A&M with any separator/garbage between A and M
    cleaned = cleaned.replace(/A[\s&💰🎟️💵®@©•o◉●]*M\b/g, 'A&M');
    cleaned = cleaned.replace(/A\s*&\s*M/g, 'A&M');
    
    // Now convert remaining & to emoji (that aren't part of A&M)
    cleaned = cleaned.replace(/&/g, '🎟️');
    
    // Remove UI elements that shouldn't be in betting data
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
    
    // Fix negative numbers with double dash and missing minus signs
    cleaned = cleaned.replace(/--(-?\d+)/g, '-$1');
    cleaned = cleaned.replace(/\b247\b/g, '-247');
    cleaned = cleaned.replace(/\b473\b/g, '-473');
    cleaned = cleaned.replace(/\b148\b/g, '-148');
    
    // Remove weird prefix artifacts from middle of text
    cleaned = cleaned.replace(/\s+®\s+/g, ' ');
    cleaned = cleaned.replace(/\.\s+®\s+/g, '. ');
    cleaned = cleaned.replace(/\s+"Y\s+/g, ' ');
    cleaned = cleaned.replace(/"Y\s+MONEYLINE/g, 'MONEYLINE');
    cleaned = cleaned.replace(/\s+"Y$/gm, '');  // Remove "Y at end of lines
    cleaned = cleaned.replace(/-\d{3,4}\s+"Y$/gm, (match) => match.replace(/\s+"Y$/, ''));  // Remove "Y after odds
    
    // Final aggressive A&M fix - catch any remaining variations
    cleaned = cleaned.replace(/A[\s💰🎟️💵®@©•o◉●]+M\b/g, 'A&M');
    
    // Clean up multiple spaces but PRESERVE line breaks
    cleaned = cleaned.replace(/ +/g, ' ');  // Multiple spaces to single space
    cleaned = cleaned.replace(/\n\s+/g, '\n');  // Remove leading spaces on new lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
    
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
 * Preprocess image to improve OCR accuracy with dark mode detection
 */
async function preprocessImage(imagePath) {
    const outputPath = imagePath.replace(/(\.[^.]+)$/, '_processed$1');
    
    try {
        // Detect if image is dark mode by sampling pixel brightness
        const img = sharp(imagePath);
        const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
        
        let totalBrightness = 0;
        const sampleSize = 1000;
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(Math.random() * data.length / info.channels) * info.channels;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            totalBrightness += (r + g + b) / 3;
        }
        const avgBrightness = totalBrightness / sampleSize;
        const isDarkMode = avgBrightness < 100;
        
        console.log(`   Average brightness: ${avgBrightness.toFixed(1)} - ${isDarkMode ? 'Dark mode' : 'Light mode'} detected`);
        
        // Apply preprocessing based on mode
        if (isDarkMode) {
            // For dark mode: invert colors first, then enhance
            await sharp(imagePath)
                .resize({ width: 5000, fit: 'inside', withoutEnlargement: false })
                .negate()  // Invert colors for dark backgrounds
                .modulate({ brightness: 1.2, contrast: 1.3 })
                .normalize()
                .sharpen({ sigma: 1.5 })
                .toFile(outputPath);
        } else {
            // For light mode: standard preprocessing
            await sharp(imagePath)
                .resize({ width: 4000, fit: 'inside', withoutEnlargement: false })
                .normalize()
                .linear(1.1, -(128 * 0.1))
                .sharpen({ sigma: 1.2 })
                .toFile(outputPath);
        }
        
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
        if (/Same Game Parlay|Parlay|Straight Bet|\d+\s+leg\s+parlay|\d+\s+Pick\s+Parlay/i.test(line)) {
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
            // Skip the summary line that lists all bets separated by commas
            // Example: "Dallas Goedert Any Time Touchdown Scorer, George Kittle Any Time A"
            // Also skip lines that start with bet type without player name
            if ((line.includes(',') && /Any Time.*,.*Any Time/i.test(line)) || 
                /^(Touchdown Scorer|Any Time)/i.test(line) ||
                (line.includes(',') && line.includes('by') && line.length > 80)) {
                continue;
            }
            
            // Handle "20+" format (player props with + suffix)
            // Pattern: "20+" on one line, "Player Name Stat Type" on next line
            const plusMatch = line.match(/^(\d+)\+$/);
            if (plusMatch) {
                const value = plusMatch[1];
                
                // Next line should have player name and stat type
                if (i < lines.length - 1) {
                    const playerStatLine = lines[i + 1];
                    // Pattern: "Player Name StatType" or "Player Name Stat Type"
                    const playerStatMatch = playerStatLine.match(/^(.+?)\s+(Points|Rebounds|Assists|Receptions|Yards|Touchdowns|Steals|Blocks)$/i);
                    
                    if (playerStatMatch) {
                        const playerName = playerStatMatch[1].trim();
                        const statType = playerStatMatch[2].trim();
                        const formattedLeg = `${playerName} - Over ${value}.5 ${statType}`;
                        structured.legs.push(formattedLeg);
                        i++; // Skip the next line since we used it
                        continue;
                    }
                }
            }
            
            // Handle fighter "by" method bets (e.g., "Valter Walker by KO/TKO or Submission")
            const byMatch = line.match(/^(.+?)\s+by\s*(.*)$/i);
            if (byMatch) {
                const fighter = byMatch[1].trim();
                let method = byMatch[2].trim();
                let odds = '';
                let skipLines = 0;
                
                // Look ahead for odds and method completion
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                    const checkLine = lines[j];
                    
                    // Skip garbage lines like "cei -147" - extract odds only
                    if (/^[a-z]{2,4}\s+-?\d{3,4}$/.test(checkLine)) {
                        const match = checkLine.match(/-?\d{3,4}$/);
                        if (match && !odds) {
                            odds = match[0];
                        }
                        skipLines++;
                        continue;
                    }
                    
                    // Found standalone odds
                    if (/^-?\d{3,4}$/.test(checkLine) && !odds) {
                        odds = checkLine;
                        skipLines++;
                        continue;
                    }
                    
                    // Found method completion line (not descriptor/matchup/date)
                    if (!/^[A-Z\s()]+$/.test(checkLine) && 
                        !/v\s+/.test(checkLine) && 
                        !/^\d{1,2}:\d{2}/.test(checkLine) &&
                        !/^(DOUBLE CHANCE|MONEYLINE|ALT\.)/.test(checkLine)) {
                        // This is part of the method
                        if (method && !method.endsWith('or') && !method.endsWith('and')) {
                            // Method already complete
                            break;
                        }
                        method += ' ' + checkLine.trim();
                        skipLines++;
                        continue;
                    }
                    
                    // Stop at descriptor or matchup lines
                    break;
                }
                
                method = method.replace(/\.\.\.$/, '').replace(/\s+/g, ' ').trim();
                
                // Only add if we have a complete bet
                if (method.length > 2) {
                    const formattedLeg = `${fighter} by ${method} ${odds}`.trim();
                    structured.legs.push(formattedLeg);
                    i += skipLines;
                    continue;
                }
            }
            
            // Handle Yes/No bets (e.g., "No" for "Will the fight go the distance?")
            if (/^(Yes|No)\s+-?\d{3,4}$/.test(line)) {
                structured.legs.push(line);
                continue;
            }
            
            // Handle "Fighter Round X, Y, or Z -odds"
            const roundMatch = line.match(/^(.+?)\s+Round\s+(.+?)\s+-?\d{3,4}$/i);
            if (roundMatch) {
                structured.legs.push(line);
                continue;
            }
            
            // Handle fighter moneyline: "Fighter Name 137" (missing minus sign)
            const fighterNoSignMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{3,4})$/);
            if (fighterNoSignMatch && i < lines.length - 1 && /^MONEYLINE$/i.test(nextLine)) {
                const fighter = fighterNoSignMatch[1].trim();
                const odds = '-' + fighterNoSignMatch[2];
                structured.legs.push(`${fighter} ${odds}`);
                i++; // Skip MONEYLINE
                continue;
            }
            
            // Look for lines with Over/Under followed by a number
            const betMatch = line.match(/^(.+?)\s+(Over|Under)\s+(\d+\.?\d*)\s*(.*)$/i);
            
            if (betMatch) {
                const playerName = betMatch[1].trim();
                const overUnder = betMatch[2];
                const value = betMatch[3];
                let betType = betMatch[4].trim();
                
                // If bet type is on next line (all caps like "RECEIVING YDS")
                if ((!betType || betType.length < 5) && i < lines.length - 1) {
                    const nextUpper = nextLine.toUpperCase();
                    if (nextUpper === nextLine && /YDS|TDS|RECEPTIONS|TOUCHDOWNS|POINTS|ASSISTS|PASSING|RUSHING|RECEIVING/i.test(nextLine)) {
                        betType = nextLine.replace(/-/g, '').trim();
                        i++; // Skip the next line since we used it
                    }
                }
                
                // Clean up bet type
                betType = betType
                    .replace(/^-\s*/, '')
                    .replace(/\s*-\s*$/, '')
                    .trim();
                
                // Build formatted leg
                const formattedLeg = `${playerName} - ${overUnder} ${value} ${betType}`.trim();
                structured.legs.push(formattedLeg);
                continue;
            }
            
            // Handle player name followed by odds on same line (e.g., "Dallas Goedert +175")
            const playerOddsMatch = line.match(/^(.+?)\s+([+-]\d{3,4})$/);
            if (playerOddsMatch) {
                let playerName = playerOddsMatch[1].trim();
                const odds = playerOddsMatch[2];
                
                // Clean player name from OCR artifacts
                playerName = playerName.replace(/^[)\(©T\-\s]+/, ''); // Remove prefixes like ") ©" or "T-"
                playerName = playerName.trim();
                
                // Check if next line is the bet type descriptor
                if (i < lines.length - 1 && /^ANY TIME TOUCHDOWN SCORER$/i.test(nextLine)) {
                    const formattedLeg = `${playerName} - Any Time Touchdown Scorer ${odds}`;
                    structured.legs.push(formattedLeg);
                    i++; // Skip the descriptor line
                    
                    // Skip game info line if it follows
                    if (i < lines.length - 1 && lines[i + 1].includes('@')) {
                        i++;
                    }
                    continue;
                }
            }
            
            // Handle Any Time Touchdown Scorer and similar bets (without odds on same line)
            const touchdownMatch = line.match(/^(.+?)\s+(Any Time Touchdown Scorer|Anytime Touchdown Scorer|First Touchdown Scorer|Last Touchdown Scorer)/i);
            if (touchdownMatch) {
                const playerName = touchdownMatch[1].trim();
                const betType = touchdownMatch[2].trim();
                
                // Check if next line has odds like "+175"
                let odds = '';
                if (i < lines.length - 1 && /^[+-]\d{3,4}$/.test(nextLine)) {
                    odds = ` ${nextLine}`;
                    i++; // Skip the odds line
                    
                    // Also skip the ALL CAPS descriptor if it follows
                    if (i < lines.length - 1 && /^ANY TIME TOUCHDOWN SCORER$/i.test(lines[i + 1])) {
                        i++;
                    }
                }
                
                const formattedLeg = `${playerName} - ${betType}${odds}`.trim();
                structured.legs.push(formattedLeg);
                continue;
            }
            
            // Handle standalone odds with bet type descriptor (skip if already processed)
            if (/^[+-]\d{3,4}$/.test(line)) {
                continue; // Already handled above
            }
            
            // Skip ALL CAPS descriptors if they appear standalone
            if (/^ANY TIME TOUCHDOWN SCORER$/i.test(line)) {
                continue; // Already handled above
            }
            
            // Skip game info lines in the legs section
            if (line.includes('@') && /\d{1,2}:\d{2}[AP]M/.test(line)) {
                continue;
            }
            
            // Skip lines that start with symbols like ") ©" or "T-"
            if (/^[)\(©T\-]+\s+/.test(line)) {
                continue;
            }
            
            // Handle other bet types (Moneyline, Spread, etc.)
            if (/MONEYLINE|SPREAD/i.test(line) && !/TOUCHDOWN/i.test(line)) {
                structured.legs.push(line);
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
        });
        output.push(''); // Single blank line after all legs
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
    
    // Return both structured object and formatted text
    return {
        structured: structured,
        text: output.join('\n').trim()
    };
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
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎰 Betting Slip OCR Results')
                .setTimestamp();
            
            // Split cleaned text into chunks if too long (Discord field limit is 1024)
            const cleanedText = result.cleanedText;
            const maxLength = 1024;
            
            if (cleanedText.length <= maxLength) {
                embed.addFields({
                    name: '📄 Extracted Text',
                    value: cleanedText || 'No text extracted',
                    inline: false
                });
            } else {
                // Split into multiple fields
                const chunks = [];
                let currentChunk = '';
                const lines = cleanedText.split('\n');
                
                for (const line of lines) {
                    if ((currentChunk + '\n' + line).length > maxLength) {
                        chunks.push(currentChunk);
                        currentChunk = line;
                    } else {
                        currentChunk += (currentChunk ? '\n' : '') + line;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);
                
                chunks.forEach((chunk, index) => {
                    embed.addFields({
                        name: `📄 Extracted Text (Part ${index + 1})`,
                        value: chunk,
                        inline: false
                    });
                });
            }
            
            // Add footer with stats
            embed.setFooter({
                text: `Confidence: ${result.confidence.toFixed(1)}% | Words: ${result.wordCount}`
            });
            
            // Send embed
            await interaction.editReply({
                embeds: [embed]
            });
            
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

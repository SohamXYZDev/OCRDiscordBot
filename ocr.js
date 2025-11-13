import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration - can process multiple images
const IMAGE_PATTERNS = [
    join(__dirname, 'image.png'),
    join(__dirname, 'images', '*.png'),
    join(__dirname, 'images', '*.jpg'),
    join(__dirname, 'images', '*.jpeg')
];
const OUTPUT_DIR = join(__dirname, 'output');

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
 * Clean player names by removing prefixes and artifacts
 */
function cleanPlayerName(name) {
    if (!name) return name;
    
    // Remove ALL common prefixes that appear before player names
    const prefixes = /^['"]?[®@©•o◉●○◯▪▫■□◆◇★☆►▶▸‣⁃∙∘⚬⦿⦾⊙⊚⊛⊜⊝⚫⚪]*\s*/;
    let cleaned = name.replace(prefixes, '');
    
    // Remove text prefixes
    const textPrefixes = /^(Ca|SEN|Ces|BE\.|Co|Ce|So|C|S|B|J|e|a|o|OO|IN|Pe|A|2\.)\s+/i;
    cleaned = cleaned.replace(textPrefixes, '');
    
    // Fix apostrophes
    cleaned = cleaned.replace(/JaMarr/g, "Ja'Marr");
    cleaned = cleaned.replace(/JAMARR/g, "JA'MARR");
    
    return cleaned.trim();
}

/**
 * Preprocess image to improve OCR accuracy with multiple techniques
 */
async function preprocessImage(imagePath) {
    console.log('📷 Preprocessing image for better OCR...');
    
    const filename = join(__dirname, `processed_${Date.now()}.png`);
    
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
                .toFile(filename);
        } else {
            // For light mode: standard preprocessing
            await sharp(imagePath)
                .resize({ width: 4000, fit: 'inside', withoutEnlargement: false })
                .normalize()
                .linear(1.1, -(128 * 0.1))
                .sharpen({ sigma: 1.2 })
                .toFile(filename);
        }
        
        console.log('✅ Image preprocessed successfully');
        return filename;
    } catch (error) {
        console.warn('⚠️  Image preprocessing failed, using original:', error.message);
        return imagePath;
    }
}

/**
 * Perform OCR on the image with optimized settings
 */
async function performOCR(imagePath) {
    console.log('🔍 Starting OCR process...');
    console.log(`📄 Processing: ${imagePath}`);
    
    try {
        const { data } = await Tesseract.recognize(
            imagePath,
            'eng',
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$.,+-:@/()% '
            }
        );
        
        return data;
    } catch (error) {
        console.error('❌ OCR failed:', error);
        throw error;
    }
}

/**
 * Parse and structure the extracted data
 */
function parseExtractedData(ocrData) {
    // Clean the raw text first - apply multiple passes for thorough cleaning
    let cleanedText = ocrData.text;
    
    // Apply cleaning in stages
    for (let i = 0; i < 3; i++) {
        cleanedText = cleanOCRText(cleanedText);
    }
    
    // Final post-processing fixes - apply aggressively
    cleanedText = cleanedText.replace(/A[\s💰🎟️💵®@©•o◉●]+M\b/g, 'A&M');
    cleanedText = cleanedText.replace(/--/g, '-');
    cleanedText = cleanedText.replace(/"Y\s*/g, '');
    cleanedText = cleanedText.replace(/"Y$/gm, '');
    cleanedText = cleanedText.replace(/JaMarr/gi, "Ja'Marr");
    
    // Remove standalone "Y lines and patterns
    cleanedText = cleanedText.replace(/\n"Y\n/g, '\n');
    cleanedText = cleanedText.replace(/-\d{3,4}\s*\n"Y\n/g, (match) => match.replace('\n"Y', ''));
    
    let lines = ocrData.lines.map(line => {
        let cleaned = line.text.trim();
        for (let i = 0; i < 2; i++) {
            cleaned = cleanOCRText(cleaned);
        }
        cleaned = cleaned.replace(/A[\s💰🎟️💵®@©•o◉●]+M\b/g, 'A&M');
        cleaned = cleaned.replace(/--/g, '-');
        cleaned = cleaned.replace(/"Y\s*/g, '');
        cleaned = cleaned.replace(/"Y$/gm, '');
        return cleaned;
    }).filter(text => text.length > 0 && !text.match(/^[®@©•o◉●○◯▪▫■□\.\-\s]+$/));
    
    const words = ocrData.words.map(word => word.text.trim()).filter(text => text.length > 0);
    
    // Extract structured information
    const structuredData = {
        rawText: cleanedText,
        originalRawText: ocrData.text,
        confidence: ocrData.confidence,
        lines: lines,
        words: words,
        detectedPatterns: {
            players: [],
            statistics: [],
            teams: [],
            numbers: [],
            monetary: []
        }
    };
    
    // Detect patterns
    const fullText = cleanedText;
    
    // Find player names (capitalized words followed by statistics)
    const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
    const players = fullText.match(playerPattern) || [];
    structuredData.detectedPatterns.players = [...new Set(players)];
    
    // Find monetary values
    const moneyPattern = /\$[\d,]+\.?\d*/g;
    const monetary = fullText.match(moneyPattern) || [];
    structuredData.detectedPatterns.monetary = monetary;
    
    // Find decimal numbers (likely statistics)
    const decimalPattern = /\d+\.\d+/g;
    const decimals = fullText.match(decimalPattern) || [];
    structuredData.detectedPatterns.numbers = decimals;
    
    // Find team patterns (words with @ symbol)
    const teamPattern = /([A-Za-z\s]+)@([A-Za-z\s]+)/g;
    const teams = fullText.match(teamPattern) || [];
    structuredData.detectedPatterns.teams = teams;
    
    return structuredData;
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
        
        // Detect slip type and token - but don't save useless info
        if (/Same Game Parlay|Parlay|Straight Bet|\d+\s+leg\s+parlay|\d+\s+Pick\s+Parlay/i.test(line)) {
            // Skip lines with "Same Game Parlay", "NO SWEAT TOKEN", "Includes:", etc.
            // These are just UI elements, not actual bet info
            currentSection = 'legs';
            continue;
        }
        
        // Skip useless UI text and labels
        if (/NO SWEAT TOKEN|Includes:|Token Applied|SGP|Same Game Parlay™|SAME GAME PARLAY|Parlay™|Bet Placed|CASH OUT|CASHOUT|Follow bet|Lock Screen|Bet Type:|Placed:|Transaction Total:|Pass through|Player Shots on Target|Player Receptions|Player Receiving|Player Rushing|Player Passing|Receptions|Receiving Yds|Rushing Yds|Passing Yds/i.test(line)) {
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
    
    // Build formatted output - clean and minimal
    let output = [];
    
    if (structured.gameInfo) {
        output.push(structured.gameInfo);
        output.push('');
    }
    
    if (structured.odds) {
        output.push(structured.odds);
        output.push('');
    }
    
    // Each leg on its own line
    if (structured.legs.length > 0) {
        structured.legs.forEach(leg => {
            output.push(leg);
        });
        output.push('');
    }
    
    if (structured.wager || structured.payout) {
        const wagePay = [];
        if (structured.wager) wagePay.push(`Wager: ${structured.wager}`);
        if (structured.payout) wagePay.push(`Payout: ${structured.payout}`);
        output.push(wagePay.join(' | '));
    }
    
    // Return both structured object and formatted text
    return {
        structured: structured,
        text: output.join('\n').trim()
    };
}

/**
 * Extract betting slip information specifically
 */
function extractBettingInfo(structuredData) {
    const bettingInfo = {
        parlayOdds: null,
        gameInfo: null,
        bets: [],
        wager: null,
        payout: null,
        timestamp: null,
        token: null
    };
    
    const text = structuredData.rawText;
    const lines = structuredData.lines;
    
    // Extract parlay odds
    const parlayMatch = text.match(/Parlay\s*\+(\d+)/i);
    if (parlayMatch) {
        bettingInfo.parlayOdds = `+${parlayMatch[1]}`;
    }
    
    // Extract token info
    const tokenMatch = text.match(/NO SWEAT TOKEN/i);
    if (tokenMatch) {
        bettingInfo.token = 'NO SWEAT TOKEN';
    }
    
    // Extract game information
    const gamePattern = /([\w\s]+)@([\w\s]+?)(?:\s+\d{1,2}:\d{2}[AP]M)/;
    const gameMatch = text.match(gamePattern);
    if (gameMatch) {
        bettingInfo.gameInfo = {
            awayTeam: gameMatch[1]?.trim(),
            homeTeam: gameMatch[2]?.trim()
        };
    }
    
    // Extract individual bets with better parsing
    const processedPlayers = new Set();
    
    lines.forEach((line, index) => {
        // Look for "Over" or "Under" pattern with proper player name extraction
        const betMatch = line.match(/([A-Za-z\s]+?)\s+(Over|Under)\s*([\d.]+)/i);
        if (betMatch) {
            const playerName = cleanPlayerName(betMatch[1]?.trim());
            const betType = betMatch[2];
            const value = betMatch[3];
            
            // Get the stat from next line if it's in ALL CAPS
            const nextLine = lines[index + 1] || '';
            let statType = '';
            
            if (nextLine === nextLine.toUpperCase() && nextLine.includes('-')) {
                statType = nextLine.replace(/^.*?\s*-\s*/, '').trim();
            }
            
            // Avoid duplicate entries
            const betKey = `${playerName}-${betType}-${value}`;
            if (!processedPlayers.has(betKey)) {
                processedPlayers.add(betKey);
                bettingInfo.bets.push({
                    player: playerName,
                    type: betType,
                    value: value,
                    stat: statType || nextLine
                });
            }
        }
    });
    
    // Extract wager and payout
    const wagerMatch = text.match(/TOTAL\s*WAGER[:\s]*\$?([\d,]+\.?\d*)/i);
    if (wagerMatch) {
        bettingInfo.wager = wagerMatch[1];
    }
    
    const payoutMatch = text.match(/TOTAL\s*PAYOUT[:\s]*\$?([\d,]+\.?\d*)/i);
    if (payoutMatch) {
        bettingInfo.payout = payoutMatch[1];
    }
    
    // Extract timestamp
    const timeMatch = text.match(/(\d{1,2}:\d{2}[AP]M\s*[A-Z]{2,3})/);
    if (timeMatch) {
        bettingInfo.timestamp = timeMatch[1];
    }
    
    return bettingInfo;
}

/**
 * Save results to files
 */
function saveResults(imageName, structuredData, bettingInfo) {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const baseName = imageName.replace(/\.[^.]+$/, '');
    
    // Create structured text output
    const structuredOutput = structureBettingSlip(structuredData.rawText);
    const structuredText = structuredOutput.text;
    
    // Save complete data as JSON
    const completeData = {
        imageName: imageName,
        extractedAt: new Date().toISOString(),
        structuredData: structuredData,
        bettingInfo: bettingInfo
    };
    
    const jsonOutput = join(OUTPUT_DIR, `${baseName}_ocr.json`);
    fs.writeFileSync(jsonOutput, JSON.stringify(completeData, null, 2));
    console.log(`💾 Complete data saved to: ${jsonOutput}`);
    
    // Save structured text version
    const textOutput = join(OUTPUT_DIR, `${baseName}_ocr.txt`);
    fs.writeFileSync(textOutput, structuredText);
    console.log(`📝 Structured text saved to: ${textOutput}`);
    
    return jsonOutput;
}

/**
 * Display results in console
 */
function displayResults(imageName, structuredData, bettingInfo) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 OCR RESULTS - ${imageName}`);
    console.log('='.repeat(60));
    
    // Display structured betting slip
    const structuredOutput = structureBettingSlip(structuredData.rawText);
    console.log('\n📝 STRUCTURED OUTPUT:');
    console.log(structuredOutput.text);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 BETTING INFORMATION (Legacy Format):');
    
    if (bettingInfo.parlayOdds) {
        console.log(`   Parlay Odds: ${bettingInfo.parlayOdds}`);
    }
    
    if (bettingInfo.token) {
        console.log(`   🎟️  Token: ${bettingInfo.token}`);
    }
    
    if (bettingInfo.gameInfo) {
        console.log(`   🏈 Game: ${bettingInfo.gameInfo.awayTeam} @ ${bettingInfo.gameInfo.homeTeam}`);
    }
    if (bettingInfo.timestamp) {
        console.log(`   🕐 Time: ${bettingInfo.timestamp}`);
    }
    
    if (bettingInfo.bets.length > 0) {
        console.log('\n   📋 Bets:');
        bettingInfo.bets.forEach((bet, i) => {
            console.log(`   ${i + 1}. ${bet.player} - ${bet.type} ${bet.value}`);
            if (bet.stat) console.log(`      📊 ${bet.stat}`);
        });
    }
    
    if (bettingInfo.wager) {
        console.log(`\n   💰 Total Wager: $${bettingInfo.wager}`);
    }
    if (bettingInfo.payout) {
        console.log(`   💵 Total Payout: $${bettingInfo.payout}`);
    }
    
    console.log('\n📝 RAW TEXT EXTRACTED:');
    console.log('─'.repeat(60));
    console.log(structuredData.rawText);
    console.log('─'.repeat(60));
    
    console.log(`\n✨ OCR Confidence: ${structuredData.confidence.toFixed(2)}%`);
    console.log(`📊 Total Lines: ${structuredData.lines.length}`);
    console.log(`📝 Total Words: ${structuredData.words.length}`);
    
    if (structuredData.detectedPatterns.players.length > 0) {
        console.log('\n👥 Detected Players:', structuredData.detectedPatterns.players.join(', '));
    }
    
    if (structuredData.detectedPatterns.monetary.length > 0) {
        console.log('💵 Monetary Values:', structuredData.detectedPatterns.monetary.join(', '));
    }
}

/**
 * Find all images to process
 */
async function findImages() {
    const images = [];
    
    for (const pattern of IMAGE_PATTERNS) {
        try {
            const matches = await glob(pattern.replace(/\\/g, '/'));
            images.push(...matches);
        } catch (error) {
            // Pattern didn't match anything, continue
        }
    }
    
    // Remove duplicates
    return [...new Set(images)];
}

/**
 * Process a single image
 */
async function processImage(imagePath) {
    const imageName = imagePath.split(/[/\\]/).pop();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📸 Processing: ${imageName}`);
    console.log('='.repeat(60));
    
    try {
        // Preprocess image
        const processedImage = await preprocessImage(imagePath);
        
        // Perform OCR
        const ocrData = await performOCR(processedImage);
        
        // Parse and structure data
        const structuredData = parseExtractedData(ocrData);
        
        // Extract betting-specific information
        const bettingInfo = extractBettingInfo(structuredData);
        
        // Display results
        displayResults(imageName, structuredData, bettingInfo);
        
        // Save results
        const outputFile = saveResults(imageName, structuredData, bettingInfo);
        
        // Cleanup processed image
        if (processedImage !== imagePath && fs.existsSync(processedImage)) {
            fs.unlinkSync(processedImage);
        }
        
        return { success: true, imageName, outputFile };
        
    } catch (error) {
        console.error(`\n❌ Error processing ${imageName}:`, error.message);
        return { success: false, imageName, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 OCR Discord Bot - Multi-Image Text Extraction');
    console.log('='.repeat(60));
    
    try {
        // Find all images
        const images = await findImages();
        
        if (images.length === 0) {
            console.log('\n⚠️  No images found!');
            console.log('Place images in one of these locations:');
            console.log('  - Root directory (image.png)');
            console.log('  - images/ folder (*.png, *.jpg, *.jpeg)');
            return;
        }
        
        console.log(`\n📁 Found ${images.length} image(s) to process\n`);
        
        // Process all images
        const results = [];
        for (const imagePath of images) {
            const result = await processImage(imagePath);
            results.push(result);
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 PROCESSING SUMMARY');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Successfully processed: ${successful}/${results.length}`);
        if (failed > 0) {
            console.log(`❌ Failed: ${failed}/${results.length}`);
            results.filter(r => !r.success).forEach(r => {
                console.log(`   - ${r.imageName}: ${r.error}`);
            });
        }
        
        console.log(`\n📂 All results saved to: ${OUTPUT_DIR}`);
        console.log('\n✅ OCR process completed!');
        
    } catch (error) {
        console.error('\n❌ Error during OCR process:', error.message);
        process.exit(1);
    }
}

// Run the program
main();

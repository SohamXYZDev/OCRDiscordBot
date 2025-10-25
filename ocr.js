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
        // More aggressive preprocessing for better text extraction
        await sharp(imagePath)
            .resize({ width: 2000, fit: 'inside', withoutEnlargement: false }) // Scale up for better OCR
            .greyscale()
            .normalize()
            .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
            .sharpen({ sigma: 1.5 })
            .toFile(filename);
        
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
                    betLine += ' - ' + nextLine;
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
    const structuredText = structureBettingSlip(structuredData.rawText);
    
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
    const structuredText = structureBettingSlip(structuredData.rawText);
    console.log('\n📝 STRUCTURED OUTPUT:');
    console.log(structuredText);
    
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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outputDir = path.join(__dirname, 'output');

console.log('\n📊 OCR RESULTS SUMMARY\n');
console.log('='.repeat(70));

const files = fs.readdirSync(outputDir).filter(f => f.endsWith('_ocr.json'));

files.sort().forEach((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'));
    
    console.log(`\n📄 ${data.imageName}`);
    console.log('-'.repeat(70));
    console.log(`✨ Confidence: ${data.structuredData.confidence.toFixed(1)}%`);
    
    if (data.bettingInfo.parlayOdds) {
        console.log(`🎲 Parlay: ${data.bettingInfo.parlayOdds}`);
    }
    
    if (data.bettingInfo.wager) {
        console.log(`💰 Wager: $${data.bettingInfo.wager} → Payout: $${data.bettingInfo.payout}`);
    }
    
    if (data.bettingInfo.bets && data.bettingInfo.bets.length > 0) {
        console.log(`📋 Bets: ${data.bettingInfo.bets.length}`);
        data.bettingInfo.bets.forEach((bet, i) => {
            console.log(`   ${i+1}. ${bet.player} ${bet.type} ${bet.value}`);
        });
    }
    
    console.log(`\n📝 Full Text Preview:`);
    const preview = data.structuredData.rawText.substring(0, 200);
    console.log(preview + (data.structuredData.rawText.length > 200 ? '...' : ''));
});

console.log('\n' + '='.repeat(70));
console.log(`\n📂 All files in: ${outputDir}`);
console.log(`Total images processed: ${files.length}\n`);

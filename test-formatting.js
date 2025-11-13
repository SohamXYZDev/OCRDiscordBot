import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';

// Test with image 5 (SAME GAME PARLAY)
const filepath = './images/batch_test/test_5.png';

const processedPath = './processed_temp.png';
await sharp(filepath)
    .resize({ width: 2000, fit: 'inside', withoutEnlargement: false })
    .greyscale()
    .normalize()
    .linear(1.2, -(128 * 1.2) + 128)
    .sharpen({ sigma: 1.5 })
    .toFile(processedPath);

const { data } = await Tesseract.recognize(processedPath, 'eng');
fs.unlinkSync(processedPath);

const text = data.text;
console.log('RAW OCR:');
console.log(text);
console.log('\n' + '='.repeat(50));
console.log('FORMATTED (simulating what bot will show):');

// Simulate the filtering
const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const output = [];

for (const line of lines) {
    // Skip useless text
    if (/NO SWEAT TOKEN|Includes:|Token Applied|SGP|Same Game Parlay|SAME GAME PARLAY|Parlay™|Bet Placed|CASH OUT|CASHOUT|Follow bet|Lock Screen|Bet Type:|Placed:|Transaction Total:|Pass through/i.test(line)) {
        continue;
    }
    // Skip checkbox/icon lines
    if (/^X\s+/.test(line)) {
        continue;
    }
    output.push(line);
}

console.log(output.join('\n'));

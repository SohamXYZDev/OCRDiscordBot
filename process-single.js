import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';

const imagePath = 'images/batch_test/test_29.png';
const outputBase = 'output/test_29_ocr';

console.log('Processing:', imagePath);

// Check if dark mode by sampling pixels
const img = sharp(imagePath);
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

// Sample center pixels to detect dark background
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

console.log('Average brightness:', avgBrightness.toFixed(1));
console.log('Dark mode detected:', isDarkMode);

// Preprocess based on mode
let processed;
if (isDarkMode) {
    console.log('Using dark mode preprocessing (inverting colors)...');
    processed = await sharp(imagePath)
        .resize(5000, null, { fit: 'inside' })
        .negate()  // Invert colors for dark mode
        .modulate({ brightness: 1.2, contrast: 1.3 })
        .normalize()
        .sharpen({ sigma: 1.5 })
        .toBuffer();
} else {
    console.log('Using light mode preprocessing...');
    processed = await sharp(imagePath)
        .resize(4000, null, { fit: 'inside' })
        .normalize()
        .sharpen()
        .toBuffer();
}

// Run OCR
console.log('\nRunning OCR...');
const { data: ocrData } = await Tesseract.recognize(processed, 'eng', {
    logger: m => {
        if (m.status === 'recognizing text') {
            process.stdout.write(`\rProgress: ${(m.progress * 100).toFixed(1)}%`);
        }
    }
});

console.log('\n\nConfidence:', ocrData.confidence.toFixed(2) + '%');
console.log('\n=== RAW OCR TEXT ===');
console.log(ocrData.text);

// Clean the text
let cleaned = ocrData.text;

// Remove leading junk characters at start of lines
cleaned = cleaned.replace(/^[ZT]+\s+/gm, '');
cleaned = cleaned.replace(/^[%~®@©•o◉●○]+\s*/gm, '');
cleaned = cleaned.replace(/^[£\[\|]+\s*[=»]+\s*/gm, '');  // Remove avatar/icon artifacts
cleaned = cleaned.replace(/^\|\s+/gm, '');  // Remove remaining pipe symbols

// Remove weird icon representations
cleaned = cleaned.replace(/[*]\s+-\s+[&¥®©]/g, '-');
cleaned = cleaned.replace(/\s+[*]\s+/g, ' ');
cleaned = cleaned.replace(/\s+&\s+/g, ' ');

// Remove "YN" lines and other UI artifacts
cleaned = cleaned.replace(/^\s*YN\s*$/gm, '');
cleaned = cleaned.replace(/^\s*7 YN\s*$/gm, '');
cleaned = cleaned.replace(/^by\s+of.*$/gm, '');

// Remove leading icon symbols (team helmets, betting icons, etc.)
cleaned = cleaned.replace(/^[&]+\s+/gm, '');
cleaned = cleaned.replace(/^X\s+/gm, '');  // Remove checkbox X symbols

// Clean up book/sportsbook names
cleaned = cleaned.replace(/^Lv\s+/gm, '');
cleaned = cleaned.replace(/^EB\s+/gm, '');
cleaned = cleaned.replace(/\bEB\b/g, '');

// Fix "CT" at end of Saturday line
cleaned = cleaned.replace(/Saturday\s+CT/g, 'Saturday');

// Fix strikethrough text misreads (=115 should be -115, etc)
cleaned = cleaned.replace(/=(\d{3})/g, '-$1');

// Remove info icon misreads
cleaned = cleaned.replace(/\s+®\s+/g, ' ');
cleaned = cleaned.replace(/CASHOUT/g, 'CASH OUT');
cleaned = cleaned.replace(/\s+GO\)\s*/g, ' ');  // Remove (i) icon misread

// Fix bullet point misreads
cleaned = cleaned.replace(/\s+\*\s+/g, ' • ');
cleaned = cleaned.replace(/\s+«\s+/g, ' • ');  // Fix guillemet to bullet
cleaned = cleaned.replace(/\s+\+\s+(?=[A-Z])/g, ' • ');  // Fix + to bullet when before caps

// Merge "PM" on separate line with previous time
cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s*\n\s*PM/g, '$1 PM');

// Fix SGP badge misread
cleaned = cleaned.replace(/\[scp\]|SGP\]/gi, 'SGP');

// Fix trademark symbol and remove quotes
cleaned = cleaned.replace(/Same Game Parlay(?!™)/g, 'Same Game Parlay™');
cleaned = cleaned.replace(/Parlay™"/g, 'Parlay™');
cleaned = cleaned.replace(/Parlay"/g, 'Parlay™');
cleaned = cleaned.replace(/["""]/g, '');  // Remove all quote variations

// Remove trailing quotes and line continuation artifacts
cleaned = cleaned.replace(/"\s*\+/g, ' +');
cleaned = cleaned.replace(/™"\s*/g, '™ ');
cleaned = cleaned.replace(/\s*A\\\s*$/gm, '');

// Fix multi-line bet descriptions that got split
cleaned = cleaned.replace(/Outside\s*\n\s*the Box/g, 'Outside the Box');
cleaned = cleaned.replace(/Target\s*\n\s*Outside/g, 'Target Outside');

// Fix dots and dashes
cleaned = cleaned.replace(/13\.5-/g, '13.5 •');
cleaned = cleaned.replace(/—/g, '');

// Fix "135" to "13.5" when it appears as odds line
cleaned = cleaned.replace(/(\s)135(\s+[+-]\d+)/g, '$113.5$2');

// Fix "El" arrow at end of lines
cleaned = cleaned.replace(/\s+El\s*$/gm, ' >');
cleaned = cleaned.replace(/\s+Ed\s*$/gm, ' >');

// Remove extra spaces and empty lines
cleaned = cleaned.split('\n').map(line => {
    // Remove all quote marks
    line = line.replace(/["""''`]/g, '');
    return line.trim();
}).filter(line => line.length > 0 && line.length > 2).join('\n');

console.log('\n=== CLEANED TEXT ===');
console.log(cleaned);

// Save outputs
fs.writeFileSync(outputBase + '.txt', cleaned);
try {
    fs.writeFileSync(outputBase + '.json', JSON.stringify(ocrData, null, 2));
} catch (e) {
    console.log('(JSON file too large, skipped)');
}

console.log('\n✅ Saved to:', outputBase + '.txt');

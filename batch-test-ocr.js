import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BATCH_DIR = './images/batch_test';
const OUTPUT_DIR = './output';
const manifest = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, 'manifest.json'), 'utf8'));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Processing ' + manifest.totalImages + ' images with OCR...\n');

const problems = [];
let tested = 0;

for (const img of manifest.images) {
    tested++;
    const num = img.number;
    const baseName = path.basename(img.filename, path.extname(img.filename));
    
    try {
        // Try to detect if image is dark mode by sampling some pixels
        const imgBuffer = await sharp(img.filepath).raw().toBuffer({ resolveWithObject: true });
        const pixels = imgBuffer.data;
        let darkPixels = 0;
        const sampleSize = Math.min(1000, pixels.length / 3);
        for (let i = 0; i < sampleSize * 3; i += 30) {
            const brightness = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
            if (brightness < 100) darkPixels++;
        }
        const isDarkMode = darkPixels > sampleSize * 0.6;
        
        // Apply different preprocessing based on dark/light mode
        const processedPath = './processed_' + Date.now() + '.png';
        if (isDarkMode) {
            // For dark mode: invert colors first, then process
            await sharp(img.filepath)
                .negate()  // Invert: dark becomes light, light becomes dark
                .resize({ width: 3500, fit: 'inside', withoutEnlargement: false })
                .normalize()
                .sharpen()
                .toFile(processedPath);
        } else {
            // For light mode: standard processing
            await sharp(img.filepath)
                .resize({ width: 3500, fit: 'inside', withoutEnlargement: false })
                .normalize()
                .sharpen()
                .toFile(processedPath);
        }
        
        const { data } = await Tesseract.recognize(processedPath, 'eng');
        
        fs.unlinkSync(processedPath);
        
        const text = data.text;
        
        // Save OCR output
        fs.writeFileSync(path.join(OUTPUT_DIR, baseName + '_ocr.txt'), text);
        fs.writeFileSync(path.join(OUTPUT_DIR, baseName + '_ocr.json'), JSON.stringify(data, null, 2));
        
        const hasLegs = text.includes('parlay') || text.includes('Parlay') || text.includes('Pick');
        const hasOdds = /[+-]\d{3,4}/.test(text);
        const confidence = data.confidence;
        
        const status = confidence < 80 ? 'LOW_CONF' : (hasLegs && hasOdds) ? 'OK' : 'PARSE_CHECK';
        
        if (status !== 'OK') {
            problems.push({ num: num, issue: status, conf: confidence.toFixed(1) });
        }
        
        console.log('Image ' + num + ': ' + status + ' (conf: ' + confidence.toFixed(1) + '%)' + (isDarkMode ? ' [DARK]' : ''));
        
    } catch (error) {
        console.log('Image ' + num + ': ERROR - ' + error.message);
        problems.push({ num: num, issue: 'ERROR', error: error.message });
    }
}

console.log('\n=== SUMMARY ===');
console.log('Tested: ' + tested);
console.log('Issues: ' + problems.length);

if (problems.length > 0) {
    console.log('\nImages needing review:');
    problems.forEach(p => console.log('  #' + p.num + ': ' + p.issue + (p.conf ? ' (' + p.conf + '%)' : '')));
}

console.log('\nDone!');

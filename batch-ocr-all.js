import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BATCH_DIR = './images/batch_test';
const OUTPUT_DIR = './output';
const manifest = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, 'manifest.json'), 'utf8'));

console.log('Processing all ' + manifest.totalImages + ' images...\n');

const results = [];

for (const img of manifest.images) {
    const num = img.number;
    console.log(`Processing image ${num}/${manifest.totalImages}...`);
    
    try {
        // Detect dark mode
        const imgBuffer = sharp(img.filepath);
        const { data, info } = await imgBuffer.raw().toBuffer({ resolveWithObject: true });
        
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
        
        // Preprocess based on mode
        let processed;
        if (isDarkMode) {
            processed = await sharp(img.filepath)
                .resize(5000, null, { fit: 'inside' })
                .negate()
                .modulate({ brightness: 1.2, contrast: 1.3 })
                .normalize()
                .sharpen({ sigma: 1.5 })
                .toBuffer();
        } else {
            processed = await sharp(img.filepath)
                .resize(4000, null, { fit: 'inside' })
                .normalize()
                .linear(1.1, -(128 * 0.1))
                .sharpen({ sigma: 1.2 })
                .toBuffer();
        }
        
        // Run OCR
        const { data: ocrData } = await Tesseract.recognize(processed, 'eng');
        
        // Save output
        const baseName = path.basename(img.filename, path.extname(img.filename));
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${baseName}_ocr.txt`),
            ocrData.text
        );
        
        results.push({
            num: num,
            filename: img.filename,
            confidence: ocrData.confidence.toFixed(1),
            darkMode: isDarkMode,
            textLength: ocrData.text.length,
            status: 'SUCCESS'
        });
        
        console.log(`  ✓ Done (conf: ${ocrData.confidence.toFixed(1)}%, dark: ${isDarkMode})\n`);
        
    } catch (error) {
        results.push({
            num: num,
            filename: img.filename,
            status: 'ERROR',
            error: error.message
        });
        console.log(`  ✗ Error: ${error.message}\n`);
    }
}

console.log('\n========================================');
console.log('BATCH OCR COMPLETE');
console.log('========================================\n');
console.log('Total processed: ' + results.length);
console.log('Successful: ' + results.filter(r => r.status === 'SUCCESS').length);
console.log('Errors: ' + results.filter(r => r.status === 'ERROR').length);

console.log('\n--- Results Summary ---');
results.forEach(r => {
    if (r.status === 'SUCCESS') {
        console.log(`#${r.num}: ✓ ${r.confidence}% conf, ${r.darkMode ? 'dark' : 'light'} mode`);
    } else {
        console.log(`#${r.num}: ✗ ERROR - ${r.error}`);
    }
});

console.log('\nAll OCR text files saved to:', OUTPUT_DIR);

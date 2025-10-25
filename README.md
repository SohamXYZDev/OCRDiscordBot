# OCRDiscordBot

A powerful JavaScript OCR (Optical Character Recognition) program that extracts all information from sports betting images.

## Features

- 🔍 **Advanced OCR**: Uses Tesseract.js for accurate text extraction
- 📊 **Smart Parsing**: Automatically detects and structures betting information
- 🎯 **Pattern Recognition**: Identifies players, statistics, monetary values, and teams
- 📷 **Image Preprocessing**: Enhances image quality for better OCR accuracy
- 💾 **Multiple Output Formats**: Saves results as JSON and plain text
- 📈 **Confidence Scoring**: Reports OCR accuracy

## Installation

1. **Install Node.js** (if not already installed)

   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **Install Dependencies**
   ```bash
   npm install
   ```

## Usage

Run the OCR program on `image.png`:

```bash
npm start
```

Or:

```bash
node ocr.js
```

## Output

The program generates two output files:

1. **ocr_output.json** - Complete structured data including:

   - Raw extracted text
   - OCR confidence score
   - Parsed lines and words
   - Detected patterns (players, monetary values, numbers, teams)
   - Betting-specific information (bets, wagers, payouts)

2. **ocr_output.txt** - Plain text version of all extracted text

## How It Works

1. **Image Preprocessing**: Enhances the image using grayscale conversion, normalization, sharpening, and thresholding
2. **OCR Processing**: Runs Tesseract.js to extract all text from the image
3. **Pattern Detection**: Identifies specific patterns like player names, monetary values, and statistics
4. **Data Structuring**: Organizes the extracted information into a structured format
5. **Betting Info Extraction**: Specifically parses betting slip information
6. **Output Generation**: Saves results in multiple formats and displays in console

## Example Output

The program will extract information like:

- Game details (teams, time)
- Individual bets (player names, bet types, values)
- Statistics types (receiving yards, total receptions, passing TDs, etc.)
- Wager and payout amounts
- All raw text from the image

## Technologies Used

- **Tesseract.js** - OCR engine
- **Sharp** - Image processing library
- **Node.js** - Runtime environment

## Requirements

- Node.js 14.x or higher
- npm or yarn package manager

## Troubleshooting

If OCR accuracy is low:

1. Ensure the image is clear and high resolution
2. Check that text is not skewed or distorted
3. The program automatically preprocesses images to improve accuracy

## License

ISC

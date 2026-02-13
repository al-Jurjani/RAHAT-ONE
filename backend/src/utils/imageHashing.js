/**
 * Image Hashing Utilities for Fraud Detection
 *
 * Provides perceptual hashing (pHash) for detecting visually similar images
 * even after rescanning, rotation, or minor modifications.
 */

const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Calculate MD5 hash of image buffer
 *
 * @param {Buffer} imageBuffer - Raw image bytes
 * @returns {string} - MD5 hash (32 character hex string)
 *
 * Use case: Detect exact duplicate files (byte-for-byte identical)
 * Time complexity: O(n) where n = file size
 */
function calculateMD5(imageBuffer) {
    return crypto.createHash('md5').update(imageBuffer).digest('hex');
}

/**
 * Generate perceptual hash (pHash) using DCT-based algorithm
 *
 * Algorithm:
 * 1. Resize image to 32x32 pixels (reduce detail, focus on structure)
 * 2. Convert to grayscale
 * 3. Apply DCT (Discrete Cosine Transform)
 * 4. Extract low frequencies (8x8 top-left coefficients)
 * 5. Compute median of DCT coefficients
 * 6. Generate 64-bit hash (1 if > median, else 0)
 *
 * @param {Buffer} imageBuffer - Raw image bytes (JPEG, PNG, etc.)
 * @returns {Promise<string>} - 16-character hex string (64-bit hash)
 *
 * Use case: Detect rescanned receipts, rotated images, minor crops
 * Time complexity: O(n log n) for DCT on 32x32 pixels
 */
async function generatePHash(imageBuffer) {
    try {
        // Step 1 & 2: Resize to 32x32 and convert to grayscale
        const { data, info } = await sharp(imageBuffer)
            .resize(32, 32, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Convert buffer to 2D array
        const pixels = [];
        for (let i = 0; i < 32; i++) {
            pixels[i] = [];
            for (let j = 0; j < 32; j++) {
                pixels[i][j] = data[i * 32 + j];
            }
        }

        // Step 3: Apply simplified DCT (using average as approximation)
        // For production, you might want a full DCT implementation
        // This is a simplified version for speed
        const dct = applyDCT(pixels);

        // Step 4: Extract 8x8 low frequencies (top-left corner)
        const lowFreq = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                lowFreq.push(dct[i][j]);
            }
        }

        // Step 5: Compute median
        const sortedFreq = lowFreq.slice().sort((a, b) => a - b);
        const median = sortedFreq[Math.floor(sortedFreq.length / 2)];

        // Step 6: Generate 64-bit hash
        let hash = '';
        for (let i = 0; i < lowFreq.length; i++) {
            hash += lowFreq[i] > median ? '1' : '0';
        }

        // Convert binary string to hex
        return binaryToHex(hash);

    } catch (error) {
        throw new Error(`pHash generation failed: ${error.message}`);
    }
}

/**
 * Simplified DCT implementation
 * (For production, consider using a proper DCT library)
 *
 * @param {number[][]} matrix - 32x32 pixel matrix
 * @returns {number[][]} - DCT coefficients
 */
function applyDCT(matrix) {
    const N = matrix.length;
    const dct = Array(N).fill(0).map(() => Array(N).fill(0));

    for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
            let sum = 0;
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    sum += matrix[i][j] *
                        Math.cos((2 * i + 1) * u * Math.PI / (2 * N)) *
                        Math.cos((2 * j + 1) * v * Math.PI / (2 * N));
                }
            }
            const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
            const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
            dct[u][v] = 0.25 * cu * cv * sum;
        }
    }

    return dct;
}

/**
 * Convert binary string to hexadecimal
 *
 * @param {string} binary - Binary string (e.g., "1010...")
 * @returns {string} - Hexadecimal string
 */
function binaryToHex(binary) {
    let hex = '';
    for (let i = 0; i < binary.length; i += 4) {
        const chunk = binary.substr(i, 4);
        hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
}

/**
 * Calculate Hamming distance between two pHash strings
 *
 * Hamming distance = number of bit positions where hashes differ
 *
 * @param {string} hash1 - First pHash (hex string)
 * @param {string} hash2 - Second pHash (hex string)
 * @returns {number} - Hamming distance (0-64)
 *
 * Interpretation:
 * - Distance 0-5:  Very similar images (likely same invoice)
 * - Distance 6-15: Somewhat similar (manual review recommended)
 * - Distance >15:  Different images
 *
 * Use case: Compare new invoice with past invoices to detect duplicates
 * Time complexity: O(1) - fixed 64-bit comparison
 */
function hammingDistance(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) {
        return 64; // Max distance if invalid hashes
    }

    // Convert hex to binary
    const bin1 = hexToBinary(hash1);
    const bin2 = hexToBinary(hash2);

    // Count differing bits
    let distance = 0;
    for (let i = 0; i < bin1.length; i++) {
        if (bin1[i] !== bin2[i]) {
            distance++;
        }
    }

    return distance;
}

/**
 * Convert hexadecimal to binary string
 *
 * @param {string} hex - Hexadecimal string
 * @returns {string} - Binary string
 */
function hexToBinary(hex) {
    let binary = '';
    for (let i = 0; i < hex.length; i++) {
        binary += parseInt(hex[i], 16).toString(2).padStart(4, '0');
    }
    return binary;
}

/**
 * Calculate pHash similarity score (0.0 to 1.0)
 *
 * @param {string} hash1 - First pHash
 * @param {string} hash2 - Second pHash
 * @returns {number} - Similarity score (1.0 = identical, 0.0 = completely different)
 *
 * Converts Hamming distance to similarity percentage
 */
function pHashSimilarity(hash1, hash2) {
    const distance = hammingDistance(hash1, hash2);
    return 1.0 - (distance / 64.0);
}

module.exports = {
    calculateMD5,
    generatePHash,
    hammingDistance,
    pHashSimilarity
};

/**
 * Modal Service - Interface to Modal ML Fraud Detection
 *
 * Handles communication with Modal serverless GPU functions:
 * - CLIP: Visual similarity embeddings
 * - Florence-2: Document forgery detection
 */

const axios = require('axios');

// Modal webhook URL (set in .env)
const MODAL_WEBHOOK_URL = process.env.MODAL_WEBHOOK_URL;

/**
 * Analyze invoice using Modal ML models (CLIP + Florence-2)
 *
 * Calls Modal web endpoint which runs both models in parallel
 *
 * @param {Buffer} imageBuffer - Raw image bytes (JPEG, PNG, etc.)
 * @returns {Promise<Object>} - Analysis results
 *   {
 *     clipEmbedding: number[],      // 512-dim CLIP embedding
 *     florenceAnalysis: {
 *       analysis: string,            // Text description
 *       fraud_score: number,         // 0.0-1.0
 *       flags: string[]              // Suspicious keywords detected
 *     }
 *   }
 *
 * @throws {Error} If Modal API call fails
 *
 * Processing time: ~5-6 seconds (CLIP + Florence run in parallel)
 * Cost: ~$0.001 per invoice
 */
async function analyzeInvoiceML(imageBuffer) {
    if (!MODAL_WEBHOOK_URL) {
        throw new Error('MODAL_WEBHOOK_URL not configured in .env');
    }

    try {
        console.log('[ModalService] Calling Modal ML endpoint...');
        const startTime = Date.now();

        // Convert image buffer to base64
        const base64Image = imageBuffer.toString('base64');

        // Call Modal endpoint
        const response = await axios.post(
            `${MODAL_WEBHOOK_URL}/analyze`,
            { image: base64Image },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000  // 30 second timeout (cold start can take 20s)
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[ModalService] Analysis complete in ${elapsed}s`);

        // Validate response
        if (!response.data || !response.data.success) {
            throw new Error('Invalid response from Modal');
        }

        return {
            clipEmbedding: response.data.clip_embedding,
            florenceAnalysis: response.data.florence_analysis,
            processingTime: response.data.processing_time_seconds
        };

    } catch (error) {
        console.error('[ModalService] Error calling Modal:', error.message);

        // Provide helpful error messages
        if (error.code === 'ECONNREFUSED') {
            throw new Error('Modal service unreachable - is it deployed?');
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error('Modal request timeout - cold start or overload?');
        } else if (error.response) {
            throw new Error(`Modal error: ${error.response.data.detail || error.response.statusText}`);
        } else {
            throw new Error(`Modal service error: ${error.message}`);
        }
    }
}

/**
 * Calculate cosine similarity between two CLIP embeddings
 *
 * Cosine similarity measures the angle between two vectors:
 * similarity = dot(A, B) / (||A|| * ||B||)
 *
 * @param {number[]} embedding1 - First 512-dim CLIP embedding
 * @param {number[]} embedding2 - Second 512-dim CLIP embedding
 * @returns {number} - Similarity score 0.0-1.0 (1.0 = identical)
 *
 * Interpretation:
 * - 0.95-1.0:  Extremely similar (likely exact same receipt)
 * - 0.85-0.95: Very similar (rescanned or rotated same receipt)
 * - 0.70-0.85: Somewhat similar (same vendor/layout, different receipt)
 * - <0.70:     Different receipts
 *
 * Time complexity: O(n) where n = 512
 */
function cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
        throw new Error('Invalid embeddings');
    }

    if (embedding1.length !== embedding2.length) {
        throw new Error(`Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`);
    }

    // Calculate dot product: sum(A[i] * B[i])
    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
    }

    // Calculate magnitudes: ||A|| and ||B||
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < embedding1.length; i++) {
        magnitudeA += embedding1[i] * embedding1[i];
        magnitudeB += embedding2[i] * embedding2[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    // Cosine similarity
    const similarity = dotProduct / (magnitudeA * magnitudeB);

    // Clamp to [0, 1] range (should already be in this range, but just in case)
    return Math.max(0, Math.min(1, similarity));
}

/**
 * Find most similar CLIP embedding from a list
 *
 * Compares a new embedding against a list of past embeddings
 * and returns the highest similarity score + matched expense ID
 *
 * @param {number[]} newEmbedding - CLIP embedding of new invoice
 * @param {Array<{id: number, embedding: number[]}>} pastEmbeddings - Past expense embeddings
 * @returns {Object} - Best match result
 *   {
 *     maxSimilarity: number,    // Highest similarity score (0-1)
 *     matchedExpenseId: number, // ID of most similar expense (null if none)
 *     similarities: number[]    // All similarity scores (for debugging)
 *   }
 *
 * Use case: Check if new invoice is duplicate of any past invoice
 */
function findMostSimilar(newEmbedding, pastEmbeddings) {
    if (!pastEmbeddings || pastEmbeddings.length === 0) {
        return {
            maxSimilarity: 0,
            matchedExpenseId: null,
            similarities: []
        };
    }

    let maxSimilarity = 0;
    let matchedExpenseId = null;
    const similarities = [];

    for (const past of pastEmbeddings) {
        const similarity = cosineSimilarity(newEmbedding, past.embedding);
        similarities.push(similarity);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            matchedExpenseId = past.id;
        }
    }

    return {
        maxSimilarity,
        matchedExpenseId,
        similarities
    };
}

/**
 * Test Modal service connectivity
 *
 * Useful for health checks and debugging
 *
 * @returns {Promise<boolean>} - True if Modal is reachable
 */
async function testConnection() {
    if (!MODAL_WEBHOOK_URL) {
        console.error('[ModalService] MODAL_WEBHOOK_URL not configured');
        return false;
    }

    try {
        console.log('[ModalService] Testing connection to Modal...');
        // Try to reach the base URL (FastAPI should have a root endpoint)
        await axios.get(MODAL_WEBHOOK_URL, { timeout: 5000 });
        console.log('[ModalService] ✅ Modal service is reachable');
        return true;
    } catch (error) {
        console.error('[ModalService] ❌ Modal service unreachable:', error.message);
        return false;
    }
}

module.exports = {
    analyzeInvoiceML,
    cosineSimilarity,
    findMostSimilar,
    testConnection
};

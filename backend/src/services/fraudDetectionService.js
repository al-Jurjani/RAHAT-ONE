/**
 * Fraud Detection Pipeline - Orchestrates all 5 layers
 *
 * Layers (with Option A weights):
 * 1. MD5 Hash (0.35) - Exact duplicate detection
 * 2. pHash (0.20) - Perceptual duplicate detection
 * 3. CLIP (0.25) - Visual similarity detection
 * 4. Florence-2 (0.10) - Document forgery detection
 * 5. Anomaly Detection (0.10) - Statistical outlier detection
 *
 * Processing Flow:
 * - Phase 1: Run local layers (MD5, pHash, Anomaly) in parallel
 * - Phase 2: Run ML layers (CLIP, Florence-2) in parallel via Modal
 * - Phase 3: Aggregate scores and return final verdict
 *
 * Target: 85-90% fraud detection rate in <10 seconds
 */

const { calculateMD5, generatePHash, pHashSimilarity } = require('../utils/imageHashing');
const { analyzeInvoiceML, cosineSimilarity, findMostSimilar } = require('./modalService');
const odooAdapter = require('../adapters/odooAdapter');

// Fraud detection thresholds
const THRESHOLDS = {
    md5: {
        exactMatch: 1.0  // If MD5 matches, it's 100% duplicate
    },
    pHash: {
        veryHighSimilarity: 0.92,   // Hamming distance 0-5
        highSimilarity: 0.77,        // Hamming distance 6-15
        suspicious: 0.70             // Above this is suspicious
    },
    clip: {
        extremelySimilar: 0.95,      // Likely exact same receipt
        verySimilar: 0.85,           // Rescanned or rotated
        somewhatSimilar: 0.70        // Same vendor/layout
    },
    florence: {
        highForgery: 0.60,           // Many suspicious flags
        mediumForgery: 0.40,         // Some flags detected
        lowForgery: 0.20             // Few flags
    },
    anomaly: {
        extremeOutlier: 0.95,        // Z-score > 3
        highOutlier: 0.80,           // Z-score > 2.5
        moderateOutlier: 0.60        // Z-score > 2
    },
    overall: {
        fraudulent: 0.70,            // High confidence fraud
        suspicious: 0.40,            // Needs manual review
        clean: 0.40                  // Below this is clean
    }
};

// Layer weights (Option A)
const WEIGHTS = {
    md5: 0.35,
    pHash: 0.20,
    clip: 0.25,
    florence: 0.10,
    anomaly: 0.10
};

/**
 * Run complete fraud detection pipeline
 *
 * @param {Buffer} imageBuffer - Invoice image bytes
 * @param {number} employeeId - Employee who submitted expense
 * @param {number} amount - Expense amount
 * @returns {Promise<Object>} - Fraud detection result
 *   {
 *     status: 'clean' | 'suspicious' | 'fraudulent',
 *     overallScore: number,        // 0.0-1.0 (weighted aggregate)
 *     confidence: number,          // 0.0-1.0
 *     layers: {
 *       md5: { score, matched, details },
 *       pHash: { score, matched, details },
 *       clip: { score, matched, details, embedding },
 *       florence: { score, details, analysis },
 *       anomaly: { score, details }
 *     },
 *     recommendation: string,      // Action to take
 *     processingTime: number       // Milliseconds
 *   }
 */
async function runFraudDetection(imageBuffer, employeeId, amount) {
    const startTime = Date.now();
    console.log(`[FraudDetection] Starting fraud detection for employee ${employeeId}, amount: $${amount}`);

    try {
        // ===== PHASE 1: LOCAL LAYERS (PARALLEL) =====
        console.log('[FraudDetection] Phase 1: Running local layers...');

        const [md5Result, pHashResult, anomalyResult, pastExpenses] = await Promise.all([
            // Layer 1: MD5 Hash
            runMD5Layer(imageBuffer, employeeId),

            // Layer 2: pHash
            runPHashLayer(imageBuffer, employeeId),

            // Layer 3: Anomaly Detection (needs employee stats)
            runAnomalyLayer(employeeId, amount),

            // Fetch past expenses for comparison (needed by multiple layers)
            odooAdapter.getEmployeePastExpenses(employeeId, { limit: 100 })
        ]);

        console.log(`[FraudDetection] Phase 1 complete. Found ${pastExpenses.length} past expenses`);

        // Early exit if exact MD5 match found
        if (md5Result.matched) {
            console.log('[FraudDetection] ⚠️ EXACT DUPLICATE detected via MD5! Early exit.');
            return buildEarlyExitResult(md5Result, startTime);
        }

        // ===== PHASE 2: ML LAYERS (PARALLEL) =====
        console.log('[FraudDetection] Phase 2: Running ML layers via Modal...');

        let clipResult, florenceResult;

        try {
            // Call Modal endpoint (runs CLIP + Florence-2 in parallel)
            const mlResults = await analyzeInvoiceML(imageBuffer);

            // Layer 4: CLIP Similarity
            clipResult = await runCLIPLayer(
                mlResults.clipEmbedding,
                employeeId,
                pastExpenses
            );

            // Layer 5: Florence-2 Forgery Detection
            florenceResult = runFlorenceLayer(mlResults.florenceAnalysis);

            console.log('[FraudDetection] Phase 2 complete. ML analysis finished.');

        } catch (error) {
            console.error('[FraudDetection] ML layers failed:', error.message);

            // If Modal fails, continue with local layers only
            clipResult = {
                score: 0,
                matched: false,
                details: `ML service unavailable: ${error.message}`,
                embedding: null,
                error: true
            };

            florenceResult = {
                score: 0,
                details: 'ML service unavailable',
                analysis: null,
                error: true
            };
        }

        // ===== PHASE 3: SCORE AGGREGATION =====
        console.log('[FraudDetection] Phase 3: Aggregating scores...');

        const layers = {
            md5: md5Result,
            pHash: pHashResult,
            clip: clipResult,
            florence: florenceResult,
            anomaly: anomalyResult
        };

        // Calculate weighted overall score
        const overallScore = calculateWeightedScore(layers);

        // Determine status
        const status = determineStatus(overallScore, layers);

        // Calculate confidence
        const confidence = calculateConfidence(layers);

        // Generate recommendation
        const recommendation = generateRecommendation(status, layers);

        const processingTime = Date.now() - startTime;

        console.log(`[FraudDetection] ✅ Complete in ${processingTime}ms | Status: ${status} | Score: ${overallScore.toFixed(3)}`);

        return {
            status,
            overallScore,
            confidence,
            layers,
            recommendation,
            processingTime,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[FraudDetection] Pipeline error:', error);
        throw new Error(`Fraud detection failed: ${error.message}`);
    }
}

/**
 * Layer 1: MD5 Hash - Exact Duplicate Detection
 */
async function runMD5Layer(imageBuffer, employeeId) {
    const md5Hash = calculateMD5(imageBuffer);

    // Check if this exact file was submitted before
    const matchedExpense = await odooAdapter.findExpenseByMD5(md5Hash);

    if (matchedExpense) {
        return {
            score: 1.0,  // 100% fraud score for exact duplicate
            matched: true,
            matchedExpenseId: matchedExpense.id,
            details: `Exact duplicate of expense #${matchedExpense.id} (${matchedExpense.description})`,
            hash: md5Hash
        };
    }

    return {
        score: 0.0,  // No match = clean
        matched: false,
        details: 'No exact duplicate found',
        hash: md5Hash
    };
}

/**
 * Layer 2: pHash - Perceptual Similarity Detection
 */
async function runPHashLayer(imageBuffer, employeeId) {
    const pHash = await generatePHash(imageBuffer);

    // Get past expense hashes
    const pastHashes = await odooAdapter.getEmployeePastExpenses(employeeId, {
        fields: ['id', 'description', 'perceptual_hash'],
        limit: 100
    });

    // Find most similar
    let maxSimilarity = 0;
    let matchedExpenseId = null;

    for (const expense of pastHashes) {
        if (expense.perceptual_hash) {
            const similarity = pHashSimilarity(pHash, expense.perceptual_hash);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                matchedExpenseId = expense.id;
            }
        }
    }

    // Determine fraud score based on similarity
    let score = 0;
    let details = '';

    if (maxSimilarity >= THRESHOLDS.pHash.veryHighSimilarity) {
        score = 0.90;  // Very likely rescanned/rotated duplicate
        details = `Very high similarity (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId}`;
    } else if (maxSimilarity >= THRESHOLDS.pHash.highSimilarity) {
        score = 0.60;  // High similarity, needs review
        details = `High similarity (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId}`;
    } else if (maxSimilarity >= THRESHOLDS.pHash.suspicious) {
        score = 0.30;  // Suspicious
        details = `Moderate similarity (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId}`;
    } else {
        score = 0.0;   // Clean
        details = `No perceptual duplicates found (max similarity: ${(maxSimilarity * 100).toFixed(1)}%)`;
    }

    return {
        score,
        matched: maxSimilarity >= THRESHOLDS.pHash.suspicious,
        matchedExpenseId,
        similarity: maxSimilarity,
        details,
        hash: pHash
    };
}

/**
 * Layer 3: CLIP - Visual Similarity Detection
 */
async function runCLIPLayer(clipEmbedding, employeeId, pastExpenses) {
    // Filter expenses that have CLIP embeddings
    const pastEmbeddings = pastExpenses
        .filter(exp => exp.clip_embedding)
        .map(exp => ({
            id: exp.id,
            embedding: JSON.parse(exp.clip_embedding)
        }));

    if (pastEmbeddings.length === 0) {
        return {
            score: 0.0,
            matched: false,
            details: 'No past CLIP embeddings to compare',
            embedding: clipEmbedding
        };
    }

    // Find most similar embedding
    const { maxSimilarity, matchedExpenseId } = findMostSimilar(clipEmbedding, pastEmbeddings);

    // Determine fraud score
    let score = 0;
    let details = '';

    if (maxSimilarity >= THRESHOLDS.clip.extremelySimilar) {
        score = 0.95;
        details = `Extremely similar (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId} - likely same receipt`;
    } else if (maxSimilarity >= THRESHOLDS.clip.verySimilar) {
        score = 0.70;
        details = `Very similar (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId} - possibly rescanned`;
    } else if (maxSimilarity >= THRESHOLDS.clip.somewhatSimilar) {
        score = 0.35;
        details = `Somewhat similar (${(maxSimilarity * 100).toFixed(1)}%) to expense #${matchedExpenseId}`;
    } else {
        score = 0.0;
        details = `No visual duplicates found (max similarity: ${(maxSimilarity * 100).toFixed(1)}%)`;
    }

    return {
        score,
        matched: maxSimilarity >= THRESHOLDS.clip.somewhatSimilar,
        matchedExpenseId,
        similarity: maxSimilarity,
        details,
        embedding: clipEmbedding
    };
}

/**
 * Layer 4: Florence-2 - Forgery Detection
 */
function runFlorenceLayer(florenceAnalysis) {
    const { fraud_score, flags, analysis } = florenceAnalysis;

    let details = '';
    if (flags.length > 0) {
        details = `Detected ${flags.length} suspicious patterns: ${flags.join(', ')}`;
    } else {
        details = 'No forgery indicators detected';
    }

    return {
        score: fraud_score,
        flags,
        details,
        analysis
    };
}

/**
 * Layer 5: Anomaly Detection - Statistical Outlier Detection
 */
async function runAnomalyLayer(employeeId, amount) {
    // Get employee's expense statistics
    const stats = await odooAdapter.getEmployeeExpenseStats(employeeId);

    if (!stats || stats.count < 3) {
        return {
            score: 0.0,
            details: 'Insufficient historical data for anomaly detection',
            zScore: null
        };
    }

    // Calculate Z-score
    const zScore = Math.abs((amount - stats.mean) / stats.stdDev);

    let score = 0;
    let details = '';

    if (zScore > 3.0) {
        score = 0.95;
        details = `Extreme outlier (Z-score: ${zScore.toFixed(2)}) - $${amount} vs avg $${stats.mean.toFixed(2)}`;
    } else if (zScore > 2.5) {
        score = 0.80;
        details = `High outlier (Z-score: ${zScore.toFixed(2)}) - $${amount} vs avg $${stats.mean.toFixed(2)}`;
    } else if (zScore > 2.0) {
        score = 0.60;
        details = `Moderate outlier (Z-score: ${zScore.toFixed(2)}) - $${amount} vs avg $${stats.mean.toFixed(2)}`;
    } else {
        score = 0.0;
        details = `Normal amount (Z-score: ${zScore.toFixed(2)})`;
    }

    return {
        score,
        zScore,
        details,
        stats: {
            employeeMean: stats.mean,
            employeeStdDev: stats.stdDev,
            expenseCount: stats.count
        }
    };
}

/**
 * Calculate weighted overall fraud score
 */
function calculateWeightedScore(layers) {
    // Handle ML errors - if ML layers failed, redistribute weight to local layers
    const mlFailed = layers.clip.error || layers.florence.error;

    let weights = { ...WEIGHTS };

    if (mlFailed) {
        // Redistribute ML weights to local layers proportionally
        const mlWeight = WEIGHTS.clip + WEIGHTS.florence;
        const localWeight = WEIGHTS.md5 + WEIGHTS.pHash + WEIGHTS.anomaly;
        const redistribution = mlWeight / localWeight;

        weights = {
            md5: WEIGHTS.md5 * (1 + redistribution),
            pHash: WEIGHTS.pHash * (1 + redistribution),
            clip: 0,
            florence: 0,
            anomaly: WEIGHTS.anomaly * (1 + redistribution)
        };

        console.log('[FraudDetection] ML failed - redistributed weights:', weights);
    }

    const overallScore =
        (layers.md5.score * weights.md5) +
        (layers.pHash.score * weights.pHash) +
        (layers.clip.score * weights.clip) +
        (layers.florence.score * weights.florence) +
        (layers.anomaly.score * weights.anomaly);

    return overallScore;
}

/**
 * Determine final status based on overall score and layer results
 */
function determineStatus(overallScore, layers) {
    // If MD5 matched, always fraudulent regardless of score
    if (layers.md5.matched) {
        return 'fraudulent';
    }

    // Check thresholds
    if (overallScore >= THRESHOLDS.overall.fraudulent) {
        return 'fraudulent';
    } else if (overallScore >= THRESHOLDS.overall.suspicious) {
        return 'suspicious';
    } else {
        return 'clean';
    }
}

/**
 * Calculate confidence in the fraud detection result
 */
function calculateConfidence(layers) {
    // Higher confidence if multiple layers agree
    const highScoreLayers = Object.values(layers).filter(layer => layer.score > 0.5).length;
    const totalLayers = 5;

    // Base confidence on layer agreement
    let confidence = highScoreLayers / totalLayers;

    // Boost confidence if critical layers (MD5, pHash, CLIP) agree
    const criticalLayersAgree =
        (layers.md5.score > 0.5 ? 1 : 0) +
        (layers.pHash.score > 0.5 ? 1 : 0) +
        (layers.clip.score > 0.5 ? 1 : 0);

    if (criticalLayersAgree >= 2) {
        confidence = Math.min(confidence + 0.2, 1.0);
    }

    // Reduce confidence if ML layers failed
    if (layers.clip.error || layers.florence.error) {
        confidence = Math.max(confidence - 0.2, 0);
    }

    return confidence;
}

/**
 * Generate recommendation for action
 */
function generateRecommendation(status, layers) {
    if (status === 'fraudulent') {
        if (layers.md5.matched) {
            return 'REJECT - Exact duplicate file detected';
        } else if (layers.pHash.matched && layers.clip.matched) {
            return 'REJECT - Multiple duplicate detection methods confirm fraud';
        } else {
            return 'ESCALATE TO HR - High fraud probability detected';
        }
    } else if (status === 'suspicious') {
        const suspiciousLayers = Object.entries(layers)
            .filter(([_, layer]) => layer.score > 0.4)
            .map(([name]) => name);

        return `MANUAL REVIEW REQUIRED - Suspicious patterns in: ${suspiciousLayers.join(', ')}`;
    } else {
        return 'APPROVE - No fraud indicators detected';
    }
}

/**
 * Build early exit result when MD5 match found
 */
function buildEarlyExitResult(md5Result, startTime) {
    return {
        status: 'fraudulent',
        overallScore: 1.0,
        confidence: 1.0,
        layers: {
            md5: md5Result,
            pHash: { score: 0, details: 'Skipped - early exit on MD5 match' },
            clip: { score: 0, details: 'Skipped - early exit on MD5 match' },
            florence: { score: 0, details: 'Skipped - early exit on MD5 match' },
            anomaly: { score: 0, details: 'Skipped - early exit on MD5 match' }
        },
        recommendation: 'REJECT - Exact duplicate file detected',
        processingTime: Date.now() - startTime,
        earlyExit: true,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    runFraudDetection,
    THRESHOLDS,
    WEIGHTS
};

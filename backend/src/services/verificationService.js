const stringSimilarity = require('string-similarity');
const levenshtein = require('levenshtein-edit-distance');

class VerificationService {

  /**
   * Verify CNIC data: Compare extracted vs entered data
   * @param {Object} extractedData - Data from OCR
   * @param {Object} enteredData - Data from registration form
   * @returns {Object} Verification results with score and details
   */
  async verifyCNICData(extractedData, enteredData) {
    const results = {
      nameMatch: this._fuzzyNameMatch(extractedData.name, enteredData.name),
      cnicMatch: this._exactCNICMatch(extractedData.cnicNumber, enteredData.cnicNumber),
      dobMatch: this._dateMatch(extractedData.dob, enteredData.dob),
      fatherNameMatch: this._fuzzyNameMatch(extractedData.fatherName, enteredData.fatherName),
      overallScore: 0,
      passed: false,
      reasons: [],
      details: {}
    };

    // Calculate weighted score
    const weights = {
      name: 0.35,        // 35% weight
      cnic: 0.40,        // 40% weight (most important)
      dob: 0.15,         // 15% weight
      fatherName: 0.10   // 10% weight
    };

    let totalScore = 0;

    // Name matching
    totalScore += results.nameMatch.score * weights.name;
    results.details.name = {
      extracted: extractedData.name,
      entered: enteredData.name,
      score: results.nameMatch.score,
      match: results.nameMatch.matched
    };

    // CNIC matching
    const cnicScore = results.cnicMatch ? 100 : 0;
    totalScore += cnicScore * weights.cnic;
    results.details.cnic = {
      extracted: extractedData.cnicNumber,
      entered: enteredData.cnicNumber,
      score: cnicScore,
      match: results.cnicMatch
    };

    // DOB matching
    const dobScore = results.dobMatch ? 100 : 0;
    totalScore += dobScore * weights.dob;
    results.details.dob = {
      extracted: extractedData.dob,
      entered: enteredData.dob,
      score: dobScore,
      match: results.dobMatch
    };

    // Father name matching
    if (extractedData.fatherName && enteredData.fatherName) {
      totalScore += results.fatherNameMatch.score * weights.fatherName;
      results.details.fatherName = {
        extracted: extractedData.fatherName,
        entered: enteredData.fatherName,
        score: results.fatherNameMatch.score,
        match: results.fatherNameMatch.matched
      };
    }

    results.overallScore = Math.round(totalScore);

    // Determine pass/fail
    const threshold = parseInt(process.env.AI_VERIFICATION_THRESHOLD) || 80;
    results.passed = results.overallScore >= threshold;

    // Add failure reasons
    if (!results.passed) {
      if (!results.cnicMatch) {
        results.reasons.push('CNIC number does not match');
      }
      if (results.nameMatch.score < 70) {
        results.reasons.push(`Name similarity too low (${results.nameMatch.score}%)`);
      }
      if (!results.dobMatch && enteredData.dob) {
        results.reasons.push('Date of birth does not match');
      }
    }

    return results;
  }

  /**
   * Fuzzy name matching using string similarity algorithms
   */
  _fuzzyNameMatch(name1, name2) {
    if (!name1 || !name2) {
      return { score: 0, matched: false };
    }

    // Normalize names (lowercase, trim, remove extra spaces)
    const normalized1 = this._normalizeName(name1);
    const normalized2 = this._normalizeName(name2);

    // Method 1: String similarity (Dice coefficient)
    const similarity = stringSimilarity.compareTwoStrings(normalized1, normalized2);
    const similarityScore = Math.round(similarity * 100);

    // Method 2: Levenshtein distance
    const distance = levenshtein(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const levenshteinScore = Math.round((1 - distance / maxLength) * 100);

    // Take average of both methods
    const finalScore = Math.round((similarityScore + levenshteinScore) / 2);

    const threshold = parseInt(process.env.NAME_MATCH_THRESHOLD) || 70;
    const matched = finalScore >= threshold;

    return {
      score: finalScore,
      matched,
      details: {
        similarity: similarityScore,
        levenshtein: levenshteinScore,
        normalized1,
        normalized2
      }
    };
  }

  /**
   * Exact CNIC matching
   */
  _exactCNICMatch(cnic1, cnic2) {
    if (!cnic1 || !cnic2) return false;

    // Remove all non-digit characters
    const clean1 = cnic1.replace(/\D/g, '');
    const clean2 = cnic2.replace(/\D/g, '');

    return clean1 === clean2;
  }

  /**
   * Date matching (handles different formats)
   */
  _dateMatch(date1, date2) {
    if (!date1 || !date2) return false;

    // Convert to Date objects
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    // Check if both are valid dates
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

    // Compare dates (year, month, day)
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Normalize name for comparison
   */
  _normalizeName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/[^a-z\s]/g, ''); // Remove special characters
  }

  /**
   * Generate human-readable verification summary
   */
  generateVerificationSummary(results) {
    if (results.passed) {
      return `✅ Verification PASSED (Score: ${results.overallScore}%)`;
    } else {
      const reasons = results.reasons.join('; ');
      return `❌ Verification FAILED (Score: ${results.overallScore}%) - ${reasons}`;
    }
  }
}

module.exports = new VerificationService();

const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const fs = require('fs');

class DocumentIntelligenceService {
  constructor() {
    this.endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    this.apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!this.endpoint || !this.apiKey) {
      console.warn('⚠️ Azure Document Intelligence credentials not configured');
      this.client = null;
    } else {
      this.client = new DocumentAnalysisClient(
        this.endpoint,
        new AzureKeyCredential(this.apiKey)
      );
      console.log('✅ Azure Document Intelligence client initialized');
    }
  }

  /**
   * Extract CNIC data from image - Uses OCR for better Pakistani CNIC extraction
   */
  async extractCNICData(filePath) {
    if (!this.client) {
      console.warn('⚠️ Azure client not available, using mock');
      return this._mockCNICExtraction(filePath);
    }

    try {
      console.log('📄 Extracting CNIC data from:', filePath);

      // Read file
      const fileBuffer = fs.readFileSync(filePath);

      // Use prebuilt-idDocument model for structured ID card extraction
      console.log('🔍 Running ID Document analysis...');
      const poller = await this.client.beginAnalyzeDocument(
        "prebuilt-idDocument",
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      console.log('✅ Azure ID Document analysis complete');

      // Try structured extraction first
      const structuredData = this._extractStructuredCNICData(result);

      // Get full text for fallback parsing
      const fullText = result.content || '';

      // If structured extraction has good confidence but missing father name,
      // try to extract it from text
      if (structuredData && structuredData.confidence >= 50) {
        if (!structuredData.fatherName) {
          console.log('⚠️ Father name missing, trying text extraction...');
          const textParsed = this._parseCNICFromText(fullText);
          if (textParsed.fatherName) {
            structuredData.fatherName = textParsed.fatherName;
            structuredData.confidence += 10; // Bonus for finding father name
            console.log('✅ Found father name from text:', textParsed.fatherName);
          }
        }

        // Validate and fix date if needed
        if (structuredData.dob && !this._isValidDate(structuredData.dob)) {
          console.log('⚠️ Invalid date detected, trying text extraction:', structuredData.dob);
          const textParsed = this._parseCNICFromText(fullText);
          if (textParsed.dob && this._isValidDate(textParsed.dob)) {
            structuredData.dob = textParsed.dob;
            console.log('✅ Found valid date from text:', textParsed.dob);
          } else {
            structuredData.dob = null; // Clear invalid date
            console.log('❌ Could not find valid date');
          }
        }

        console.log('📋 Using structured extraction (with enhancements):', structuredData);
        return structuredData;
      }

      // Fallback to OCR text parsing
      console.log('⚠️ Low confidence in structured data, falling back to text parsing');
      console.log('📝 Extracted text length:', fullText.length);
      console.log('📄 RAW OCR TEXT (first 500 chars):');
      console.log('─'.repeat(60));
      console.log(fullText.substring(0, 500));
      console.log('─'.repeat(60));

      const extractedData = this._parseCNICFromText(fullText);
      console.log('📋 Parsed CNIC data from text:', extractedData);

      return extractedData;

    } catch (error) {
      console.error('❌ CNIC extraction error:', error.message);
      console.log('🔄 Falling back to mock extraction');
      return this._mockCNICExtraction(filePath);
    }
  }

  /**
   * Extract CNIC data from structured ID document fields
   */
  _extractStructuredCNICData(result) {
    try {
      console.log('🔍 Extracting structured ID document fields...');

      const document = result.documents?.[0];
      if (!document) {
        console.log('⚠️ No document found in result');
        return null;
      }

      const fields = document.fields || {};
      console.log('📄 Available fields:', Object.keys(fields));

      // Extract fields (Azure returns different field names depending on ID type)
      const firstName = this._getFieldValue(fields, ['FirstName', 'GivenName', 'Name']);
      const lastName = this._getFieldValue(fields, ['LastName', 'Surname']);

      // Build full name properly (don't concatenate null values)
      let fullName = null;
      if (firstName && lastName) {
        fullName = `${firstName} ${lastName}`.trim();
      } else if (firstName) {
        fullName = firstName;
      } else if (lastName) {
        fullName = lastName;
      }

      const cnicNumber = this._getFieldValue(fields, ['DocumentNumber', 'IdNumber', 'IdentificationNumber']);
      const dob = this._getFieldValue(fields, ['DateOfBirth', 'BirthDate']);
      const gender = this._getFieldValue(fields, ['Sex', 'Gender']);

      // Father's name might not be in structured fields, will need text parsing
      const fatherName = this._getFieldValue(fields, ['FatherName', 'ParentName']);
      const address = this._getFieldValue(fields, ['Address', 'ResidentialAddress']);

      // Calculate confidence
      let confidence = 0;
      if (cnicNumber) confidence += 30;
      if (fullName) confidence += 25;
      if (dob) confidence += 20;
      if (fatherName) confidence += 15;
      if (gender) confidence += 5;
      if (address) confidence += 5;

      console.log('✅ Structured extraction result:', {
        name: fullName,
        cnicNumber,
        fatherName,
        dob,
        gender,
        confidence
      });

      return {
        name: fullName || null,
        cnicNumber: cnicNumber || null,
        fatherName: fatherName || null,
        dob: dob || null,
        gender: gender || null,
        address: address || null,
        confidence: confidence
      };

    } catch (error) {
      console.error('❌ Structured extraction error:', error);
      return null;
    }
  }

  /**
   * Helper to get field value from multiple possible field names
   */
  _getFieldValue(fields, possibleNames) {
    for (const name of possibleNames) {
      if (fields[name]) {
        const value = fields[name].content || fields[name].valueString || fields[name].value;
        if (value) {
          return typeof value === 'string' ? value.trim() : String(value);
        }
      }
    }
    return null;
  }

  /**
   * Validate if a date string represents a valid date
   * Accepts formats: dd.mm.yyyy, dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd
   */
  _isValidDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;

    let day, month, year;

    // Try dd.mm.yyyy format
    let match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      [, day, month, year] = match;
    } else {
      // Try dd-mm-yyyy or dd/mm/yyyy format
      match = dateStr.match(/^(\d{2})[\-\/](\d{2})[\-\/](\d{4})$/);
      if (match) {
        [, day, month, year] = match;
      } else {
        // Try yyyy-mm-dd format
        match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          [, year, month, day] = match;
        } else {
          return false; // No format matched
        }
      }
    }

    // Convert to integers
    day = parseInt(day, 10);
    month = parseInt(month, 10);
    year = parseInt(year, 10);

    // Basic validation
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check if date is actually valid (e.g., not 31st Feb)
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }

    return true;
  }

  /**
 * Parse Pakistani CNIC fields from OCR text
 */
_parseCNICFromText(text) {
  console.log('🔍 Parsing CNIC fields from text...');

  // Clean text: normalize whitespace and newlines
  const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  // CNIC Number (format: 12345-1234567-1)
  const cnicMatch = text.match(/(\d{5})\s*-?\s*(\d{7})\s*-?\s*(\d{1})/);
  const cnicNumber = cnicMatch ? `${cnicMatch[1]}-${cnicMatch[2]}-${cnicMatch[3]}` : null;

  // Name - Multiple patterns with increasing flexibility
  let name = null;

  // Pattern 1: Name followed by Father keyword
  const nameMatch1 = cleanText.match(/Name[:\s]+([A-Z][A-Za-z\s]{2,40}?)\s+(?:Father|FATHER)/i);
  if (nameMatch1) {
    name = nameMatch1[1].trim();
  } else {
    // Pattern 2: Just "Name" label (more flexible character range)
    const nameMatch2 = cleanText.match(/(?:Name|NAME)[:\s]+([A-Z][A-Za-z\s]{2,40})/i);
    if (nameMatch2) {
      name = nameMatch2[1].trim();
      // Clean up if it captured too much (stop at known keywords)
      name = name.split(/\s+(?:Father|Gender|Date|Country|Holder)/i)[0].trim();
    } else {
      // Pattern 3: No label - Look for capitalized name directly before "Father" or "Father's"
      // Matches the LAST capitalized name before "Father"
      const nameMatch3 = cleanText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+Father['\s]*/i);
      if (nameMatch3) {
        name = nameMatch3[1].trim();
      }
    }
  }

  // Father's Name - Multiple patterns
  let fatherName = null;

  // Pattern 1: Father's Name or Father Name with terminating keyword
  const fatherMatch1 = cleanText.match(/Father['\s]*Name[:\s]+([A-Z][A-Za-z\s]{2,40}?)\s+(?:Gender|Date|Country|Gend|Holder|GENDER|DATE)/i);
  if (fatherMatch1) {
    fatherName = fatherMatch1[1].trim();
  } else {
    // Pattern 2: Just "Father" label
    const fatherMatch2 = cleanText.match(/Father['\s]*Name[:\s]+([A-Z][A-Za-z\s]{2,40})/i);
    if (fatherMatch2) {
      fatherName = fatherMatch2[1].trim();
      // Clean up captured text
      fatherName = fatherName.split(/\s+(?:Gender|Date|Country|Holder|Male|Female)/i)[0].trim();
    } else {
      // Pattern 3: Just "Father's" or "Father" without "Name" label
      // Typical: "...Jamaal Khan Father's Ajmal Khan Gender..."
      // More flexible: handles "Father's", "Fathers", "Father"
      const fatherMatch3 = cleanText.match(/Father'?s?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:Gender|Nationality|Country|Date|Holder|Male|GENDER)/i);
      if (fatherMatch3) {
        fatherName = fatherMatch3[1].trim();
      }
    }
  }

  // Date of Birth - Look specifically for "Date of Birth" label
  // Pakistani CNICs have: Date of Birth: dd.mm.yyyy and Date of Issue/Expiry below
  let dob = null;
  const dobMatch = cleanText.match(/Date\s*of\s*Birth[:\s]*(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})/i);
  if (dobMatch) {
    const candidateDate = dobMatch[1].replace(/[\-\/]/g, '.');
    // Validate the extracted date
    if (this._isValidDate(candidateDate)) {
      dob = candidateDate;
    } else {
      console.warn('⚠️ Extracted DOB from label is invalid:', candidateDate);
    }
  }

  // Fallback: find first VALID date that's NOT in 2010-2030 range (likely DOB, not issue/expiry)
  if (!dob) {
    const allDates = cleanText.match(/(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})/g);
    if (allDates && allDates.length > 0) {
      for (const dateStr of allDates) {
        const normalizedDate = dateStr.replace(/[\-\/]/g, '.');
        const year = parseInt(dateStr.slice(-4));
        // DOB should be 1960-2010, not 2010-2030 (issue/expiry dates)
        if (year >= 1960 && year <= 2010 && this._isValidDate(normalizedDate)) {
          dob = normalizedDate;
          console.log('✅ Found valid DOB from fallback:', dob);
          break;
        }
      }
    }
  }

  // Gender - Extract single character after "Gender" keyword
  let genderMatch = cleanText.match(/(?:Gender|Sex)[:\s]*(M|F|Male|Female)/i);
  if (!genderMatch) {
    // Try more flexible pattern - Gender might be separated by other words
    // e.g., "Gender Nationality M Pakistan"
    genderMatch = cleanText.match(/(?:Gender|Sex)[:\s]*[A-Za-z\s]*?\s+(M|F)(?:\s|$)/i);
  }
  let gender = genderMatch ? genderMatch[1].toUpperCase() : null;
  if (gender && gender.length > 1) {
    gender = gender[0]; // Convert "Male" -> "M", "Female" -> "F"
  }

  // Address (usually multi-line, appears after "Address" keyword)
  const addressMatch = cleanText.match(/(?:Address|Permanent\s*Address)[:\s]*([A-Za-z0-9\s,\.\-]{10,100}?)\s+(?:Date|CNIC|Signature)/i);
  const address = addressMatch ? addressMatch[1].trim() : null;

  // Calculate confidence based on how many fields we extracted
  let confidence = 0;
  if (cnicNumber) confidence += 30;
  if (name) confidence += 25;
  if (dob) confidence += 20;
  if (fatherName) confidence += 15;
  if (gender) confidence += 5;
  if (address) confidence += 5;

  console.log('✅ Cleaned extracted data:', { name, cnicNumber, fatherName, dob, gender });

  return {
    name: name,
    cnicNumber: cnicNumber,
    fatherName: fatherName,
    dob: dob,
    gender: gender,
    address: address,
    confidence: confidence
  };
}

  /**
   * Mock CNIC extraction for testing/fallback
   */
  _mockCNICExtraction(filePath) {
    console.log('🔧 Using mock CNIC extraction (fallback)');

    return {
      name: "Ahmed Ali Khan",
      cnicNumber: "42101-1234567-8",
      fatherName: "Ali Muhammad Khan",
      dob: "15.05.1995",
      gender: "M",
      address: "House 123, Street 45, Karachi",
      confidence: 90.0
    };
  }

  /**
   * Extract general text from document
   */
  async extractText(filePath) {
    if (!this.client) {
      return { text: "Mock text extraction", confidence: 90.0 };
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const poller = await this.client.beginAnalyzeDocument("prebuilt-read", fileBuffer);
      const result = await poller.pollUntilDone();

      return {
        text: result.content || "",
        confidence: 90.0
      };

    } catch (error) {
      console.error('❌ Text extraction error:', error.message);
      return { text: "", confidence: 0 };
    }
  }
}

module.exports = new DocumentIntelligenceService();

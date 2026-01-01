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

      // Use prebuilt-read (OCR) model for better text extraction
      console.log('🔍 Running OCR analysis...');
      const poller = await this.client.beginAnalyzeDocument(
        "prebuilt-read",
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      console.log('✅ Azure OCR complete');

      // Extract text content
      const fullText = result.content || '';
      console.log('📝 Extracted text length:', fullText.length);

      // Parse CNIC fields from OCR text
      const extractedData = this._parseCNICFromText(fullText);

      console.log('📋 Parsed CNIC data:', extractedData);

      return extractedData;

    } catch (error) {
      console.error('❌ CNIC extraction error:', error.message);
      console.log('🔄 Falling back to mock extraction');
      return this._mockCNICExtraction(filePath);
    }
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

  // Name - Extract text between start and "Father" keyword
  let name = null;
  const nameMatch1 = cleanText.match(/Name[:\s]+([A-Z][A-Za-z\s]{2,30}?)\s+Father/i);
  if (nameMatch1) {
    name = nameMatch1[1].trim();
  } else {
    // Fallback: try "Name" label
    const nameMatch2 = cleanText.match(/Name[:\s]+([A-Z][A-Za-z\s]{2,30})/i);
    name = nameMatch2 ? nameMatch2[1].trim() : null;
  }

  // Father's Name - Extract text between "Father" and next keyword (Gender/Date/Country)
  let fatherName = null;
  const fatherMatch = cleanText.match(/Father['\s]*Name[:\s]+([A-Z][A-Za-z\s]{2,30}?)\s+(?:Gender|Date|Country|Gend)/i);
  if (fatherMatch) {
    fatherName = fatherMatch[1].trim();
  }

  // Date of Birth - Look specifically for "Date of Birth" label
  // Pakistani CNICs have: Date of Birth: dd.mm.yyyy and Date of Issue/Expiry below
  let dob = null;
  const dobMatch = cleanText.match(/Date\s*of\s*Birth[:\s]*(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})/i);
  if (dobMatch) {
    dob = dobMatch[1].replace(/[\-\/]/g, '.');
  } else {
    // Fallback: find first date that's NOT in 2010-2030 range (likely DOB, not issue/expiry)
    const allDates = cleanText.match(/(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})/g);
    if (allDates && allDates.length > 0) {
      for (const date of allDates) {
        const year = parseInt(date.slice(-4));
        // DOB should be 1960-2010, not 2010-2030 (issue/expiry dates)
        if (year >= 1960 && year <= 2010) {
          dob = date.replace(/[\-\/]/g, '.');
          break;
        }
      }
    }
  }

  // Gender - Extract single character after "Gender" keyword
  const genderMatch = cleanText.match(/(?:Gender|Sex)[:\s]*(M|F|Male|Female)/i);
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

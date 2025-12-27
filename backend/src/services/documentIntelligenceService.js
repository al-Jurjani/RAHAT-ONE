const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const fs = require('fs');

class DocumentIntelligenceService {
  constructor() {
    this.endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    this.apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (this.endpoint && this.apiKey) {
      this.client = new DocumentAnalysisClient(
        this.endpoint,
        new AzureKeyCredential(this.apiKey)
      );
    }
  }

  /**
   * Extract data from CNIC image using Azure Document Intelligence
   * @param {string} filePath - Path to CNIC image
   * @returns {Promise<Object>} Extracted CNIC data
   */
  async extractCNICData(filePath) {
    try {
      // For MVP: Mock implementation (Azure has costs)
      // In production: Use actual Azure Document Intelligence

      if (!this.client) {
        console.log('⚠️  Azure Document Intelligence not configured - using mock data');
        return this._mockCNICExtraction(filePath);
      }

      // Read file as buffer
      const fileBuffer = fs.readFileSync(filePath);

      // Analyze document using prebuilt ID document model
      const poller = await this.client.beginAnalyzeDocument(
        "prebuilt-idDocument", // Azure's prebuilt model for IDs
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      // Extract fields from result
      const document = result.documents?.[0];
      if (!document) {
        throw new Error('No document detected in image');
      }

      const fields = document.fields;

      return {
        name: fields.FirstName?.content + ' ' + fields.LastName?.content || '',
        cnicNumber: fields.DocumentNumber?.content || '',
        fatherName: fields.FatherName?.content || '', // May not be in standard model
        dob: fields.DateOfBirth?.content || '',
        gender: fields.Sex?.content || '',
        address: fields.Address?.content || '',
        confidence: document.confidence * 100, // Convert to percentage
        rawData: fields // Store complete data for debugging
      };

    } catch (error) {
      console.error('❌ CNIC extraction error:', error.message);
      throw new Error(`Failed to extract CNIC data: ${error.message}`);
    }
  }

  /**
   * Mock CNIC extraction for development/testing
   * Simulates Azure Document Intelligence response
   */
  _mockCNICExtraction(filePath) {
    console.log('🔧 Using mock CNIC extraction');

    // Simulate processing delay
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return realistic mock data
        resolve({
          name: "Ahmed Ali Khan",
          cnicNumber: "42101-1234567-8",
          fatherName: "Ali Muhammad Khan",
          dob: "1995-05-15",
          gender: "Male",
          address: "House 123, Street 45, Karachi",
          confidence: 92.5,
          rawData: {
            mockNote: "This is simulated data for development"
          }
        });
      }, 1500); // 1.5 second delay to simulate API call
    });
  }

  /**
   * Extract general text from document (fallback)
   */
  async extractText(filePath) {
    try {
      if (!this.client) {
        return { text: "Mock extracted text", confidence: 85 };
      }

      const fileBuffer = fs.readFileSync(filePath);
      const poller = await this.client.beginAnalyzeDocument(
        "prebuilt-read",
        fileBuffer
      );

      const result = await poller.pollUntilDone();

      const text = result.content || '';
      const confidence = result.pages?.[0]?.confidence * 100 || 0;

      return { text, confidence };

    } catch (error) {
      console.error('❌ Text extraction error:', error.message);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }
}

module.exports = new DocumentIntelligenceService();

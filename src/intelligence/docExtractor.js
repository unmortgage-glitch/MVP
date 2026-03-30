/**
 * Mock Document Extractor for Kenward CMS v2
 * This allows the server to run without a Mistral API Key.
 */
export async function extractData(tenantId, files) {
    console.log(`[docExtractor] MOCK MODE: Simulating extraction for ${files.length} files...`);
    
    // Simulate a 1-second delay like a real API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return a standard "Safe" lead structure for testing
    return {
        fullName: "Test Borrower",
        annualIncome: 85000,
        employer: "Agassiz Agriculture Ltd",
        totalDebt: 15000,
        extractionDate: new Date().toISOString(),
        status: "MOCK_DATA"
    };
}

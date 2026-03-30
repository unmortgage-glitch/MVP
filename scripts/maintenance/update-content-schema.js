// update-content-schema.js
const fs = require('fs');
const path = require('path');

const LOGIC_DIR = path.join(__dirname, 'logic');
const SCHEMA_PATH = path.join(LOGIC_DIR, 'ContentBlockSchema.json');

// --- Final Content Block Schema Definition ---
const COMPLETE_CONTENT_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://kenward.ca/schemas/content-block-v1.json",
  "title": "Dynamic Content Block Array Schema",
  "description": "Defines the structure for content used to abstractly generate EJS views, enforcing required data fields.",
  "type": "object",
  "required": ["contentBlocks"],
  "properties": {
    "contentBlocks": {
      "type": "array",
      "minItems": 0,
      "items": {
        "title": "A Single Content Block",
        "type": "object",
        "required": ["type", "data"],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "image", "audio", "video", "text", "list", 
              "form", "cta", "accordion", "quote", "calculator"
            ]
          },
          "data": { "type": "object" }
        },
        
        // --- Logic as Data: The Validation Rules (oneOf) for all 10 blocks ---
        "oneOf": [
          // 1. image
          { "properties": { "type": { "const": "image" }, "data": { "required": ["imageUrl", "altText"] }}},
          // 2. audio
          { "properties": { "type": { "const": "audio" }, "data": { "required": ["audioUrl", "trackName"] }}},
          // 3. video
          { "properties": { "type": { "const": "video" }, "data": { "required": ["videoUrl", "provider"] }}},
          // 4. text
          { "properties": { "type": { "const": "text" }, "data": { "required": ["body"], "properties": { "body": { "minLength": 1 } } }}},
          // 5. list
          { "properties": { "type": { "const": "list" }, "data": { "required": ["items", "style"], "properties": { "items": { "type": "array", "minItems": 1 } } }}},
          // 6. quote
          { "properties": { "type": { "const": "quote" }, "data": { "required": ["quoteText", "source"] }}},
          // 7. cta (Call to Action)
          { "properties": { "type": { "const": "cta" }, "data": { "required": ["buttonText", "linkUrl"] }}},
          // 8. form (Requires title, target endpoint, and field structure)
          { 
            "properties": { 
              "type": { "const": "form" }, 
              "data": { "required": ["formTitle", "targetEndpoint", "fields"] }
            }
          },
          // 9. accordion (Requires at least one section)
          { 
            "properties": { 
              "type": { "const": "accordion" }, 
              "data": { "required": ["sections"], "properties": { "sections": { "type": "array", "minItems": 1 } } }
            }
          },
          // 10. calculator (Requires type and default rate for mortgage calcs)
          { 
            "properties": { 
              "type": { "const": "calculator" }, 
              "data": { 
                "required": ["calculatorType", "defaultRate"],
                "properties": {
                  "calculatorType": { "type": "string", "enum": ["PaymentEstimator", "Affordability", "TDSGSDRatio"] },
                  "defaultRate": { "type": "number", "minimum": 0 }
                }
              }
            }
          }
        ]
      }
    }
  },
  "additionalProperties": true
};
// ----------------------------------------------------------------------

try {
    // 1. Ensure the /logic directory exists
    if (!fs.existsSync(LOGIC_DIR)) {
        fs.mkdirSync(LOGIC_DIR);
        console.log(`- Created directory: ${LOGIC_DIR}`);
    }

    // 2. Write the complete schema JSON to the file
    const jsonContent = JSON.stringify(COMPLETE_CONTENT_SCHEMA, null, 2);
    fs.writeFileSync(SCHEMA_PATH, jsonContent);
    
    console.log(`\n✅ SUCCESS: logic/ContentBlockSchema.json has been created/overwritten.`);
    console.log(`The final schema now validates all 10 content block types.`);
} catch (error) {
    console.error(`\n❌ ERROR: Failed to write logic/ContentBlockSchema.json.`);
    console.error(error.message);
}

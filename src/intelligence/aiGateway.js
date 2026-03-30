// src/intelligence/aiGateway.js
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { SYSTEM_INSTRUCTION } from "./prompt_templates.js";

// --- PURE HELPER FUNCTIONS ---

const clean_json_output = (text) => {
  return text
    .replace(/^```json\s*/, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
};

/**
 * Generates a unique temp file path.
 * @param {string} ext - File extension (e.g., 'mp3')
 */
const get_temp_path = (ext) => path.join(os.tmpdir(), `upload_${Date.now()}.${ext}`);

// --- IMPURE FACTORY (The Multimodal Gateway) ---

const create_ai_gateway = (api_key) => (config) => async (input_payload) => {
  if (!api_key) throw new Error("GEMINI_API_KEY is missing.");

  // 1. Initialize Clients
  const gen_ai = new GoogleGenerativeAI(api_key);
  const file_manager = new GoogleAIFileManager(api_key);

  // 2. Configure Model
  const model = gen_ai.getGenerativeModel({
    model: config.model || "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  });

  // Resource Tracking (Hoisted for Finally Block Scope)
  let local_file_path = null;
  let remote_file_name = null;

  try {
    const prompt_parts = [];

    // --- BRANCH A: HANDLE AUDIO FILE ---
    if (input_payload.buffer && input_payload.mimetype) {
      // A1. Write Buffer to Temp Disk
      // (The SDK's uploadFile currently requires a path, not a stream/buffer)
      const ext = input_payload.mimetype.split('/')[1] || 'bin';
      local_file_path = get_temp_path(ext);
      await fs.promises.writeFile(local_file_path, input_payload.buffer);
      console.log(`[AI Gateway] Temp file written: ${local_file_path}`);

      // A2. Upload to Google File API
      const upload_response = await file_manager.uploadFile(local_file_path, {
        mimeType: input_payload.mimetype,
        displayName: "Client_Audio_Upload"
      });

      // A3. Capture Remote ID for Cleanup
      remote_file_name = upload_response.file.name;
      console.log(`[AI Gateway] Remote file uploaded: ${remote_file_name}`);

      // A4. Add to Prompt
      prompt_parts.push({
        fileData: {
          mimeType: upload_response.file.mimeType,
          fileUri: upload_response.file.uri
        }
      });
    }

    // --- BRANCH B: HANDLE TEXT ---
    if (input_payload.text) {
      prompt_parts.push({ text: input_payload.text });
    }

    // --- VALIDATION ---
    if (prompt_parts.length === 0) {
      throw new Error("No text or audio input provided.");
    }

    // 3. Execution (The Generation)
    const result = await model.generateContent(prompt_parts);
    const raw_text = result.response.text();

    // 4. Parse Output
    const clean_text = clean_json_output(raw_text);
    return JSON.parse(clean_text);

  } catch (error) {
    console.error(`[AI Raw Error]: ${error.message}`);
    throw new Error(`[AI Gateway] Processing failed: ${error.message}`);

  } finally {
    // 5. CLEANUP PROTOCOL (Strict)
    
    // Clean Local Disk
    if (local_file_path) {
      try {
        await fs.promises.unlink(local_file_path);
        console.log(`[AI Gateway] Local temp file deleted.`);
      } catch (e) {
        console.warn(`[AI Gateway Warning] Failed to delete local temp: ${e.message}`);
      }
    }

    // Clean Remote Storage
    if (remote_file_name) {
      try {
        await file_manager.deleteFile(remote_file_name);
        console.log(`[AI Gateway] Remote file deleted.`);
      } catch (e) {
        console.warn(`[AI Gateway Warning] Failed to delete remote file: ${e.message}`);
      }
    }
  }
};

export default create_ai_gateway;

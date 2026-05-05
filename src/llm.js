// ─────────────────────────────────────────────
// src/llm.js — Gemini API wrapper using @google/genai
// ─────────────────────────────────────────────

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { logError } from "./logger.js";

dotenv.config();

const MODEL_NAME = "gemma-4-31b-it";

let ai = null;

/**
 * Initialize the Gemini AI client.
 */
export function initLLM() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    logError("GEMINI_API_KEY not set in .env file!");
    logError('Please add your Gemini API key to the .env file.');
    process.exit(1);
  }
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Send a prompt to the Gemini model and get a text response.
 * @param {string} prompt - The prompt to send
 * @param {object} [options] - Optional config overrides
 * @returns {Promise<string>} The model's text response
 */
export async function askLLM(prompt, options = {}) {
  if (!ai) initLLM();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 8192,
      },
    });

    return response.text?.trim() || "";
  } catch (err) {
    logError(`LLM request failed: ${err.message}`);
    throw err;
  }
}

/**
 * Extract only code from an LLM response (strips markdown fences).
 * @param {string} response
 * @param {string} lang - Expected language (html, css, js)
 * @returns {string}
 */
export function extractCode(response, lang = "html") {
  // Try to extract from markdown code fences
  const fencePatterns = [
    new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)\\n```", "i"),
    new RegExp("```\\s*\\n([\\s\\S]*?)\\n```", "i"),
  ];

  for (const pattern of fencePatterns) {
    const match = response.match(pattern);
    if (match) return match[1].trim();
  }

  // If no code fence found, return the whole response (it might be raw code)
  return response.trim();
}

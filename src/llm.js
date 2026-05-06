// ─────────────────────────────────────────────
// src/llm.js — Gemini API wrapper using @google/genai
// With pre-flight health checks and retry logic
// ─────────────────────────────────────────────

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { logError, logSuccess, logInfo, logAction, startSpinner, spinnerSuccess, spinnerFail } from "./logger.js";

dotenv.config();

const MODEL_NAME = "gemma-4-31b-it";

let ai = null;
let modelVerified = false;

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

  // Basic format check
  if (apiKey.length < 20) {
    logError("GEMINI_API_KEY looks invalid (too short). Please check your .env file.");
    process.exit(1);
  }

  ai = new GoogleGenAI({ apiKey });
  logInfo(`LLM initialized with model: ${MODEL_NAME}`);
}

/**
 * Get the current model name.
 * @returns {string}
 */
export function getModelName() {
  return MODEL_NAME;
}

/**
 * Pre-flight health check: sends a tiny prompt to verify
 * the model is reachable, the API key works, and tokens are available.
 * MUST be called before starting any generation pipeline.
 *
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function verifyModelHealth() {
  if (!ai) initLLM();

  const spinner = startSpinner(`Verifying model "${MODEL_NAME}" is reachable...`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Reply with exactly: OK",
      config: {
        temperature: 0,
        maxOutputTokens: 16,
      },
    });

    const text = response.text?.trim() || "";

    if (!text) {
      spinnerFail(spinner, "Model returned empty response — may be overloaded or out of quota");
      return { ok: false, error: "Model returned empty response. Check quota/billing." };
    }

    modelVerified = true;
    spinnerSuccess(spinner, `Model "${MODEL_NAME}" is alive and responding ✓`);
    return { ok: true };
  } catch (err) {
    const status = err?.status || err?.statusCode || "";
    const message = err?.message || String(err);

    spinnerFail(spinner, `Model health check FAILED`);

    if (status === 429 || message.includes("429") || message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("quota")) {
      logError("⚠ Rate limit / quota exceeded. You've run out of tokens or hit the RPM limit.");
      logError("  → Wait a minute, or switch to a different API key / model.");
      return { ok: false, error: "Rate limit or quota exceeded" };
    }

    if (status === 500 || message.includes("500") || message.toLowerCase().includes("internal")) {
      logError("⚠ Server returned 500 Internal Error. The model may be down or overloaded.");
      logError("  → Try again in a few minutes, or switch models.");
      return { ok: false, error: "Server 500 error — model may be down" };
    }

    if (status === 403 || message.includes("403") || message.toLowerCase().includes("permission")) {
      logError("⚠ Permission denied (403). Your API key may not have access to this model.");
      logError(`  → Check that your key supports model "${MODEL_NAME}".`);
      return { ok: false, error: "Permission denied — check API key permissions" };
    }

    if (status === 404 || message.includes("404") || message.toLowerCase().includes("not found")) {
      logError(`⚠ Model "${MODEL_NAME}" not found (404). It may not exist or be unavailable.`);
      logError("  → Update MODEL_NAME in src/llm.js to a valid model.");
      return { ok: false, error: "Model not found" };
    }

    logError(`⚠ Unexpected error: ${message}`);
    return { ok: false, error: message };
  }
}

/**
 * Sleep helper for retry backoff.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a prompt to the Gemini model and get a text response.
 * Includes retry logic with exponential backoff for transient errors.
 *
 * @param {string} prompt - The prompt to send
 * @param {object} [options] - Optional config overrides
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.retries=3] - Max retry attempts for transient errors
 * @returns {Promise<string>} The model's text response
 */
export async function askLLM(prompt, options = {}) {
  if (!ai) initLLM();

  const maxRetries = options.retries ?? 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 8192,
        },
      });

      const text = response.text?.trim() || "";

      // Validate we got a non-empty response
      if (!text) {
        logError(`LLM returned empty response (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) {
          const delay = 2000 * attempt;
          logInfo(`Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }
        throw new Error("LLM returned empty response after all retries. Check model quota.");
      }

      return text;
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.statusCode || "";
      const message = err?.message || String(err);
      const isRetryable =
        status === 500 ||
        status === 503 ||
        status === 429 ||
        message.includes("500") ||
        message.includes("503") ||
        message.includes("429") ||
        message.toLowerCase().includes("internal") ||
        message.toLowerCase().includes("overloaded") ||
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("resource exhausted") ||
        message.toLowerCase().includes("unavailable");

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000); // 2s, 4s, 8s... max 30s
        logError(`LLM request failed (${status || "error"}): ${message}`);
        logInfo(`Retrying in ${delay / 1000}s... (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      // Non-retryable or out of retries
      if (status === 429 || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
        logError(`🚫 QUOTA EXHAUSTED: ${message}`);
        logError("  → Wait for quota reset, use a different API key, or switch models.");
      } else if (status === 500 || message.includes("500")) {
        logError(`🚫 SERVER ERROR (500): ${message}`);
        logError("  → The model is returning server errors. Try again later or switch models.");
      } else {
        logError(`LLM request failed: ${message}`);
      }

      throw err;
    }
  }

  throw lastError || new Error("LLM request failed after all retries");
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

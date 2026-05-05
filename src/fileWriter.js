// ─────────────────────────────────────────────
// src/fileWriter.js — File system operations for output
// Supports dynamic project-specific output directories
// ─────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import { logAction, logSuccess, logError } from "./logger.js";

const BASE_OUTPUT_DIR = path.resolve("output");

/** Current active output directory (set per project) */
let activeOutputDir = BASE_OUTPUT_DIR;

/**
 * Derive a clean folder name from a URL or user input string.
 * @param {string} input - URL or text description
 * @returns {string} A filesystem-safe folder name
 */
export function deriveFolderName(input) {
  // Try to extract hostname from URL
  const urlMatch = input.match(/https?:\/\/(?:www\.)?([^\s\/]+)/);
  if (urlMatch) {
    // Use the hostname: "scaler.com", "stripe.com", "monkeytype.com"
    return urlMatch[1]
      .replace(/[^a-zA-Z0-9.-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  // For text descriptions: take first 3-4 meaningful words
  const cleaned = input
    .toLowerCase()
    .replace(/^(clone|build|create|make|generate)\s+/i, "")  // strip command verbs
    .replace(/^(a|an|the)\s+/i, "")                          // strip articles
    .replace(/[^a-z0-9\s]/g, "")                             // remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");

  return cleaned || "website";
}

/**
 * Set the active output directory for the current generation.
 * Creates the directory if it doesn't exist.
 * @param {string} folderName - Name of the subdirectory under output/
 * @returns {string} The full path to the active output directory
 */
export function setOutputDir(baseFolderName) {
  let folderName = baseFolderName;
  let attemptPath = path.join(BASE_OUTPUT_DIR, folderName);
  let counter = 1;

  while (fs.existsSync(attemptPath)) {
    folderName = `${baseFolderName}_${counter}`;
    attemptPath = path.join(BASE_OUTPUT_DIR, folderName);
    counter++;
  }

  activeOutputDir = attemptPath;
  fs.mkdirSync(activeOutputDir, { recursive: true });
  logAction(`Created project directory: ${activeOutputDir}`);

  return activeOutputDir;
}

/**
 * Get the current active output directory.
 */
export function getActiveOutputDir() {
  return activeOutputDir;
}

/**
 * Ensure the active output directory exists.
 */
export function ensureOutputDir() {
  if (!fs.existsSync(activeOutputDir)) {
    fs.mkdirSync(activeOutputDir, { recursive: true });
    logAction(`Created output directory: ${activeOutputDir}`);
  }
}

/**
 * Write an HTML file with optional prettier formatting.
 * @param {string} filename
 * @param {string} content
 */
export async function writeHTML(filename, content) {
  ensureOutputDir();
  const filePath = path.join(activeOutputDir, filename);

  try {
    const formatted = await prettier.format(content, {
      parser: "html",
      printWidth: 120,
      tabWidth: 2,
    });
    fs.writeFileSync(filePath, formatted, "utf-8");
  } catch {
    // If prettier fails, write raw content
    fs.writeFileSync(filePath, content, "utf-8");
  }

  logSuccess(`Written: ${filePath}`);
  return filePath;
}

/**
 * Write a CSS file with optional prettier formatting.
 * @param {string} filename
 * @param {string} content
 */
export async function writeCSS(filename, content) {
  ensureOutputDir();
  const filePath = path.join(activeOutputDir, filename);

  try {
    const formatted = await prettier.format(content, {
      parser: "css",
      printWidth: 100,
      tabWidth: 2,
    });
    fs.writeFileSync(filePath, formatted, "utf-8");
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
  }

  logSuccess(`Written: ${filePath}`);
  return filePath;
}

/**
 * Write a JavaScript file with optional prettier formatting.
 * @param {string} filename
 * @param {string} content
 */
export async function writeJS(filename, content) {
  ensureOutputDir();
  const filePath = path.join(activeOutputDir, filename);

  try {
    const formatted = await prettier.format(content, {
      parser: "babel",
      printWidth: 100,
      tabWidth: 2,
      semi: true,
    });
    fs.writeFileSync(filePath, formatted, "utf-8");
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
  }

  logSuccess(`Written: ${filePath}`);
  return filePath;
}

/**
 * Get the absolute path to a file in the active output directory.
 */
export function getOutputPath(filename) {
  return path.join(activeOutputDir, filename);
}

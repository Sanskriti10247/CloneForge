#!/usr/bin/env node
// ─────────────────────────────────────────────
// index.js — CloneForge CLI Entry Point 🎀
// A cute conversational AI agent for cloning any website 🌸
// ─────────────────────────────────────────────

import readline from "node:readline";
import fs from "node:fs";
import { initLLM, verifyModelHealth, getModelName } from "./src/llm.js";
import { runAgent, improveSection } from "./src/agent.js";
import {
  printBanner,
  logThinking,
  logAction,
  logSuccess,
  logError,
  logInfo,
  logSeparator,
  colors,
} from "./src/logger.js";
import { getOutputPath, writeHTML } from "./src/fileWriter.js";
import open from "open";

// ── Initialize ──
printBanner();
initLLM();

// ── Pre-flight model health check at startup ──
logInfo(`Model: ${getModelName()}`);
const startupHealth = await verifyModelHealth();
if (!startupHealth.ok) {
  logError("══════════════════════════════════════════════════");
  logError("  ⚠  MODEL IS NOT AVAILABLE AT STARTUP");
  logError(`  Reason: ${startupHealth.error}`);
  logError("  You can still try commands, but generation will likely fail.");
  logError("  Fix: check your API key, quota, or switch models in src/llm.js");
  logError("══════════════════════════════════════════════════");
} else {
  logSuccess(`Model "${getModelName()}" verified — ready to generate!`);
}

// ── State ──
let lastGeneratedPath = null;

// ── Command aliases for common typos ──
const commandAliases = new Map([
  ["imporve", "improve"],
  ["imprvoe", "improve"],
  ["imrpove", "improve"],
  ["imprve", "improve"],
  ["improv", "improve"],
  ["improve", "improve"],
]);

function normalizeCommand(input) {
  const parts = input.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() || "";
  const command = commandAliases.get(first) || first;
  const args = parts.slice(1).join(" ").trim();

  return { command, args, lowerInput: input.toLowerCase() };
}

// ── Readline interface ──
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colors.brand("  🎀 cloneForge > "),
});

// ── Welcome message ──
console.log(
  colors.info("  Welcome! 🎀 I'm your adorable AI website cloning agent! 🌸")
);
console.log(
  colors.info("  Give me a URL and I'll scrape + clone it, or describe what to build.\n")
);
console.log(colors.dim("  Examples:"));
console.log(
  colors.dim("    clone https://www.scaler.com    → Scrape & clone Scaler")
);
console.log(
  colors.dim("    clone https://stripe.com        → Scrape & clone Stripe")
);
console.log(
  colors.dim("    build a portfolio website       → Generate from description")
);
console.log(colors.dim(""));
console.log(colors.dim("  Commands:"));
console.log(
  colors.dim("    improve <section> → Re-improve a section (e.g., improve hero)")
);
console.log(
  colors.dim("    open             → Re-open the last generated site")
);
console.log(
  colors.dim("    help             → Show available commands")
);
console.log(colors.dim("    exit             → Quit CloneForge 🎀\n"));

rl.prompt();

// ── Handle input ──
rl.on("line", async (line) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  const { command, args, lowerInput } = normalizeCommand(input);

  // ── Exit ──
  if (command === "exit" || lowerInput === "quit" || lowerInput === "q") {
    logInfo("Goodbye! 🎀 Have a purr-fect day! 👋");
    process.exit(0);
  }

  // ── Help ──
  if (command === "help") {
    showHelp();
    rl.prompt();
    return;
  }

  // ── Open in browser ──
  if (command === "open") {
    if (lastGeneratedPath && fs.existsSync(lastGeneratedPath)) {
      logAction("Opening in browser...");
      await open(lastGeneratedPath);
      logSuccess("Opened in browser!");
    } else {
      logError("No generated site found. Run a clone command first.");
    }
    rl.prompt();
    return;
  }

  // ── Improve a section ──
  if (command === "improve") {
    const sectionName = args;
    if (!sectionName) {
      logError("Please specify a section to improve (e.g., improve hero).");
      rl.prompt();
      return;
    }
    if (!lastGeneratedPath || !fs.existsSync(lastGeneratedPath)) {
      logError("No generated site found. Run a clone command first.");
      rl.prompt();
      return;
    }

    const currentHTML = fs.readFileSync(lastGeneratedPath, "utf-8");
    const improved = await improveSection(sectionName, currentHTML);
    if (improved) {
      logInfo("Section improved! Run 'open' to see changes.");
    }
    rl.prompt();
    return;
  }

  // ── Regenerate shorthand ──
  if (lowerInput.startsWith("regenerate ")) {
    logInfo("Use 'improve <section>' to regenerate a section.");
    rl.prompt();
    return;
  }

  // ── Default: treat as a generation instruction ──
  try {
    const htmlPath = await runAgent(input);
    lastGeneratedPath = htmlPath;

    logSeparator();
    logAction("Opening generated website in browser...");
    await open(htmlPath);
    logSuccess("Website opened in browser! 🌸✨");
    logInfo("Type 'improve <section>' to refine, or enter a new instruction.");
  } catch (err) {
    logError(`Agent failed: ${err.message}`);
  }

  logSeparator();
  rl.prompt();
});

rl.on("close", () => {
  logInfo("\nGoodbye! 🎀 Have a purr-fect day! 👋");
  process.exit(0);
});

// ── Help text ──
function showHelp() {
  logSeparator();
  console.log(colors.brand.bold("  🎀 CloneForge — Available Commands 🌸\n"));
  console.log(
    colors.info("  <url>                → Scrape & clone any website")
  );
  console.log(
    colors.info("  clone <url>          → Scrape & clone a specific URL")
  );
  console.log(
    colors.info("  <description>        → Build a website from description")
  );
  console.log(
    colors.info("  improve <section>    → Re-improve a specific section")
  );
  console.log(
    colors.info("  open                 → Open last generated site in browser")
  );
  console.log(colors.info("  help                 → Show this help menu"));
  console.log(colors.info("  exit                 → Quit CloneForge"));
  logSeparator();
}

// ─────────────────────────────────────────────
// src/agent.js — Core agent logic with scrape → generate → improve loops
// ─────────────────────────────────────────────

import { askLLM, extractCode } from "./llm.js";
import {
  planPrompt,
  generateSectionPrompt,
  evaluatePrompt,
  improvePrompt,
  generateScriptPrompt,
  assemblePrompt,
} from "./prompts.js";
import {
  logThinking,
  logAction,
  logSuccess,
  logError,
  logImprove,
  logSeparator,
  startSpinner,
  spinnerSuccess,
  spinnerFail,
} from "./logger.js";
import { writeHTML, writeJS, deriveFolderName, setOutputDir } from "./fileWriter.js";
import { scrapeWebsite, formatDesignBrief } from "./scraper.js";

const MAX_IMPROVE_ITERATIONS = 2;   // Number of improvement loops per section
const MIN_QUALITY_SCORE = 8.5;      // Score threshold to skip further improvements

/**
 * Extract a URL from the user instruction if present.
 * @param {string} input
 * @returns {string|null}
 */
function extractURL(input) {
  const urlMatch = input.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Main agent pipeline: scrape → plan → generate → improve → assemble → write
 * @param {string} userInstruction - What the user wants
 * @returns {Promise<string>} Path to the generated index.html
 */
export async function runAgent(userInstruction) {
  logSeparator();

  // ── Step 1: Understand the request ──
  logThinking("Understanding your request...");
  logThinking(`User wants: "${userInstruction}"`);

  // ── Set up project output directory ──
  const folderName = deriveFolderName(userInstruction);
  const outputDir = setOutputDir(folderName);
  logAction(`Output directory: output/${folderName}/`);

  // ── Step 2: Scrape target website (if URL provided) ──
  let designBrief = null;
  let siteData = null;
  const targetURL = extractURL(userInstruction);

  if (targetURL) {
    logSeparator();
    logAction(`Detected target URL: ${targetURL}`);
    logThinking("Launching Playwright to scrape the website...");

    try {
      siteData = await scrapeWebsite(targetURL);
      designBrief = formatDesignBrief(siteData);
      logSuccess(`Scraped design brief: ${designBrief.split("\n").length} lines of design data`);
    } catch (err) {
      logError(`Scraping failed: ${err.message}`);
      logAction("Continuing without scrape data — will use AI to infer design...");
    }
  } else {
    logThinking("No URL detected — will generate based on your description.");
  }

  // ── Step 3: Plan sections ──
  logSeparator();
  const spinner1 = startSpinner("Planning website sections...");
  let sections;
  try {
    const planResponse = await askLLM(planPrompt(userInstruction, designBrief));
    sections = parseSections(planResponse);
    spinnerSuccess(spinner1, `Planned ${sections.length} sections: ${sections.join(", ")}`);
  } catch (err) {
    spinnerFail(spinner1, "Failed to plan sections");
    logError(err.message);
    sections = ["header", "hero", "features", "footer"];
    logAction(`Using default sections: ${sections.join(", ")}`);
  }

  // ── Step 4: Generate each section with improvement loop ──
  const sectionCodes = {};

  for (const section of sections) {
    logSeparator();
    logAction(`Starting work on: ${section.toUpperCase()}`);

    // Generate initial version
    const genSpinner = startSpinner(`Generating ${section}...`);
    let code;
    try {
      const response = await askLLM(
        generateSectionPrompt(section, sections, designBrief),
        { maxTokens: 4096 }
      );
      code = extractCode(response, "html");
      spinnerSuccess(genSpinner, `${section} — initial version generated`);
    } catch (err) {
      spinnerFail(genSpinner, `Failed to generate ${section}`);
      logError(err.message);
      continue;
    }

    // ── Improvement loop ──
    for (let i = 1; i <= MAX_IMPROVE_ITERATIONS; i++) {
      logImprove(i, MAX_IMPROVE_ITERATIONS, `Evaluating ${section}...`);

      // Evaluate current version
      const evalSpinner = startSpinner(`Evaluating ${section} quality...`);
      let evaluation;
      try {
        const evalResponse = await askLLM(evaluatePrompt(section, code, designBrief));
        evaluation = parseEvaluation(evalResponse);
        spinnerSuccess(
          evalSpinner,
          `${section} quality score: ${evaluation.score}/10`
        );
      } catch (err) {
        spinnerFail(evalSpinner, `Evaluation failed, continuing...`);
        break;
      }

      // Skip improvement if quality is good enough
      if (evaluation.score >= MIN_QUALITY_SCORE) {
        logSuccess(`${section} meets quality threshold (${evaluation.score}/10). Moving on!`);
        break;
      }

      // Apply improvements
      logImprove(
        i,
        MAX_IMPROVE_ITERATIONS,
        `Improving: ${evaluation.improvements.slice(0, 3).join(", ")}`
      );
      const improveSpinner = startSpinner(`Improving ${section}...`);
      try {
        const improvedResponse = await askLLM(
          improvePrompt(section, code, evaluation.improvements, designBrief),
          { maxTokens: 4096 }
        );
        code = extractCode(improvedResponse, "html");
        spinnerSuccess(improveSpinner, `${section} — improved (iteration ${i})`);
      } catch (err) {
        spinnerFail(improveSpinner, `Improvement failed`);
        break;
      }
    }

    sectionCodes[section] = code;
    logSuccess(`${section.toUpperCase()} — finalized ✨`);
  }

  // ── Step 5: Generate JavaScript ──
  logSeparator();
  logAction("Generating page interactivity (JavaScript)...");
  const jsSpinner = startSpinner("Generating JavaScript...");
  let jsCode = "";
  try {
    const jsResponse = await askLLM(generateScriptPrompt(sections));
    jsCode = extractCode(jsResponse, "javascript");
    spinnerSuccess(jsSpinner, "JavaScript generated");
  } catch (err) {
    spinnerFail(jsSpinner, "JS generation failed, continuing without it");
  }

  // ── Step 6: Assemble final HTML ──
  logSeparator();
  logAction("Assembling final website...");
  const assembleSpinner = startSpinner("Creating HTML shell...");
  let shellHTML;
  try {
    const shellResponse = await askLLM(assemblePrompt(siteData));
    shellHTML = extractCode(shellResponse, "html");
    spinnerSuccess(assembleSpinner, "HTML shell created");
  } catch (err) {
    spinnerFail(assembleSpinner, "Shell generation failed, using fallback");
    shellHTML = getFallbackShell(siteData);
  }

  // Inject all sections into the shell
  const allSectionsHTML = sections
    .map((s) => sectionCodes[s] || "")
    .join("\n\n");
  const finalHTML = shellHTML.replace(
    "<!-- SECTIONS_PLACEHOLDER -->",
    allSectionsHTML
  );

  // ── Step 7: Write output files ──
  logSeparator();
  logAction("Writing output files...");
  const htmlPath = await writeHTML("index.html", finalHTML);
  if (jsCode) {
    await writeJS("script.js", jsCode);
  }

  logSeparator();
  logSuccess("🎉 Website generation complete!");

  return htmlPath;
}

/**
 * Improve a specific section on demand (for interactive "improve <section>" command).
 */
export async function improveSection(sectionName, currentHTML) {
  logSeparator();
  logAction(`Re-improving section: ${sectionName}`);

  const evalSpinner = startSpinner(`Evaluating ${sectionName}...`);
  let evaluation;
  try {
    const evalResponse = await askLLM(evaluatePrompt(sectionName, currentHTML));
    evaluation = parseEvaluation(evalResponse);
    spinnerSuccess(evalSpinner, `Quality: ${evaluation.score}/10`);
  } catch {
    spinnerFail(evalSpinner, "Evaluation failed");
    return null;
  }

  const improveSpinner = startSpinner(`Improving ${sectionName}...`);
  try {
    const improved = await askLLM(
      improvePrompt(sectionName, currentHTML, evaluation.improvements),
      { maxTokens: 4096 }
    );
    const code = extractCode(improved, "html");
    spinnerSuccess(improveSpinner, `${sectionName} improved!`);
    return code;
  } catch {
    spinnerFail(improveSpinner, "Improvement failed");
    return null;
  }
}

// ── Helpers ──

function parseSections(response) {
  try {
    const match = response.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => s.toLowerCase().trim());
      }
    }
  } catch {
    // ignore parse errors
  }
  return ["header", "hero", "features", "footer"];
}

function parseEvaluation(response) {
  try {
    const match = response.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        score: parsed.score || 5,
        improvements: parsed.improvements || [
          "Improve spacing and alignment",
          "Add better hover effects",
          "Enhance color contrast",
        ],
      };
    }
  } catch {
    // ignore
  }
  return {
    score: 5,
    improvements: [
      "Improve spacing and alignment",
      "Enhance visual design quality",
      "Add better colors and typography",
    ],
  };
}

function getFallbackShell(siteData = null) {
  const title = siteData?.title || "Cloned Website";
  const desc = siteData?.metaDesc || "A cute website clone generated by CloneForge. 🎀✨";
  const font = siteData?.fonts?.[0] || "Inter";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${desc}" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${font.replace(/\s/g, "+")}:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: '${font}', sans-serif; color: #333; background: #fff; overflow-x: hidden; line-height: 1.6; }
    a { text-decoration: none; color: inherit; }
    img { max-width: 100%; }
    .reveal-section { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .reveal-section.revealed { opacity: 1; transform: translateY(0); }
    #scrollTopBtn { position: fixed; bottom: 30px; right: 30px; width: 48px; height: 48px; background: #0052cc; color: white; border: none; cursor: pointer; font-size: 20px; display: none; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    #scrollTopBtn:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div id="app">
    <!-- SECTIONS_PLACEHOLDER -->
  </div>
  <button id="scrollTopBtn" title="Back to top">↑</button>
  <script src="script.js"></script>
</body>
</html>`;
}

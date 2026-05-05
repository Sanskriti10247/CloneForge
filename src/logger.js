// ─────────────────────────────────────────────
// src/logger.js — Premium CLI logging with chalk + ora
// ─────────────────────────────────────────────

import chalk from "chalk";
import ora from "ora";

// ── Color palette ──
const colors = {
  brand: chalk.hex("#FF69B4"),       // Hot pink accent 🎀
  thinking: chalk.hex("#FFB6C1"),    // Light pink 🌸
  action: chalk.hex("#FFC0CB"),      // Soft pink ✨
  success: chalk.hex("#FF1493"),     // Deep pink 💖
  error: chalk.hex("#FF4500"),       // Reddish orange 🍓
  info: chalk.hex("#FF99CC"),       // Pink info 🎀
  highlight: chalk.hex("#DB7093"),   // Pale violet red 🌷
  dim: chalk.dim,
  bold: chalk.bold,
};

/**
 * Prints the CloneForge ASCII banner at startup. 🎀
 */
export function printBanner() {
  console.log();
  console.log(
    colors.brand.bold(`
   ██████╗██╗      ██████╗ ███╗  ██╗███████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
  ██╔════╝██║     ██╔═══██╗████╗ ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
  ██║     ██║     ██║   ██║██╔██╗██║█████╗  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
  ██║     ██║     ██║   ██║██║╚██╗█║██╔══╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
  ╚██████╗███████╗╚██████╔╝██║ ╚███║███████╗██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
   ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚══╝╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ 🎀🌸
  `)
  );
  console.log(
    colors.info("  🎀 Adorable AI-Powered Website Cloner Agent 🌸")
  );
  console.log(
    colors.dim(
      "  Built with Gemini AI • gemma-4-26b-a4b-it"
    )
  );
}

/**
 * Log a thinking/reasoning step.
 */
export function logThinking(message) {
  console.log(colors.thinking(`  💭 [Thinking] ${message} 🎀`));
}

/**
 * Log an action being taken.
 */
export function logAction(message) {
  console.log(colors.action(`  ✨ [Action]   ${message} 🌸`));
}

/**
 * Log a success result.
 */
export function logSuccess(message) {
  console.log(colors.success(`  💖 [Done]     ${message} ✨`));
}

/**
 * Log an error.
 */
export function logError(message) {
  console.log(colors.error(`  🍓 [Error]    ${message} 🐾`));
}

/**
 * Log informational text.
 */
export function logInfo(message) {
  console.log(colors.info(`  🎀 [Info]     ${message} 🐾`));
}

/**
 * Log an improvement iteration step.
 */
export function logImprove(iteration, total, message) {
  console.log(
    colors.highlight(`  🌷 [Improve ${iteration}/${total}] ${message} 🎀`)
  );
}

/**
 * Log a separator line.
 */
export function logSeparator() {
  console.log(
    colors.dim("\n  🎀 🌸 ✨ 💖 🍓 🐾 🎀 🌸 ✨ 💖 🍓 🐾 🎀 🌸 ✨ 💖 🍓 🐾 🎀\n")
  );
}

/**
 * Create and start an ora spinner.
 * @param {string} text
 * @returns {ora.Ora}
 */
export function startSpinner(text) {
  return ora({
    text: colors.thinking(text),
    color: "magenta",
    spinner: "hearts",
    indent: 2,
  }).start();
}

/**
 * Stop spinner with success.
 */
export function spinnerSuccess(spinner, text) {
  spinner.succeed(colors.success(text));
}

/**
 * Stop spinner with failure.
 */
export function spinnerFail(spinner, text) {
  spinner.fail(colors.error(text));
}

export { colors };

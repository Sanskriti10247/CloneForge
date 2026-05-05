// ─────────────────────────────────────────────
// src/logger.js — Premium CLI logging with chalk + ora
// ─────────────────────────────────────────────

import chalk from "chalk";
import ora from "ora";

// ── Color palette ──
const colors = {
  brand: chalk.hex("#6C5CE7"),       // Purple accent
  thinking: chalk.hex("#74B9FF"),    // Light blue
  action: chalk.hex("#FDCB6E"),      // Warm yellow
  success: chalk.hex("#00B894"),     // Green
  error: chalk.hex("#E17055"),       // Coral red
  info: chalk.hex("#DFE6E9"),       // Light gray
  highlight: chalk.hex("#A29BFE"),   // Soft purple
  dim: chalk.dim,
  bold: chalk.bold,
};

/**
 * Prints the Clonify ASCII banner at startup.
 */
export function printBanner() {
  console.log();
  console.log(
    colors.brand.bold(`
   ██████╗██╗      ██████╗ ███╗   ██╗██╗███████╗██╗   ██╗
  ██╔════╝██║     ██╔═══██╗████╗  ██║██║██╔════╝╚██╗ ██╔╝
  ██║     ██║     ██║   ██║██╔██╗ ██║██║█████╗   ╚████╔╝ 
  ██║     ██║     ██║   ██║██║╚██╗██║██║██╔══╝    ╚██╔╝  
  ╚██████╗███████╗╚██████╔╝██║ ╚████║██║██║        ██║   
   ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝        ╚═╝  
  `)
  );
  console.log(
    colors.dim("  ─────────────────────────────────────────────────")
  );
  console.log(
    colors.info("  🤖 AI-Powered Website Cloner Agent")
  );
  console.log(
    colors.dim(
      "  Built with Gemini AI • gemma-4-26b-a4b-it"
    )
  );
  console.log(
    colors.dim("  ─────────────────────────────────────────────────\n")
  );
}

/**
 * Log a thinking/reasoning step.
 */
export function logThinking(message) {
  console.log(colors.thinking(`  🧠 [Thinking] ${message}`));
}

/**
 * Log an action being taken.
 */
export function logAction(message) {
  console.log(colors.action(`  ⚡ [Action]   ${message}`));
}

/**
 * Log a success result.
 */
export function logSuccess(message) {
  console.log(colors.success(`  ✅ [Done]     ${message}`));
}

/**
 * Log an error.
 */
export function logError(message) {
  console.log(colors.error(`  ❌ [Error]    ${message}`));
}

/**
 * Log informational text.
 */
export function logInfo(message) {
  console.log(colors.info(`  ℹ  [Info]     ${message}`));
}

/**
 * Log an improvement iteration step.
 */
export function logImprove(iteration, total, message) {
  console.log(
    colors.highlight(`  🔁 [Improve ${iteration}/${total}] ${message}`)
  );
}

/**
 * Log a separator line.
 */
export function logSeparator() {
  console.log(
    colors.dim("\n  ─────────────────────────────────────────────────\n")
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
    color: "cyan",
    spinner: "dots12",
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

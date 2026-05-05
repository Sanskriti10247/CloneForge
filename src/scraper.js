// ─────────────────────────────────────────────
// src/scraper.js — Playwright-based website scraper
// Extracts design tokens, content, and structure from any URL
// ─────────────────────────────────────────────

import { chromium } from "playwright";
import {
  logThinking,
  logAction,
  logSuccess,
  logError,
  logInfo,
  startSpinner,
  spinnerSuccess,
  spinnerFail,
} from "./logger.js";

/**
 * Scrape a website and return a structured design brief.
 * Extracts only what the LLM needs — nothing more.
 *
 * @param {string} url - The full URL to scrape
 * @returns {Promise<object>} Structured site data
 */
export async function scrapeWebsite(url) {
  const spinner = startSpinner(`Launching browser for ${url}...`);
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });

    spinnerSuccess(spinner, "Browser launched");

    // ── Navigate ──
    const navSpinner = startSpinner(`Loading ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Give JS-rendered content a moment to settle
    await page.waitForTimeout(2000);
    spinnerSuccess(navSpinner, "Page loaded");

    // ── Extract everything in one page.evaluate call for efficiency ──
    const extractSpinner = startSpinner("Extracting design & content...");

    const siteData = await page.evaluate(() => {
      // --- Helper: get computed style of an element ---
      function getStyle(el) {
        return window.getComputedStyle(el);
      }

      // --- Helper: rgb to hex ---
      function rgbToHex(rgb) {
        if (!rgb || rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") return null;
        const match = rgb.match(/\d+/g);
        if (!match || match.length < 3) return null;
        const [r, g, b] = match.map(Number);
        return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      }

      // ── 1. Meta info ──
      const title = document.title || "";
      const metaDesc =
        document.querySelector('meta[name="description"]')?.content || "";
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.content || "";

      // ── 2. Color extraction (sample key elements) ──
      const colorBag = new Set();
      const bgBag = new Set();

      const sampleEls = document.querySelectorAll(
        "header, nav, footer, section, .hero, [class*=hero], [class*=banner], h1, h2, h3, a, button, [class*=btn], [class*=cta]"
      );
      sampleEls.forEach((el) => {
        const s = getStyle(el);
        const c = rgbToHex(s.color);
        const bg = rgbToHex(s.backgroundColor);
        if (c) colorBag.add(c);
        if (bg) bgBag.add(bg);
      });

      // Also sample body
      const bodyStyle = getStyle(document.body);
      const bodyBg = rgbToHex(bodyStyle.backgroundColor);
      const bodyColor = rgbToHex(bodyStyle.color);

      // ── 3. Font families ──
      const fontBag = new Set();
      [document.body, ...document.querySelectorAll("h1,h2,h3,p,a,button,nav")].forEach((el) => {
        if (el) {
          const font = getStyle(el).fontFamily.split(",")[0].replace(/['"]/g, "").trim();
          if (font) fontBag.add(font);
        }
      });

      // ── 4. Navigation links ──
      const navLinks = [];
      const navEl = document.querySelector("nav, header nav, [class*=nav], [role=navigation]");
      if (navEl) {
        navEl.querySelectorAll("a").forEach((a) => {
          const text = a.textContent.trim();
          if (text && text.length < 40 && !text.includes("\n")) {
            navLinks.push(text);
          }
        });
      }

      // ── 5. Logo ──
      let logoText = "";
      const logoEl = document.querySelector(
        "[class*=logo], header a:first-child, [class*=brand], nav a:first-child"
      );
      if (logoEl) {
        logoText = logoEl.textContent.trim().split("\n")[0].trim();
        if (logoText.length > 30) logoText = logoText.substring(0, 30);
      }

      // ── 6. Sections — extract structure + content ──
      const sections = [];

      // Helper to get clean text, truncated
      function cleanText(el, maxLen = 300) {
        const text = el?.textContent?.replace(/\s+/g, " ").trim() || "";
        return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
      }

      // Get hero / first big section
      const heroEl = document.querySelector(
        "[class*=hero], [class*=banner], [class*=jumbotron], main > section:first-child, main > div:first-child"
      );
      if (heroEl) {
        const h1 = heroEl.querySelector("h1, h2");
        const subtitle = heroEl.querySelector("p");
        const buttons = [...heroEl.querySelectorAll("a, button")]
          .map((b) => b.textContent.trim())
          .filter((t) => t.length > 1 && t.length < 50)
          .slice(0, 4);
        const bgColor = rgbToHex(getStyle(heroEl).backgroundColor);

        sections.push({
          type: "hero",
          heading: h1?.textContent?.trim() || "",
          subtitle: subtitle?.textContent?.trim()?.substring(0, 200) || "",
          buttons,
          bgColor,
        });
      }

      // Iterate major content sections
      const allSections = document.querySelectorAll(
        "main > section, main > div, body > section, body > div:not([id=app]):not(header):not(footer)"
      );
      let sectionCount = 0;

      allSections.forEach((sec) => {
        if (sectionCount >= 8) return; // cap to keep data small
        const rect = sec.getBoundingClientRect();
        if (rect.height < 100) return; // skip tiny sections

        const heading = sec.querySelector("h2, h3")?.textContent?.trim() || "";
        if (!heading) return;

        const cards = sec.querySelectorAll("[class*=card], [class*=item], [class*=feature], [class*=col]");
        const cardTexts = [...cards]
          .slice(0, 4)
          .map((c) => {
            const cardH = c.querySelector("h3, h4, h5, strong")?.textContent?.trim() || "";
            const cardP = c.querySelector("p")?.textContent?.trim()?.substring(0, 120) || "";
            return { title: cardH, desc: cardP };
          })
          .filter((c) => c.title);

        const bgColor = rgbToHex(getStyle(sec).backgroundColor);

        sections.push({
          type: "content",
          heading: heading.substring(0, 100),
          text: cleanText(sec, 200),
          cards: cardTexts,
          bgColor,
        });
        sectionCount++;
      });

      // ── 7. Footer ──
      const footerEl = document.querySelector("footer, [class*=footer]");
      let footerData = null;
      if (footerEl) {
        const columns = [];
        const headings = footerEl.querySelectorAll("h3, h4, h5, strong, [class*=title]");
        headings.forEach((h) => {
          const links = [];
          let sibling = h.nextElementSibling;
          if (sibling) {
            sibling.querySelectorAll("a").forEach((a) => {
              const t = a.textContent.trim();
              if (t && t.length < 50) links.push(t);
            });
          }
          columns.push({ heading: h.textContent.trim(), links: links.slice(0, 8) });
        });

        const copyright = footerEl.textContent.match(/©[^.]+\.?/)?.[0] || "";
        const bgColor = rgbToHex(getStyle(footerEl).backgroundColor);

        footerData = { columns: columns.slice(0, 6), copyright, bgColor };
      }

      // ── 8. Button styles (sample first prominent button) ──
      const btnEl = document.querySelector(
        "button, [class*=btn], [class*=cta], a[class*=button]"
      );
      let buttonStyle = {};
      if (btnEl) {
        const s = getStyle(btnEl);
        buttonStyle = {
          bgColor: rgbToHex(s.backgroundColor),
          textColor: rgbToHex(s.color),
          borderRadius: s.borderRadius,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          textTransform: s.textTransform,
          padding: s.padding,
        };
      }

      return {
        title,
        metaDesc,
        ogImage,
        logoText,
        navLinks: [...new Set(navLinks)].slice(0, 8),
        colors: {
          bodyBg,
          bodyColor,
          textColors: [...colorBag].slice(0, 8),
          bgColors: [...bgBag].slice(0, 8),
        },
        fonts: [...fontBag].slice(0, 4),
        buttonStyle,
        sections,
        footer: footerData,
      };
    });

    spinnerSuccess(extractSpinner, `Extracted ${siteData.sections.length} sections, ${siteData.colors.bgColors.length} colors, ${siteData.fonts.length} fonts`);

    logAction("Scrape details:");
    logInfo(`Title: ${siteData.title || "(empty)"}`);
    logInfo(`Meta description: ${siteData.metaDesc || "(none)"}`);
    logInfo(`OG image: ${siteData.ogImage || "(none)"}`);
    logInfo(`Logo text: ${siteData.logoText || "(none)"}`);
    logInfo(`Nav links: ${siteData.navLinks.length ? siteData.navLinks.join(", ") : "(none)"}`);
    logInfo(`Fonts: ${siteData.fonts.length ? siteData.fonts.join(", ") : "(none)"}`);
    logInfo(
      `Colors: bodyBg=${siteData.colors.bodyBg || "(none)"}, bodyText=${
        siteData.colors.bodyColor || "(none)"
      }, bg=[${siteData.colors.bgColors.join(", ") || "(none)"}], text=[${
        siteData.colors.textColors.join(", ") || "(none)"
      }]`
    );
    logInfo(
      `Primary button: bg=${siteData.buttonStyle?.bgColor || "(none)"}, text=${
        siteData.buttonStyle?.textColor || "(none)"
      }, radius=${siteData.buttonStyle?.borderRadius || "(none)"}`
    );
    logInfo(
      `Sections (${siteData.sections.length}): ${siteData.sections
        .map((sec) => sec.heading)
        .filter(Boolean)
        .join(" | ") || "(none)"}`
    );
    logInfo(
      `Footer columns: ${siteData.footer?.columns?.length ?? 0}`
    );

    logAction("Scraped sections detail:");
    if (!siteData.sections.length) {
      logInfo("(none)");
    } else {
      siteData.sections.forEach((sec, i) => {
        const detailParts = [];
        if (sec.subtitle) detailParts.push(`subtitle="${sec.subtitle}"`);
        if (sec.buttons?.length) detailParts.push(`buttons=[${sec.buttons.join(", ")}]`);
        if (sec.bgColor) detailParts.push(`bg=${sec.bgColor}`);
        if (sec.cards?.length) {
          const cards = sec.cards
            .map((c) => `${c.title}${c.desc ? `: ${c.desc}` : ""}`)
            .join(" | ");
          detailParts.push(`cards=${cards}`);
        }

        logInfo(
          `#${i + 1} ${sec.type} — "${sec.heading || "(no heading)"}"${
            detailParts.length ? " | " + detailParts.join(" | ") : ""
          }`
        );
      });
    }

    if (siteData.footer?.columns?.length) {
      logAction("Scraped footer columns detail:");
      siteData.footer.columns.forEach((col, i) => {
        const links = col.links?.length ? col.links.join(", ") : "(no links)";
        logInfo(`#${i + 1} ${col.heading || "(no heading)"}: ${links}`);
      });
    }

    await browser.close();
    return { url, ...siteData };
  } catch (err) {
    spinnerFail(spinner, `Scrape failed: ${err.message}`);
    if (browser) await browser.close();
    throw err;
  }
}

/**
 * Format scraped data into a compact design brief string for LLM prompts.
 * Keeps it lean — only what the LLM needs to replicate the design.
 *
 * @param {object} siteData - Output from scrapeWebsite()
 * @returns {string}
 */
export function formatDesignBrief(siteData) {
  const lines = [];

  lines.push(`WEBSITE TO CLONE: ${siteData.url}`);
  lines.push(`PAGE TITLE: ${siteData.title}`);
  if (siteData.metaDesc) lines.push(`DESCRIPTION: ${siteData.metaDesc}`);
  lines.push("");

  // Colors
  lines.push("COLOR PALETTE DETECTED:");
  if (siteData.colors.bodyBg) lines.push(`  Body background: ${siteData.colors.bodyBg}`);
  if (siteData.colors.bodyColor) lines.push(`  Body text: ${siteData.colors.bodyColor}`);
  if (siteData.colors.bgColors.length) lines.push(`  Background colors: ${siteData.colors.bgColors.join(", ")}`);
  if (siteData.colors.textColors.length) lines.push(`  Text colors: ${siteData.colors.textColors.join(", ")}`);
  lines.push("");

  // Fonts
  if (siteData.fonts.length) {
    lines.push(`FONTS: ${siteData.fonts.join(", ")}`);
    lines.push("");
  }

  // Button style
  if (siteData.buttonStyle?.bgColor) {
    const b = siteData.buttonStyle;
    lines.push("PRIMARY BUTTON STYLE:");
    lines.push(`  Background: ${b.bgColor}, Text: ${b.textColor}, Border-radius: ${b.borderRadius}`);
    lines.push(`  Font: ${b.fontSize} ${b.fontWeight}, Text-transform: ${b.textTransform}`);
    lines.push("");
  }

  // Logo
  if (siteData.logoText) lines.push(`LOGO TEXT: "${siteData.logoText}"`);

  // Nav
  if (siteData.navLinks.length) {
    lines.push(`NAV LINKS: ${siteData.navLinks.join(" | ")}`);
  }
  lines.push("");

  // Sections
  if (siteData.sections.length) {
    lines.push("PAGE SECTIONS (in order):");
    siteData.sections.forEach((sec, i) => {
      lines.push(`  ${i + 1}. [${sec.type}] "${sec.heading}"`);
      if (sec.subtitle) lines.push(`     Subtitle: "${sec.subtitle}"`);
      if (sec.buttons?.length) lines.push(`     Buttons: ${sec.buttons.join(", ")}`);
      if (sec.bgColor) lines.push(`     Background: ${sec.bgColor}`);
      if (sec.cards?.length) {
        sec.cards.forEach((c) => lines.push(`     Card: "${c.title}" — ${c.desc}`));
      }
    });
    lines.push("");
  }

  // Footer
  if (siteData.footer) {
    lines.push("FOOTER:");
    if (siteData.footer.bgColor) lines.push(`  Background: ${siteData.footer.bgColor}`);
    siteData.footer.columns.forEach((col) => {
      lines.push(`  Column "${col.heading}": ${col.links.join(", ")}`);
    });
    if (siteData.footer.copyright) lines.push(`  Copyright: ${siteData.footer.copyright}`);
  }

  return lines.join("\n");
}

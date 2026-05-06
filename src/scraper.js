// ─────────────────────────────────────────────
// src/scraper.js — Enhanced Playwright-based website scraper
// Extracts rich design tokens, content, layout, and structure
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
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    spinnerSuccess(spinner, "Browser launched");

    const navSpinner = startSpinner(`Loading ${url}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);
    spinnerSuccess(navSpinner, "Page loaded");

    const extractSpinner = startSpinner("Extracting design & content...");

    const siteData = await page.evaluate(() => {
      function getStyle(el) { return window.getComputedStyle(el); }

      function rgbToHex(rgb) {
        if (!rgb || rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") return null;
        const match = rgb.match(/\d+/g);
        if (!match || match.length < 3) return null;
        const [r, g, b] = match.map(Number);
        return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      }

      function cleanText(el, maxLen = 400) {
        const text = el?.textContent?.replace(/\s+/g, " ").trim() || "";
        return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
      }

      // ── 1. Meta info ──
      const title = document.title || "";
      const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || "";
      const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.href || "";
      const themeColor = document.querySelector('meta[name="theme-color"]')?.content || "";

      // ── 2. CSS Custom Properties ──
      const cssVars = {};
      try {
        const rootStyles = getComputedStyle(document.documentElement);
        const sheets = [...document.styleSheets];
        for (const sheet of sheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText === ":root" || rule.selectorText === "html") {
                for (let i = 0; i < rule.style.length; i++) {
                  const prop = rule.style[i];
                  if (prop.startsWith("--")) {
                    cssVars[prop] = rule.style.getPropertyValue(prop).trim();
                  }
                }
              }
            }
          } catch(e) { /* cross-origin sheets */ }
        }
      } catch(e) {}

      // ── 3. Color extraction (comprehensive) ──
      const colorBag = new Set();
      const bgBag = new Set();
      const gradientBag = new Set();
      const borderColorBag = new Set();

      const sampleEls = document.querySelectorAll(
        "header, nav, footer, section, .hero, [class*=hero], [class*=banner], h1, h2, h3, h4, a, button, [class*=btn], [class*=cta], [class*=card], [class*=feature], main, aside, [class*=pricing], [class*=testimonial]"
      );
      sampleEls.forEach((el) => {
        const s = getStyle(el);
        const c = rgbToHex(s.color);
        const bg = rgbToHex(s.backgroundColor);
        const bc = rgbToHex(s.borderColor);
        if (c) colorBag.add(c);
        if (bg) bgBag.add(bg);
        if (bc && bc !== "#000000") borderColorBag.add(bc);
        const bgImage = s.backgroundImage;
        if (bgImage && bgImage !== "none" && bgImage.includes("gradient")) {
          gradientBag.add(bgImage.substring(0, 200));
        }
      });

      const bodyStyle = getStyle(document.body);
      const bodyBg = rgbToHex(bodyStyle.backgroundColor);
      const bodyColor = rgbToHex(bodyStyle.color);

      // ── 4. Font families + typography details ──
      const fontBag = new Set();
      const typographyMap = {};
      const typoEls = { h1: "h1", h2: "h2", h3: "h3", h4: "h4", p: "p", a: "a", button: "button" };
      for (const [tag, selector] of Object.entries(typoEls)) {
        const el = document.querySelector(selector);
        if (el) {
          const s = getStyle(el);
          const font = s.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
          if (font) fontBag.add(font);
          typographyMap[tag] = {
            fontFamily: font,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            letterSpacing: s.letterSpacing,
            textTransform: s.textTransform,
            color: rgbToHex(s.color),
          };
        }
      }
      // Body font
      const bodyFont = bodyStyle.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
      if (bodyFont) fontBag.add(bodyFont);

      // ── 5. Navigation ──
      const navLinks = [];
      const navEl = document.querySelector("nav, header nav, [class*=nav], [role=navigation]");
      if (navEl) {
        navEl.querySelectorAll("a").forEach((a) => {
          const text = a.textContent.trim();
          const href = a.getAttribute("href") || "";
          if (text && text.length < 40 && !text.includes("\n")) {
            navLinks.push({ text, href });
          }
        });
      }

      // ── 6. Logo ──
      let logoText = "";
      let logoImgSrc = "";
      const logoEl = document.querySelector(
        "[class*=logo], header a:first-child, [class*=brand], nav a:first-child"
      );
      if (logoEl) {
        logoText = logoEl.textContent.trim().split("\n")[0].trim();
        if (logoText.length > 30) logoText = logoText.substring(0, 30);
        const logoImg = logoEl.querySelector("img") || (logoEl.tagName === "IMG" ? logoEl : null);
        if (logoImg) logoImgSrc = logoImg.src || "";
      }

      // ── 7. Images on the page ──
      const images = [];
      document.querySelectorAll("img").forEach((img) => {
        const src = img.src || img.dataset?.src || "";
        const alt = img.alt || "";
        const rect = img.getBoundingClientRect();
        if (src && rect.width > 50 && rect.height > 50) {
          images.push({ src: src.substring(0, 200), alt, width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      });

      // ── 8. Hero section (deep extraction) ──
      const heroEl = document.querySelector(
        "[class*=hero], [class*=banner], [class*=jumbotron], main > section:first-child, main > div:first-child"
      );
      let heroData = null;
      if (heroEl) {
        const s = getStyle(heroEl);
        const h1 = heroEl.querySelector("h1, h2");
        const subtitle = heroEl.querySelector("p");
        const buttons = [...heroEl.querySelectorAll("a, button")]
          .map((b) => ({ text: b.textContent.trim(), href: b.getAttribute("href") || "" }))
          .filter((t) => t.text.length > 1 && t.text.length < 50)
          .slice(0, 4);
        const heroImg = heroEl.querySelector("img");

        heroData = {
          type: "hero",
          heading: h1?.textContent?.trim() || "",
          subtitle: subtitle?.textContent?.trim()?.substring(0, 300) || "",
          buttons,
          bgColor: rgbToHex(s.backgroundColor),
          bgImage: s.backgroundImage !== "none" ? s.backgroundImage.substring(0, 200) : null,
          textAlign: s.textAlign,
          minHeight: s.minHeight,
          padding: s.padding,
          image: heroImg ? { src: heroImg.src?.substring(0, 200), alt: heroImg.alt } : null,
        };
      }

      // ── 9. All content sections ──
      const sections = [];
      if (heroData) sections.push(heroData);

      const allSections = document.querySelectorAll(
        "main > section, main > div, body > section, body > div:not([id=app]):not(header):not(footer), [class*=section]"
      );
      let sectionCount = 0;

      allSections.forEach((sec) => {
        if (sectionCount >= 12) return;
        const rect = sec.getBoundingClientRect();
        if (rect.height < 80) return;

        const s = getStyle(sec);
        const heading = sec.querySelector("h2, h3")?.textContent?.trim() || "";
        const subheading = sec.querySelector("h2 + p, h3 + p, [class*=subtitle], [class*=description]")?.textContent?.trim()?.substring(0, 200) || "";

        const cards = sec.querySelectorAll("[class*=card], [class*=item], [class*=feature], [class*=col], [class*=benefit], [class*=service]");
        const cardTexts = [...cards]
          .slice(0, 6)
          .map((c) => {
            const cs = getStyle(c);
            const cardH = c.querySelector("h3, h4, h5, strong, [class*=title]")?.textContent?.trim() || "";
            const cardP = c.querySelector("p, [class*=desc]")?.textContent?.trim()?.substring(0, 150) || "";
            const cardIcon = c.querySelector("svg, [class*=icon], img")?.outerHTML?.substring(0, 100) || "";
            return {
              title: cardH,
              desc: cardP,
              hasIcon: !!cardIcon,
              bgColor: rgbToHex(cs.backgroundColor),
              borderRadius: cs.borderRadius,
              boxShadow: cs.boxShadow !== "none" ? cs.boxShadow.substring(0, 100) : null,
            };
          })
          .filter((c) => c.title || c.desc);

        // Extract any stats/numbers
        const statEls = sec.querySelectorAll("[class*=stat], [class*=number], [class*=count], [class*=metric]");
        const stats = [...statEls].slice(0, 6).map((el) => {
          const num = el.querySelector("h2, h3, strong, [class*=num], [class*=value]")?.textContent?.trim() || el.textContent?.trim() || "";
          const label = el.querySelector("p, span, [class*=label]")?.textContent?.trim() || "";
          return { value: num.substring(0, 30), label: label.substring(0, 60) };
        }).filter(s => s.value);

        const bgColor = rgbToHex(s.backgroundColor);
        const bgImage = s.backgroundImage !== "none" ? s.backgroundImage.substring(0, 200) : null;

        if (heading || cardTexts.length || stats.length) {
          sections.push({
            type: "content",
            heading: heading.substring(0, 120),
            subheading,
            text: cleanText(sec, 300),
            cards: cardTexts,
            stats,
            bgColor,
            bgImage,
            padding: s.padding,
            textAlign: s.textAlign,
          });
          sectionCount++;
        }
      });

      // ── 10. Footer ──
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
              const href = a.getAttribute("href") || "";
              if (t && t.length < 50) links.push({ text: t, href });
            });
          }
          columns.push({ heading: h.textContent.trim(), links: links.slice(0, 10) });
        });

        const socialLinks = [];
        footerEl.querySelectorAll('a[href*="twitter"], a[href*="facebook"], a[href*="linkedin"], a[href*="instagram"], a[href*="youtube"], a[href*="github"], a[href*="x.com"]').forEach((a) => {
          socialLinks.push({ href: a.href, text: a.textContent.trim() || a.getAttribute("aria-label") || "" });
        });

        const copyright = footerEl.textContent.match(/©[^.\n]+\.?/)?.[0] || "";
        const fs = getStyle(footerEl);

        footerData = {
          columns: columns.slice(0, 6),
          socialLinks: socialLinks.slice(0, 8),
          copyright,
          bgColor: rgbToHex(fs.backgroundColor),
          color: rgbToHex(fs.color),
          padding: fs.padding,
        };
      }

      // ── 11. Button styles (sample multiple) ──
      const buttonStyles = [];
      document.querySelectorAll("button, [class*=btn], [class*=cta], a[class*=button]").forEach((btnEl) => {
        if (buttonStyles.length >= 3) return;
        const s = getStyle(btnEl);
        const bg = rgbToHex(s.backgroundColor);
        if (!bg) return;
        buttonStyles.push({
          text: btnEl.textContent.trim().substring(0, 40),
          bgColor: bg,
          textColor: rgbToHex(s.color),
          borderRadius: s.borderRadius,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          textTransform: s.textTransform,
          padding: s.padding,
          border: s.border,
          boxShadow: s.boxShadow !== "none" ? s.boxShadow.substring(0, 80) : null,
        });
      });

      // ── 12. Overall layout info ──
      const headerEl = document.querySelector("header, [class*=header], nav");
      let headerData = null;
      if (headerEl) {
        const hs = getStyle(headerEl);
        headerData = {
          bgColor: rgbToHex(hs.backgroundColor),
          height: hs.height,
          position: hs.position,
          boxShadow: hs.boxShadow !== "none" ? hs.boxShadow.substring(0, 80) : null,
          borderBottom: hs.borderBottom,
        };
      }

      return {
        title,
        metaDesc,
        ogImage,
        favicon,
        themeColor,
        cssVars: Object.keys(cssVars).length > 0 ? cssVars : null,
        logoText,
        logoImgSrc: logoImgSrc.substring(0, 200),
        navLinks: navLinks.slice(0, 10),
        headerStyle: headerData,
        colors: {
          bodyBg,
          bodyColor,
          textColors: [...colorBag].slice(0, 12),
          bgColors: [...bgBag].slice(0, 12),
          borderColors: [...borderColorBag].slice(0, 6),
          gradients: [...gradientBag].slice(0, 4),
        },
        fonts: [...fontBag].slice(0, 5),
        typography: typographyMap,
        buttonStyles,
        images: images.slice(0, 10),
        sections,
        footer: footerData,
      };
    });

    spinnerSuccess(extractSpinner, `Extracted ${siteData.sections.length} sections, ${siteData.colors.bgColors.length} bg colors, ${siteData.fonts.length} fonts, ${siteData.images.length} images`);

    // ── Log scraped details ──
    logAction("Scrape summary:");
    logInfo(`Title: ${siteData.title || "(empty)"}`);
    logInfo(`Meta: ${siteData.metaDesc || "(none)"}`);
    logInfo(`Logo: ${siteData.logoText || "(none)"}`);
    logInfo(`Nav links: ${siteData.navLinks.length ? siteData.navLinks.map(l => l.text).join(", ") : "(none)"}`);
    logInfo(`Fonts: ${siteData.fonts.length ? siteData.fonts.join(", ") : "(none)"}`);
    logInfo(`BG Colors: [${siteData.colors.bgColors.join(", ") || "(none)"}]`);
    logInfo(`Text Colors: [${siteData.colors.textColors.join(", ") || "(none)"}]`);
    if (siteData.colors.gradients.length) logInfo(`Gradients: ${siteData.colors.gradients.length} found`);
    logInfo(`Button styles: ${siteData.buttonStyles.length} sampled`);
    logInfo(`Images: ${siteData.images.length} found`);
    logInfo(`Sections (${siteData.sections.length}): ${siteData.sections.map(s => s.heading || s.type).filter(Boolean).join(" | ") || "(none)"}`);
    logInfo(`Footer columns: ${siteData.footer?.columns?.length ?? 0}`);
    if (siteData.cssVars) logInfo(`CSS Variables: ${Object.keys(siteData.cssVars).length} found`);

    // Typography details
    if (Object.keys(siteData.typography).length) {
      logAction("Typography detected:");
      for (const [tag, typo] of Object.entries(siteData.typography)) {
        logInfo(`  ${tag}: ${typo.fontSize} ${typo.fontWeight} ${typo.fontFamily} color=${typo.color || "inherit"}`);
      }
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
 * Format scraped data into a rich design brief string for LLM prompts.
 * @param {object} siteData - Output from scrapeWebsite()
 * @returns {string}
 */
export function formatDesignBrief(siteData) {
  const lines = [];

  lines.push(`WEBSITE TO CLONE: ${siteData.url}`);
  lines.push(`PAGE TITLE: ${siteData.title}`);
  if (siteData.metaDesc) lines.push(`DESCRIPTION: ${siteData.metaDesc}`);
  if (siteData.themeColor) lines.push(`THEME COLOR: ${siteData.themeColor}`);
  lines.push("");

  // CSS Variables
  if (siteData.cssVars && Object.keys(siteData.cssVars).length) {
    lines.push("CSS CUSTOM PROPERTIES (from :root):");
    const vars = Object.entries(siteData.cssVars).slice(0, 20);
    vars.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    lines.push("");
  }

  // Colors
  lines.push("COLOR PALETTE DETECTED:");
  if (siteData.colors.bodyBg) lines.push(`  Body background: ${siteData.colors.bodyBg}`);
  if (siteData.colors.bodyColor) lines.push(`  Body text: ${siteData.colors.bodyColor}`);
  if (siteData.colors.bgColors.length) lines.push(`  Background colors: ${siteData.colors.bgColors.join(", ")}`);
  if (siteData.colors.textColors.length) lines.push(`  Text colors: ${siteData.colors.textColors.join(", ")}`);
  if (siteData.colors.borderColors.length) lines.push(`  Border colors: ${siteData.colors.borderColors.join(", ")}`);
  if (siteData.colors.gradients.length) {
    lines.push("  Gradients:");
    siteData.colors.gradients.forEach(g => lines.push(`    ${g}`));
  }
  lines.push("");

  // Typography
  if (siteData.fonts.length) {
    lines.push(`FONTS: ${siteData.fonts.join(", ")}`);
  }
  if (siteData.typography && Object.keys(siteData.typography).length) {
    lines.push("TYPOGRAPHY DETAILS:");
    for (const [tag, t] of Object.entries(siteData.typography)) {
      lines.push(`  ${tag}: font-size=${t.fontSize}, font-weight=${t.fontWeight}, line-height=${t.lineHeight}, letter-spacing=${t.letterSpacing}, text-transform=${t.textTransform}, color=${t.color || "inherit"}`);
    }
  }
  lines.push("");

  // Header
  if (siteData.headerStyle) {
    lines.push("HEADER STYLE:");
    const h = siteData.headerStyle;
    lines.push(`  Background: ${h.bgColor || "transparent"}, Height: ${h.height}, Position: ${h.position}`);
    if (h.boxShadow) lines.push(`  Box-shadow: ${h.boxShadow}`);
    lines.push("");
  }

  // Buttons
  if (siteData.buttonStyles.length) {
    lines.push("BUTTON STYLES:");
    siteData.buttonStyles.forEach((b, i) => {
      lines.push(`  Button ${i + 1} ("${b.text}"): bg=${b.bgColor}, text=${b.textColor}, radius=${b.borderRadius}, padding=${b.padding}, font=${b.fontSize} ${b.fontWeight}, transform=${b.textTransform}`);
      if (b.boxShadow) lines.push(`    shadow: ${b.boxShadow}`);
    });
    lines.push("");
  }

  // Logo
  if (siteData.logoText) lines.push(`LOGO TEXT: "${siteData.logoText}"`);

  // Nav
  if (siteData.navLinks.length) {
    lines.push(`NAV LINKS: ${siteData.navLinks.map(l => l.text).join(" | ")}`);
  }
  lines.push("");

  // Sections
  if (siteData.sections.length) {
    lines.push("PAGE SECTIONS (in order):");
    siteData.sections.forEach((sec, i) => {
      lines.push(`  ${i + 1}. [${sec.type}] "${sec.heading}"`);
      if (sec.subheading) lines.push(`     Subheading: "${sec.subheading}"`);
      if (sec.subtitle) lines.push(`     Subtitle: "${sec.subtitle}"`);
      if (sec.buttons?.length) lines.push(`     Buttons: ${sec.buttons.map(b => `"${b.text}"`).join(", ")}`);
      if (sec.bgColor) lines.push(`     Background: ${sec.bgColor}`);
      if (sec.bgImage) lines.push(`     BG Image/Gradient: ${sec.bgImage}`);
      if (sec.image) lines.push(`     Hero image: alt="${sec.image.alt}"`);
      if (sec.stats?.length) {
        lines.push(`     Stats: ${sec.stats.map(s => `${s.value} (${s.label})`).join(", ")}`);
      }
      if (sec.cards?.length) {
        sec.cards.forEach((c) => {
          lines.push(`     Card: "${c.title}" — ${c.desc}${c.hasIcon ? " [has icon]" : ""}`);
          if (c.borderRadius && c.borderRadius !== "0px") lines.push(`       radius=${c.borderRadius}, shadow=${c.boxShadow || "none"}`);
        });
      }
    });
    lines.push("");
  }

  // Footer
  if (siteData.footer) {
    lines.push("FOOTER:");
    if (siteData.footer.bgColor) lines.push(`  Background: ${siteData.footer.bgColor}`);
    if (siteData.footer.color) lines.push(`  Text color: ${siteData.footer.color}`);
    siteData.footer.columns.forEach((col) => {
      lines.push(`  Column "${col.heading}": ${col.links.map(l => l.text).join(", ")}`);
    });
    if (siteData.footer.socialLinks?.length) {
      lines.push(`  Social links: ${siteData.footer.socialLinks.map(s => s.text || s.href).join(", ")}`);
    }
    if (siteData.footer.copyright) lines.push(`  Copyright: ${siteData.footer.copyright}`);
  }

  return lines.join("\n");
}

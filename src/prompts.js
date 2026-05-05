// ─────────────────────────────────────────────
// src/prompts.js — Dynamic LLM prompt templates
// Works with ANY website via scraped design briefs
// ─────────────────────────────────────────────

/**
 * Build a design system string from a scraped design brief.
 * Falls back to sensible defaults if no brief provided.
 *
 * @param {string|null} designBrief - Formatted brief from scraper, or null
 * @returns {string}
 */
function buildDesignRules(designBrief) {
  if (designBrief) {
    return `
SCRAPED DESIGN REFERENCE (from the actual target website):
${designBrief}

DESIGN RULES:
- Replicate the color palette, fonts, and button styles detected above as closely as possible
- Match the layout structure and section ordering from the scraped data
- Use the exact heading text, nav links, and button labels from the scraped content
- Replicate the button style (border-radius, text-transform, colors) exactly as detected
- Use flexbox and CSS grid for layouts
- Sections: generous padding (60-80px vertical, 80-120px horizontal on desktop)
- Add smooth transitions (transition: all 0.3s ease) on interactive elements
- Add hover effects on buttons, links, and cards
- Make it fully responsive with media queries for tablet (768px) and mobile (480px)
- NO placeholder images — use CSS gradients, Unicode symbols, or inline SVG instead
- Import the detected fonts from Google Fonts (if available), fallback to 'Inter', sans-serif
`;
  }

  // No scrape data — generic high-quality defaults
  return `
DESIGN RULES (use modern premium web design):
- Font: 'Inter', sans-serif (import from Google Fonts, weights 400, 500, 600, 700)
- Colors: dark navy #0d121f, primary blue #0052cc, white #ffffff, light gray #f5f7fa, text #2d3436
- Buttons: clean style, consistent padding (14px 32px), hover effects
- Layout: flexbox/grid, max-width 1200px centered, generous padding (60-80px sections)
- Typography: bold headings (600-700), body 16px, line-height 1.6
- Transitions: all 0.3s ease on interactive elements
- Responsive: media queries for 768px and 480px breakpoints
- NO placeholder images — use CSS gradients, Unicode symbols, or SVG instead
`;
}

/**
 * Generate the plan for cloning a website.
 * @param {string} userInstruction
 * @param {string|null} designBrief
 */
export function planPrompt(userInstruction, designBrief = null) {
  const siteContext = designBrief
    ? `\n\nHere is the scraped design brief from the target website:\n${designBrief}\n\nUse the section headings detected above to decide what to build.`
    : "";

  return `You are an AI web development agent. The user wants you to clone a website.

User instruction: "${userInstruction}"
${siteContext}

Your task: List the sections to build for this website clone.
Every website MUST include at minimum:
1. Header — navigation bar with logo and links
2. Hero — main banner/hero section with headline and CTAs
3. Footer — site footer with links and copyright

Based on the user instruction${designBrief ? " and scraped data" : ""}, output a JSON array of section names (lowercase, single-word identifiers).

Examples: ["header", "hero", "features", "testimonials", "footer"]

Rules:
- Always include "header" first and "footer" last
- Keep to 4-6 sections total
- Use generic names: header, hero, features, companies, stats, testimonials, programs, pricing, cta, footer

Output ONLY the JSON array, nothing else.`;
}

/**
 * Generate HTML+CSS for a specific section.
 * @param {string} sectionName
 * @param {string[]} allSections
 * @param {string|null} designBrief
 */
export function generateSectionPrompt(sectionName, allSections, designBrief = null) {
  return `You are an expert frontend developer cloning a website.

Generate the HTML and embedded CSS for the "${sectionName}" section.

All sections being built: ${JSON.stringify(allSections)}

${buildDesignRules(designBrief)}

SECTION GUIDELINES FOR "${sectionName.toUpperCase()}":
${getSectionGuidelines(sectionName)}

OUTPUT FORMAT:
Return ONLY raw HTML for this section (a single wrapper <div>, <section>, <header>, <nav>, or <footer>).
Include a <style> tag at the TOP with all CSS for this section.
Use class names prefixed with "s-${sectionName}-" to avoid conflicts.
Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
Do NOT include any markdown formatting, explanation, or commentary.
Output ONLY the HTML+CSS code.`;
}

/**
 * Evaluate the quality of generated section code.
 * @param {string} sectionName
 * @param {string} code
 * @param {string|null} designBrief
 */
export function evaluatePrompt(sectionName, code, designBrief = null) {
  const referenceNote = designBrief
    ? `\nThe clone should match this design reference:\n${designBrief.substring(0, 800)}\n`
    : "";

  return `You are a senior frontend reviewer evaluating a "${sectionName}" section of a cloned website.
${referenceNote}
Here is the current code:
\`\`\`html
${code}
\`\`\`

Evaluate on these criteria (total score out of 10):
1. Visual Quality — Modern, premium, and matching the target design?
2. Layout — Proper flexbox/grid, spacing, alignment?
3. Typography — Professional font hierarchy, correct sizes?
4. Colors — Matches the target color palette?
5. Content — Uses realistic, relevant text (not lorem ipsum)?
6. Responsiveness — Has media queries for mobile/tablet?
7. Interactivity — Hover effects, transitions, animations?

Be strict but fair. Score 7+ only if it genuinely looks professional.

Output ONLY valid JSON: {"score": <number>, "improvements": ["improvement 1", "improvement 2", ...]}
Output ONLY the JSON, nothing else.`;
}

/**
 * Improve a section based on evaluation feedback.
 * @param {string} sectionName
 * @param {string} code
 * @param {string[]} improvements
 * @param {string|null} designBrief
 */
export function improvePrompt(sectionName, code, improvements, designBrief = null) {
  return `You are an expert frontend developer improving a "${sectionName}" section of a cloned website.

Current code:
\`\`\`html
${code}
\`\`\`

Required improvements:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join("\n")}

${buildDesignRules(designBrief)}

Apply ALL improvements. Make it look premium, polished, and professional.

OUTPUT FORMAT:
Return the COMPLETE improved HTML+CSS for this section.
Include a <style> tag at the TOP with all CSS.
Use class names prefixed with "s-${sectionName}-" to avoid conflicts.
Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
Do NOT include any markdown formatting or explanation.
Output ONLY the improved HTML+CSS code.`;
}

/**
 * Generate JavaScript for the page.
 * @param {string[]} allSections
 */
export function generateScriptPrompt(allSections) {
  return `You are a frontend developer adding interactivity to a cloned website.

The page has these sections: ${JSON.stringify(allSections)}

Generate clean vanilla JavaScript that adds:
1. Smooth scroll for anchor links
2. Sticky header — add class "scrolled" to header after scrolling 50px (for shadow/bg transition)
3. Mobile hamburger menu toggle — toggle class "nav-open" on header when hamburger is clicked
4. Scroll reveal — IntersectionObserver to add class "revealed" to .reveal-section elements (threshold: 0.1, rootMargin: "0px 0px -50px 0px")
5. Active nav link highlighting on scroll
6. Scroll-to-top button — show #scrollTopBtn after 500px scroll, smooth scroll to top on click

Keep it concise and well-commented. No frameworks, no libraries.

Output ONLY raw JavaScript code. No markdown fences, no explanation.`;
}

/**
 * Generate the final HTML shell to wrap all sections.
 * @param {object|null} siteData - Scraped site data (for title, description, fonts)
 */
export function assemblePrompt(siteData = null) {
  const title = siteData?.title || "Cloned Website";
  const desc = siteData?.metaDesc || "A cute website clone generated by CloneForge AI agent. 🎀✨";
  const fonts = siteData?.fonts?.length
    ? siteData.fonts.filter(f => !f.includes("system") && !f.includes("inherit")).slice(0, 2)
    : ["Inter"];

  const fontImport = fonts.map(f => f.replace(/\s+/g, "+")).join("&family=");

  return `Generate a minimal HTML5 boilerplate.

Requirements:
1. <!DOCTYPE html>, <html lang="en">, <head>, <body>
2. Import Google Fonts: ${fonts.join(", ")} (weights 400, 500, 600, 700)
   URL: https://fonts.googleapis.com/css2?family=${fontImport}:wght@400;500;600;700&display=swap
3. Title: "${title}"
4. Meta description: "${desc}"
5. Viewport meta tag
6. CSS reset + base styles:
   *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
   html { scroll-behavior: smooth; }
   body { font-family: '${fonts[0]}', sans-serif; color: #333; background: #fff; overflow-x: hidden; line-height: 1.6; }
   a { text-decoration: none; color: inherit; }
   img { max-width: 100%; }
   .reveal-section { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
   .reveal-section.revealed { opacity: 1; transform: translateY(0); }
   #scrollTopBtn { position: fixed; bottom: 30px; right: 30px; width: 48px; height: 48px; background: #0052cc; color: white; border: none; cursor: pointer; font-size: 20px; display: none; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s ease; }
   #scrollTopBtn:hover { transform: translateY(-2px); }
7. <div id="app"><!-- SECTIONS_PLACEHOLDER --></div> inside body
8. <button id="scrollTopBtn" title="Back to top">↑</button> inside body
9. <script src="script.js"></script> before </body>

Output ONLY the complete HTML code. No markdown fences, no explanation.`;
}

// ── Section guidelines (generic — work for any website) ──

function getSectionGuidelines(sectionName) {
  const guidelines = {
    header: `
- Sticky/fixed at top, z-index 1000
- Logo text on the left (use the detected logo text from scraped data, or the site name)
- Navigation links horizontally on the right (use scraped nav links if available)
- CTA button on far right (match detected button style)
- White or light background with subtle bottom shadow
- ~70px height
- Mobile: hamburger menu icon (3 lines via CSS), hide nav links, toggle on click`,

    hero: `
- Full-width, minimum height 80-90vh
- Use the scraped headline text as the main heading (large: 48px+, bold)
- Use the scraped subtitle as the paragraph below
- Include CTA buttons (match detected button text and style)
- Add decorative CSS elements (gradients, shapes) if the target has visual flair
- Center content vertically
- Match the detected background color`,

    features: `
- Section heading (use scraped heading if available)
- 3-4 feature/benefit cards in a grid (2x2 or 4-column)
- Each card: icon (Unicode emoji), title, short description
- Use scraped card content if available
- Cards: white bg, subtle shadow, hover lift effect
- Section bg: match scraped color or use light gray #f5f7fa`,

    companies: `
- Social proof section: heading about companies/partners/clients
- Grid of company name badges (since we can't use images)
- Use well-known tech company names: Google, Microsoft, Amazon, Adobe, Meta, etc.
- Badges: light gray bg, subtle border, clean typography
- Centered layout, generous padding`,

    stats: `
- Big numbers/statistics in a horizontal row
- Each stat: large number (48px+, bold, colored), label below (14px, gray)
- 3-4 stats about results/achievements
- Use scraped stat data if available, otherwise generate plausible ones
- Clean layout, lots of whitespace`,

    testimonials: `
- Section heading about reviews/stories/testimonials
- 2-3 testimonial cards
- Each card: quote text (italic), person name (bold), role/company
- Cards: white bg, subtle border/shadow, rounded corners
- Grid or flex row on desktop, stacked on mobile`,

    programs: `
- Section showing programs/courses/products offered
- Cards or tabs for each program
- Each: title, short description, CTA link
- Use scraped program names if available
- Clean card layout with consistent spacing`,

    pricing: `
- 2-3 pricing tier cards
- Each: tier name, price, feature list, CTA button
- Highlight one tier as "recommended"
- Cards: distinct visual hierarchy`,

    cta: `
- Full-width call-to-action banner
- Large heading, motivating text
- Prominent CTA button centered
- Dark or gradient background for contrast`,

    footer: `
- Dark background (use detected footer bg color, or #0d121f)
- Multi-column layout with link groups (use scraped footer columns if available)
- Column headings: white, uppercase, small, letter-spaced
- Links: gray color, hover to lighter/brand color
- Copyright bar at bottom with separator line
- Proper padding: 60px+ vertical
- Use actual scraped footer content when available`,
  };

  return guidelines[sectionName] || `
- Create a clean, professional "${sectionName}" section
- Match the overall design palette and typography
- Use proper spacing and responsive layout
- Add hover effects and transitions`;
}

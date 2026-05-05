# 🎀 CloneForge — AI Website Cloner Agent 🌸

A conversational CLI agent that can **scrape and clone any website** using Playwright + Gemini AI. Give it a URL, and it will analyze the design, extract content, and generate a faithful HTML/CSS/JS clone.

> Think of it like Cursor or Windsurf, but for cloning websites directly from your terminal.

---

## ✨ Features

- **🌐 Scrape Any Website** — Uses Playwright to extract colors, fonts, layout, content, and structure from any URL
- **🧠 Intelligent Planning** — Analyzes scraped data to plan which sections to build
- **🧱 Step-by-Step Generation** — Each section (Header, Hero, Footer, etc.) is generated individually
- **🔁 Self-Improving Agent Loop** — Each section goes through evaluate → improve cycles until quality ≥ 7/10
- **🎨 Faithful Design Cloning** — Replicates the exact color palette, fonts, button styles, and layout of the target
- **💬 Conversational CLI** — Interactive terminal with colored logs, spinners, and real-time progress
- **🚀 Auto-Open** — Generated website opens automatically in your browser

## 📋 Prerequisites

- **Node.js** v18+
- **Gemini API Key** — Get one from [Google AI Studio](https://aistudio.google.com/apikey)

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Sanskriti10247/CloneForge.git
cd CloneForge
```

### 2. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Configure your API key

Edit the `.env` file and paste your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Run the agent

```bash
npm start
```

### 5. Clone any website!

```
🎀 cloneForge > clone https://www.scaler.com
🎀 cloneForge > clone https://stripe.com
🎀 cloneForge > build a SaaS landing page
```

The agent will:
1. 🌐 **Scrape** the target website (colors, fonts, content, layout)
2. 🧠 **Plan** sections based on scraped structure
3. ⚡ **Generate** each section using scraped design data
4. 🔁 **Evaluate & improve** each section (agent loop)
5. 🔧 **Assemble** the final HTML with JavaScript
6. 🌐 **Open** the result in your browser

---

## 🎮 CLI Commands

| Command | Description |
|---------|-------------|
| `clone <url>` | Scrape and clone any website |
| `<description>` | Build a website from text description |
| `improve <section>` | Re-improve a specific section |
| `open` | Re-open the last generated site |
| `help` | Show available commands |
| `exit` | Quit CloneForge 🎀 |

## 🏗 Architecture

```
cloneForge/
├── index.js              # CLI entry point & interactive prompt
├── src/
│   ├── scraper.js        # Playwright website scraper (design extraction)
│   ├── agent.js          # Core agent (scrape → plan → generate → improve → assemble)
│   ├── llm.js            # Gemini API wrapper (gemma-4-26b-a4b-it)
│   ├── prompts.js        # Dynamic prompt templates (driven by scrape data)
│   ├── fileWriter.js     # File system operations with prettier
│   └── logger.js         # Chalk + Ora CLI logging
├── output/               # Generated website files (auto-created)
│   ├── index.html
│   └── script.js
├── .env                  # Your Gemini API key
├── package.json
└── README.md
```

## 🔁 Agent Loop Flow

```
User Input (URL or description)
    │
    ▼
[Playwright Scrape] ── extract colors, fonts, content, structure
    │
    ▼
[Plan Sections] ── LLM decides what to build based on scraped data
    │
    ▼
┌─── For each section ───┐
│                         │
│  [Generate Section]     │ ← uses scraped design brief
│       │                 │
│       ▼                 │
│  [Evaluate Quality]     │
│       │                 │
│   Score < 7?            │
│    Yes ──► [Improve] ──►│ (loop up to 2x)
│    No  ──► [Accept] ────┘
│                         │
└─────────────────────────┘
    │
    ▼
[Generate JavaScript]
    │
    ▼
[Assemble Final HTML]
    │
    ▼
[Write Files + Open Browser]
```

## 🔍 What the Scraper Extracts

| Data | Details |
|------|---------|
| **Colors** | Body, background, text, and accent colors (as hex) |
| **Fonts** | Font families used across the page |
| **Button Style** | Background, border-radius, text-transform, padding |
| **Navigation** | Logo text, nav link labels |
| **Content** | Section headings, subtitles, card content, button labels |
| **Footer** | Column headings, links, copyright text |
| **Structure** | Section order and types (hero, features, etc.) |

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| AI Model | Gemini API — gemma-4-26b-a4b-it |
| Scraping | Playwright (Chromium headless) |
| CLI UX | chalk (colors) + ora (spinners) |
| File I/O | Node.js fs + prettier |
| Output | Plain HTML + CSS + JS |
| Browser | open (auto-launch) |

## 📝 License

ISC

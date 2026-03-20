# Passdown

**Zero-cost knowledge transfer for military billet turnover.**

Passdown is a web-based knowledge capture and retrieval system designed to solve the institutional memory problem during military personnel rotations. It captures both explicit procedures and tacit institutional knowledge, keeps information current through a verification system, and makes everything searchable.

## Why Passdown?

When service members PCS, their institutional knowledge walks out the door. Continuity binders go stale. Shared drives become digital graveyards. The incoming person spends months rebuilding what the outgoing person spent years learning.

Passdown fixes this by providing:
- **Structured knowledge capture** across 6 categories (processes, decisions, stakeholders, calendar, lessons, issues)
- **Guided interviews** that extract tacit knowledge — the judgment calls, relationships, and unwritten rules that no binder captures
- **Verification tracking** that keeps knowledge current (Guru-inspired green/yellow/red currency indicators)
- **Full-text search** so the incoming person can find answers instantly
- **Zero cost** — runs entirely in the browser, no server, no licenses, no API fees
- **Portable** — works from GitHub Pages, SharePoint, a USB drive, or any file share

## Quick Start

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox)
2. Go to **Settings** → configure your billet info and PCS dates
3. Load a **template** from Export/Import → Templates to get started
4. Start capturing knowledge in each category
5. Complete the **Narrative Interview** for tacit knowledge
6. **Export** your knowledge base before PCS

That's it. No installation, no accounts, no internet required.

## Features

### Knowledge Capture
Six categories designed for military billet turnover:
- **Processes & SOPs** — Step-by-step procedures
- **Decision Log** — Why key decisions were made
- **Stakeholder Map** — Key contacts by billet with relationship context
- **Recurring Calendar** — Annual/quarterly deadlines and events
- **Lessons & Gotchas** — Unwritten rules and institutional wisdom
- **Active Issues** — Open items that need continuity

### Narrative Capture
10 guided interview prompts designed to extract tacit knowledge:
- "What's the hardest part of this job that nobody tells you?"
- "If you could only tell your successor 5 things, what would they be?"
- "How could your successor fail in this job?"

### Verification System
Every knowledge entry has a verification date and expiry:
- 🟢 **Current** — Recently verified
- 🟡 **Expiring** — Due for verification within 30 days
- 🔴 **Stale** — Past due or never verified

### Search
Full-text search across all entries with category and tag filtering.

### Export/Import
- Export your complete knowledge base as a portable JSON file
- Import from another Passdown export (replace or merge)
- Load starter templates for common billet types
- Print-friendly view for offline reference

## Deployment Options

| Method | Best For | How |
|--------|----------|-----|
| **GitHub Pages** | Cross-unit sharing | Fork this repo, enable Pages |
| **SharePoint** | Internal to your command | Upload files to a document library |
| **File Share** | NIPR network access | Copy folder to shared drive |
| **USB Drive** | Air-gapped / disconnected | Copy folder to USB, open index.html |
| **Local** | Personal use | Clone repo, open index.html |

## Data Storage

All data is stored in your browser's localStorage. This means:
- ✅ No server required
- ✅ Works completely offline
- ✅ Data never leaves your machine
- ⚠️ Clearing browser data will delete your entries
- ⚠️ Export regularly as a backup

## OPSEC Guidance

⚠️ **IMPORTANT: Read before using**

- **DO NOT** enter classified information at any level
- **DO NOT** enter Personally Identifiable Information (PII) — use billet titles, not personal names
- **DO NOT** enter specific manning numbers, T/O figures, or readiness data
- **DO** review all entries for OPSEC compliance before sharing or exporting
- **DO** consider aggregation risk — individually unclassified data can create a classified picture when combined
- **DO** have your command OPSEC officer review exports before distribution

This tool is designed for **UNCLASSIFIED** use only.

## Technology

- React 18 + htm (no build step)
- Tailwind CSS
- Vanilla JavaScript ES modules
- localStorage for persistence
- No server, no database, no external dependencies at runtime

## License

MIT License — Free for government and personal use.

## Contributing

Contributions welcome. Please review the OPSEC guidance before submitting content templates.

# Passdown OLF Integration

## Overview

The **Operational Language Framework (OLF)** is HQMC's governance framework for standardizing AI personas and knowledge artifacts across the Marine Corps. OLF defines how billets, mission contexts, and institutional knowledge are represented in machine-readable formats so they can be registered in enterprise catalogs and discovered across commands.

Passdown exports data in an OLF-compliant format, enabling turnover knowledge bases to participate in the enterprise AI ecosystem.

## Category-to-OLF Dimension Mapping

| Passdown Category   | OLF Dimension              | Description                                      |
|---------------------|----------------------------|--------------------------------------------------|
| Billet Profile      | `billet`                   | Role definition, MOS persona schema              |
| Processes & SOPs    | `output_template`          | Standardized operational products and procedures  |
| Decision Log        | `mission_context`          | Operational rationale and institutional judgment  |
| Stakeholder Map     | `audience`                 | Target consumers and coordination points          |
| Recurring Calendar  | `operational_rhythm`       | Mission-driven temporal patterns and deadlines    |
| Lessons & Gotchas   | `institutional_knowledge`  | Tacit knowledge and organizational wisdom         |
| Active Issues       | `operational_continuity`   | Items requiring handover attention                |

## Using the OLF Export

### Generating an Export

From the Passdown application:

1. Navigate to **Export / Import**.
2. Click **Export OLF Format**.
3. The browser downloads `olf-passdown-[billet]-[date].json`.

### Enterprise Registry Integration

The exported JSON artifact can be:

- **Registered** in the enterprise AI registry for billet-level knowledge discovery.
- **Indexed** by command-level search tools to surface institutional knowledge across units.
- **Consumed** by downstream AI agents that need billet context (mission, processes, stakeholders) to generate role-appropriate outputs.
- **Aggregated** with other Passdown exports to build organizational knowledge graphs.

### Consuming an OLF Export

Other units or tools can parse the export using the following structure:

- `persona` -- Billet identity and organizational context.
- `knowledge_domains[]` -- Categorized entries with OLF dimension tags.
- `narrative_knowledge[]` -- Guided interview responses (tacit knowledge).
- `readiness_metrics` -- Quantitative assessment of turnover completeness.
- `compliance_statement` -- Policy alignment and OPSEC review status.

## Compliance Notes

### AI2P (NAVMC 3000.1)

Passdown OLF exports align with:

- **Goal 2 (Competent Workforce)**: Captures and transfers billet-level institutional knowledge.
- **Goal 4 (Governance)**: Standardized, machine-readable format with embedded compliance metadata.

### NAVMC 5239.1

- All AI-generated outputs are labeled advisory.
- Human decision-makers remain responsible for all operational actions.

### DoD Responsible AI Principles

The export embeds compliance markers for: Responsible, Equitable, Traceable, Reliable, Governable.

### OPSEC

- Exports contain billet titles only; no PII or classified data.
- All exports are marked `UNCLASSIFIED` by default.
- OPSEC review is flagged as pending until a reviewer signs off.
- Aggregation review is required before distribution to prevent mosaic-effect intelligence exposure.

## Schema Reference

See `schema.json` in this directory for the full OLF dimension mapping and compliance field definitions.

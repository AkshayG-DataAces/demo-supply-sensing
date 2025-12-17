# Supply Sensing & Risk Prioritization – Full Flow (v1)

## 1. Purpose

This workflow implements a deterministic supply sensing risk engine that:

- Ingests external disruption signals
- Maps them through the client's supply-chain dependency graph
- Attaches inventory and demand exposure
- Computes explainable risk scores
- Produces a Top-N risk brief for planners

The current version focuses on signal → impact → prioritization, not autonomous decision-making.


## 2. Design Principles

### Deterministic first
All joins, scoring, and prioritization are rule-based and auditable.

### Explainability over autonomy
Every risk has drivers and evidence links.

### Separation of concerns
- **Core engine** = deterministic
- **Narrative/LLM** = optional packaging layer
- **Automation** = future phase, gated by humans


## 3. Inputs (Current)

All inputs are CSV-based for demo purposes. In production these map to APIs, data feeds, or internal tables.

### 3.1 External Signals

**signal_events.csv**

| Field | Description |
--|
| `event_id` | Unique event identifier |
| `event_ts` | Event timestamp |
| `event_type` | weather, port, labor, regulatory, etc |
| `country` / `region` / `city` | Location |
| `severity` | 1–5 normalized |
| `headline` | Human-readable summary |
| `source_url` | Evidence link |

### 3.2 Supply Sites

**sites.csv**

| Field | Description |
--|
| `site_id` | Site identifier |
| `supplier_name` | Supplier |
| `site_name` | Facility |
| `country` / `region` | Location |
| `primary_modes` | Transport modes |
| `primary_port` | Port dependency |

### 3.3 Site → Material Dependencies

**material_site_dependencies.csv**

| Field | Description |
--|
| `site_id` | Site |
| `material_id` | Material |
| `material_name` | Name |
| `criticality` | A / B / C |
| `single_source_flag` | Y / N |

### 3.4 Material → Product BOM

**product_material_bom.csv**

| Field | Description |
--|
| `material_id` | Material |
| `product_id` | Product |
| `product_name` | Name |
| `product_family` | Family |
| `material_usage_class` | core / minor |

### 3.5 Product → Market Exposure

**market_exposure.csv**

| Field | Description |
--|
| `product_id` | Product |
| `market` | US / EU / CA |
| `avg_weekly_demand_units` | Demand |
| `priority_tier` | Commercial priority |

### 3.6 Inventory Position

**inventory_position.csv**

| Field | Description |
--|
| `material_id` / `product_id` | Inventory key |
| `market` | Market |
| `on_hand_days` | Days of supply |
| `in_transit_days` | Pipeline |
| `safety_stock_days` | Target |
| `lead_time_days` | Replenishment |
| `next_po_eta_days` | Next arrival |

**Note:** Missing inventory is treated as UNKNOWN, not auto-risk.


## 4. Core Processing Flow (What Actually Runs)

### Step 1 — Ingest & Normalize (DONE)
- Load all CSVs via HTTP
- Aggregate each into a single array
- Merge into one execution state

### Step 2 — Event → Site Relevance (DONE)
Deterministic matching:
- Match by region
- Fallback to country if no region match

This prevents over-matching and noise.

### Step 3 — Site → Material Impact (DONE)
- Use site dependency table
- Pull material criticality and single-source flags

### Step 4 — Material → Product Impact (DONE)
- Expand via BOM
- Retains product family and usage class

### Step 5 — Product → Market Exposure (DONE)
- Attach demand and commercial priority
- Enables ranking of business impact

### Step 6 — Inventory & Timing Context (DONE)
Attach:
- on-hand
- in-transit
- safety stock
- lead time
- next ETA

Derive:
- `coverage_days = on_hand + in_transit`
- `time_to_impact_flag = next_eta > coverage_days`

### Step 7 — Deterministic Risk Scoring (DONE)

Risk score components:

| Factor | Logic |
---|
| Event severity | 1–5 |
| Material criticality | A=4, B=2, C=1 |
| Single source | +3 |
| Below safety | +3 |
| Long lead time | +2 |
| Time-to-impact | +2 |
| Priority tier | +0–2 |
| Demand volume | +0–2 |

Outputs:
- `risk_score`
- `risk_level` (LOW / MEDIUM / HIGH)
- `drivers` (explainable string)

### Step 8 — Risk Classification (DONE)

Adds:
- `risk_type` = CLIMATE / LOGISTICS / LABOR / REGULATORY / OTHER

### Step 9 — Row-Level Output (DONE)

Produces granular rows:
```
event × site × material × product × market
```
Output dataset: risk_rows_detail (event×site×material×product×market)

This table is retained for drill-down.

### Step 10 — Roll-Up / Deduplication (DONE)

Primary decision view is rolled up to:
```
event + site + material
```
Roll-up behavior:
- Keep max `risk_score`
- Aggregate impacted products
- Aggregate impacted markets
- Track worst coverage and any time-to-impact

Output dataset: risk_rollup (event+site+material)

This is the planner/executive view.

### Step 11 — Top-N Risk table (DONE)

Final output:
- Sort by `risk_score`
- Not limited but can if needed
- Generate structured risk brief with:
  - What happened
  - Where
  - Which material
  - Which products/markets
  - Why it matters
  - Evidence link
  - Suggested triage action

Delivered via Slack / Email / UI (connector depends on environment; demo generates the formatted brief payload)


## 5. What This IS (and Is NOT)

### ✅ This IS:
- Supply sensing
- Impact mapping
- Risk prioritization
- Explainable intelligence
- Planner decision support

### ❌ This is NOT (yet):
- Autonomous replanning
- Auto-overrides
- Self-learning optimization
- Closed-loop execution


## 6. Optional Enhancements (Planned, Not Built)

### 6.1 LLM Narrative Layer (Optional)

Use LLM only to:
- Rewrite drivers into human language
- Generate planner summaries

LLM does not:
- change scores
- reorder priorities
- execute actions

### 6.2 Planner Feedback Loop (Future)

- Capture approve / reject / comment per risk
- Store feedback keyed by `rollup_id`
- Use for:
  - sensitivity tuning
  - future recommendation refinement

### 6.3 Watchlist Controls (Future)

- Country / market / product filters
- Severity thresholds
- Always-critical materials

### 6.4 Agentic Extensions (Future)

This becomes "agentic" only when we add:
- **goals** (e.g., avoid stockouts)
- **tool actions** (tickets, scenarios)
- **gated autonomy** with human approval


## 7. Handoff Notes for Dev Team

### What is DONE
- End-to-end sensing → risk brief
- Deterministic scoring
- Clean roll-ups
- Demo-ready outputs

### What to Improve 
- Replace CSVs with parquet files or tables
- Parameterize scoring weights
- Add drill-down UI
- Add feedback persistence
- Add LLM summarization

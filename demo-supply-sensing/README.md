# Supply Sensing Demo

> **A deterministic supply-chain risk sensing engine that traces world events through your supply network and produces explainable, prioritized risk briefs for planners.**

## Executive summary

> We're building a sensing layer that watches for real-world disruptions, checks whether they touch our sourcing footprint, traces the impact through materials and products, and then tells planners which risks are worth looking at and why. The CSVs are just stand-ins for ERP, inventory, and demand data so we can show the logic end-to-end. In production, the same flow would run off live feeds and Firstshift outputs, but the decision always stays with a human.


## Quick Start

### 1. Run n8n

bleubird 

### 2. Place Data Files

All CSV files go in the `data/` directory:
```
demo-supply-sensing/
├── data/
│   ├── signal_events.csv
│   ├── supplier_sites.csv
│   ├── material_site_dependencies.csv
│   ├── product_material_bom.csv
│   ├── market_exposure.csv
│   ├── inventory_position.csv
│   ├── planner_feedback.csv (empty starter)
│   └── risk_watchlist.csv (optional)
└── workflows/
    └── demo-supply-sensing.json
```

### 3. Import Workflow

1. Open n8n 
2. Settings → Import Workflow
3. Select `workflows/demo-supply-sensing.json`

### 4. Update File Paths (if needed)

right now files are in my data-aces github I have added them in here but the first nodes are HTTP - so how would it work.

### 5. Execute the Demo

1. Click **Execute Workflow**
2. Review generated outputs in `data/`
3. Check `risk_results.csv` for prioritized risk briefs
4. Optionally update `planner_feedback.csv` with decisions

---

## How It Works: The Complete Flow

### Step 1: Something Happens in the World

**Example events:**
- Flooding near Sydney
- Port congestion in Melbourne
- Labor strike in Mumbai

In the demo, this is a row in `signal_events.csv`.  
In production, it would be a weather alert, port delay feed, or news event.

**Important:** At this step, we are NOT deciding anything. We are just saying: "Something happened here."


### Step 2: Is This Relevant to Us?

**Question:** "Do we source anything from there?"

We check `supplier_sites.csv`:
- If we have a supplier site in **AU-NSW**, the event is relevant.
- If we don't, we ignore it.

**This is how we avoid "watching everything"**


### Step 3: If a Site Is Hit, What Does It Make?

**Question:** "If this site has trouble, what breaks?"

We answer using `material_site_dependencies.csv`:

**Example:**
- Sydney site → makes **API Alpha**

**Still no scoring. Just mapping.**

---

### Step 4: If That Material Is Late, What Products Are Affected?

**Question:** "What products need that material?"

We answer using `product_material_bom.csv`:

**Example:**
- API Alpha → **DermAway 50mg** and **100mg**

**Again: still no AI, no magic. Just joins.**

---

### Step 5: If Those Products Are Affected, Where Do We Sell Them?

**Question:** "Which markets care?"

We answer using `market_exposure.csv`:

**Example:**
- DermAway → **US** and **EU** markets

**Now we finally understand business impact.**

---

### Step 6: Is This Actually a Problem Right Now?

**Question:** "Do we have enough inventory to ride this out?"

We answer using `inventory_position.csv`:

We check:
- How many days of inventory we have
- How long it takes to replenish
- What the safety stock is
- how long is transit 

**This is the first time we decide if something is scary or not.**

---

### Step 7: Turn That Into a Simple Risk Ranking

**Now we combine a few facts:**
- How bad the event is
- Whether the material is critical
- Whether it's single-sourced
- Whether inventory is below safety stock
- Whether lead time is long
- Demand and priority levels

We turn that into:
- **High / Medium / Low**  
(or a number, but the label is what matters)

**This is the risk score.**

#### Important Truth:
**The number isn't magic.**  
It just lets us sort and prioritize.

**Risk Score Formula:**
```
risk_score = 
  event_severity (1-5)
  + criticality_weight (A=4, B=2, C=1)
  + single_source (+3 if Y)
  + below_safety_stock (+3 if gap > 0)
  + long_lead_time (+2 if >= 30 days)
  + priority_tier (+0 to +2)
  + demand_volume (+0 to +2)
```

**Thresholds:**
- **High**: score >= 12
- **Medium**: score 8–11
- **Low**: score < 8

---

### Step 8: Suggest What a Planner Should Look At

**Question:** "Given this situation, what should a human do next?"

**Examples:**
- "Planner review NOW: pull-in/expedite + evaluate alternates"
- "Planner review: evaluate alternates + monitor closely"
- "Monitor: prepare mitigation options"
- "Info only"

**We are NOT auto-changing the plan.**  
We are giving a starting point.

---

### Step 9: Capture the Human Decision

The planner:
- ✅ Approves
- ❌ Rejects
- 💬 Leaves a comment

We store that in `planner_feedback.csv`.

**This is how the system learns later.**

---

## What We Are NOT Doing

We are **NOT**:
- Replacing Firstshift
- Changing forecasts automatically
- Trusting AI blindly
- Pretending the score is perfect
- Claiming global omniscience

We **ARE**:
- Adding external awareness
- Creating structured suggestions
- Keeping humans in control


## What Is the Value?

### Today:
- Planners find out late
- They rely on emails, news, gut feel
- High-impact risks get buried in noise

### With This:
- The system tells you where to look
- Explains why
- And remembers what you decided last time

---

## Data Files Reference

### Required CSV Files

#### `signal_events.csv`
External world events that could impact supply chain.

| Field | Description | Example |
|-------|-------------|---------|
| `event_id` | Unique identifier | `event_001` |
| `event_ts` | Timestamp | `2025-12-10T08:00:00Z` |
| `event_type` | Category | `flood`, `port`, `labor`, `weather` |
| `country` | Country code | `AU` |
| `region` | Region/state | `AU-NSW` |
| `city` | City (optional) | `Sydney` |
| `severity` | 1–5 scale | `4` |
| `headline` | Human summary | `Flooding near Sydney` |
| `source_url` | Evidence link | `https://...` |

**Notes:**
- `severity` (1–5) drives base scoring
- `region` is used for site matching (no geo math required)

#### `supplier_sites.csv`
Manufacturing/supplier locations.

| Field | Description | Example |
|-------|-------------|---------|
| `site_id` | Unique identifier | `sydney_api` |
| `supplier_name` | Supplier | `AcmeChem` |
| `site_name` | Facility name | `Sydney API Mfg` |
| `country` | Country code | `AU` |
| `region` | Region/state | `AU-NSW` |
| `city` | City | `Sydney` |

#### `material_site_dependencies.csv`
Which materials each site produces.

| Field | Description | Example |
|-------|-------------|---------|
| `site_id` | Site reference | `sydney_api` |
| `material_id` | Material code | `api_alpha` |
| `material_name` | Display name | `API Alpha` |
| `criticality` | A / B / C | `A` |
| `single_source_flag` | Y / N | `Y` |
| `alternate_site_id` | Backup site (optional) | `` |

**Criticality meanings:**
- **A** = patient-impacting / revenue-critical / no slack
- **B** = important but manageable
- **C** = low impact or easily substitutable

#### `product_material_bom.csv`
Which products depend on which materials.

| Field | Description | Example |
|-------|-------------|---------|
| `material_id` | Material reference | `api_alpha` |
| `product_id` | Product code | `dermaway_50` |
| `product_name` | Display name | `DermAway 50mg` |
| `product_family` | Category | `DermAway` |
| `qty_per_unit` | Usage | `1` |
| `material_usage_class` | `core` / `minor` | `core` |

#### `market_exposure.csv`
Where each product is sold and how much it matters.

| Field | Description | Example |
|-------|-------------|---------|
| `product_id` | Product reference | `dermaway_50` |
| `market` | Market code | `US` |
| `avg_weekly_demand_units` | Demand volume | `1200` |
| `priority_tier` | 1 = critical, 3+ = low | `1` |

#### `inventory_position.csv`
Current inventory and lead times.

| Field | Description | Example |
|-------|-------------|---------|
| `product_id` | Product reference | `dermaway_50` |
| `market` | Market code | `US` |
| `on_hand_days` | Days of supply | `10` |
| `in_transit_days` | Pipeline | `5` |
| `safety_stock_days` | Target buffer | `14` |
| `lead_time_days` | Replenishment time | `21` |
| `next_po_eta_days` | Next arrival | `7` |

**Notes:**
- If inventory row is missing, system uses conservative defaults
- `on_hand_days < safety_stock_days` = vulnerable

#### `planner_feedback.csv` (output)
Human decisions on risk recommendations.

| Field | Description | Example |
|-------|-------------|---------|
| `rec_id` | Recommendation ID | `REC-event_001-...` |
| `event_id` | Event reference | `event_001` |
| `product_id` | Product | `dermaway_50` |
| `market_code` | Market | `US` |
| `decision` | `approve` / `reject` | `approve` |
| `reason_code` | Category | `expedite` |
| `comment` | Free text | `Called supplier` |
| `decided_ts` | Timestamp | `2025-12-10T10:00:00Z` |
| `status` | `pending` / `approved` / `rejected` | `approved` |

### Optional Files

#### `risk_watchlist.csv`
Pre-flag specific materials/products/markets as high priority.

| Field | Description | Example |
|-------|-------------|---------|
| `type` | `material` / `product` / `market` | `material` |
| `id` | Identifier | `api_alpha` |
| `priority_tier` | Boost level | `1` |

---

## Expected Outputs

After running the workflow, you'll find these files in `data/`:

### `risk_results.csv`
Detailed granular rows (`event × site × material × product × market`).

**Key columns:**
- `rec_id`, `event_id`, `site_id`, `material_id`, `product_id`, `market`
- `risk_score`, `risk_level` (HIGH/MEDIUM/LOW)
- `drivers` (explainable factors)
- `recommended_action` (what planner should do)

### `risk_rollup.csv`
Executive summary view (`event + site + material`).

**Key columns:**
- `rollup_id`, `event_id`, `site_id`, `material_id`
- `impacted_products` (comma-separated)
- `impacted_markets` (comma-separated)
- `risk_score` (max across products/markets)
- `recommended_action`

### `planner_feedback.csv`
Tracks human decisions for learning loop.

---

## Troubleshooting

### No risks generated?
- Check that `signal_events.csv` has matching `region` or `country` in `supplier_sites.csv`
- Verify CSVs have headers and valid data

### All scores are LOW?
- Check `inventory_position.csv` has valid data (not all 999s)
- Verify `criticality` is set to A/B/C in `material_site_dependencies.csv`
- Ensure `severity` in `signal_events.csv` is 3+ for meaningful base scores

### File not found errors?
- Confirm Docker volume mount: `-v "$PWD/data:/data"`
- Or update node file paths to absolute paths

---

## Next Steps

1. **Customize scoring weights** in `nodes/code_node/risk_scoring_action_recommender.ts`
2. **Add real data sources** (replace CSVs with APIs/databases)
3. **Add LLM narrative layer** (optional, for human-friendly summaries)
4. **Implement feedback loop** (adjust future scores based on planner decisions)
5. **Deploy to production** (connect to real ERP/inventory/demand feeds)

---

## Technical Details

See [`FULL_FLOW.md`](./FULL_FLOW.md) for complete system architecture and processing steps.

See [`nodes/code_node/risk_scoring_action_recommender.ts`](./nodes/code_node/risk_scoring_action_recommender.ts) for detailed scoring logic documentation.

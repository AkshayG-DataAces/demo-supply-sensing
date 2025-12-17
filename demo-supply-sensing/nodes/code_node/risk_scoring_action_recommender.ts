/**
 * DEMO: Supply sensing → dependency mapping → risk scoring → recommended action (rules-based)
 *
 * IMPORTANT DESIGN CHOICES:
 * - Deterministic scoring + deterministic suggested actions (auditable, stable)
 * - LLM is NOT used for decisions in v1. (LLM can be added later for narrative summaries.)
 *
 * INPUT (single item) contains arrays:
 *   events[]     : external signals (world events)
 *   sites[]      : supplier/manufacturing sites
 *   deps[]       : site → material dependencies (criticality, single-source, alternates)
 *   bom[]        : material → product mapping
 *   exposure[]   : product → market exposure (demand, priority)
 *   inventory[]  : material + market → inventory position
 *
 * OUTPUT: one item per "recommendation row":
 *   event × site × material × product × market with risk_score + drivers + suggested_action
 */

// ---------- helpers ----------
function toNum(x) {
  // Many CSV values arrive as strings; normalize to number safely
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function criticalityWeight(c) {
  // Simple weight mapping; can be tuned later
  if (c === 'A') return 4; // most critical
  if (c === 'B') return 2;
  return 1;               // C or unknown
}

function riskLevel(score) {
  // Convert raw score to an easy label planners understand
  if (score >= 12) return 'HIGH';
  if (score >= 8) return 'MEDIUM';
  return 'LOW';
}

function recommend(level, invGapDays, singleSource) {
  /**
   * Rules-based "next action category"
   * This is NOT "auto override". It's a triage suggestion for humans.
   */
  if (level === 'HIGH') {
    if (invGapDays > 0) return 'Planner review NOW: pull-in/expedite + evaluate alternates';
    if (singleSource) return 'Planner review: evaluate alternates + monitor closely';
    return 'Planner review: monitor and prep mitigation';
  }
  if (level === 'MEDIUM') return 'Monitor: prepare mitigation options';
  return 'Info only';
}

// ---------- read merged state ----------
const input = $input.first().json;

// Support either key name depending on how you aggregated in n8n
const events = input.events || [];
const sites = input.sites || [];
const deps = input.deps || input.dependencies || [];
const bom = input.bom || input.products || [];      // your BOM may be called "products"
const exposure = input.exposure || [];
const inventory = input.inventory || [];

// Every run gets a unique run_id so outputs can be traced
const runId = `RUN-${new Date().toISOString()}`;

const out = [];

// ---------- Step A: for each event, find relevant supply chain sites ----------
for (const e of events) {
  // Severity comes from the event feed (demo CSV). In production it would be mapped from feed attributes.
  const sev = toNum(e.severity);

  /**
   * Event → Site matching
   * For the demo we match by exact region OR country.
   * In production, this could become geo-radius, port lane mapping, polygon overlap, etc.
   */
  const matchedSites = sites.filter(s =>
    (s.region && e.region && s.region === e.region) || (s.country && e.country && s.country === e.country)
  );

  // ---------- Step B: for each matched site, find impacted materials ----------
  for (const s of matchedSites) {
    // Site → material dependencies
    const siteDeps = deps.filter(d => d.site_id === s.site_id);

    for (const d of siteDeps) {
      const critW = criticalityWeight(d.criticality);
      const singleSource = String(d.single_source_flag || '').toUpperCase() === 'Y';

      // ---------- Step C: material → products (BOM) ----------
      const bomRows = bom.filter(b => b.material_id === d.material_id);

      for (const b of bomRows) {
        // ---------- Step D: product → markets (exposure) ----------
          const markets = exposure.filter(x => x.product_id === b.product_id);

        for (const m of markets) {
          // ---------- Step E: attach inventory context ----------
          // Prefer inventory keyed by product + market; fall back to material + market.
          const inv =
            inventory.find(x => x.product_id === b.product_id && x.market === m.market) ||
            inventory.find(x => x.material_id === d.material_id && x.market === m.market);

          // Conservative defaults to avoid false-low scores when inventory is missing
          const onHand = inv ? toNum(inv.on_hand_days) : 0;
          const inTransit = inv ? toNum(inv.in_transit_days) : 0;
          const safety = inv ? toNum(inv.safety_stock_days) : 7;
          const lead = inv ? toNum(inv.lead_time_days) : 14;
          const nextEta = inv ? toNum(inv.next_po_eta_days) : 999;

          // Total coverage = on-hand + pipeline
          const coverageDays = onHand + inTransit;

          // Time-to-impact: will we run out before next shipment arrives?
          const timeToImpact = coverageDays < nextEta && nextEta < 999;

          // Vulnerability indicators (use total coverage, not just on-hand)
          const invGap = Math.max(0, safety - coverageDays);
          const longLead = lead >= 30;

          // ---------- Step F: risk score (priority ranking only) ----------
          /**
           * risk_score is a deterministic blend of:
           * - event severity (external)
           * - criticality + single-source (supply vulnerability)
           * - inventory gap + lead time (time sensitivity)
           *
           * This is designed to be explainable and easy to tune.
           */
          let score = 0;
          score += sev;           // 1-5
          score += critW;         // 1/2/4
          if (singleSource) score += 3;
          if (invGap > 0) score += 3;
          if (longLead) score += 2;
          if (timeToImpact) score += 2;

          // Demand / priority influence to surface high-demand, high-priority items
          const demand = toNum(m.avg_weekly_demand_units);
          const priority = toNum(m.priority_tier);
          if (priority > 0 && priority <= 1) score += 2;
          else if (priority === 2) score += 1;
          if (demand >= 1000) score += 2;
          else if (demand >= 500) score += 1;

          const level = riskLevel(score);

          // Drivers text makes it auditable
          const drivers = [];
          drivers.push(`Severity ${sev}`);
          drivers.push(`Criticality ${d.criticality}`);
          if (singleSource) drivers.push('Single-source');
          if (invGap > 0) drivers.push(`Below safety by ${invGap} days`);
          if (longLead) drivers.push(`Lead time ${lead} days`);
          if (timeToImpact) drivers.push(`Time-to-impact: will run out before next PO (ETA ${nextEta}d)`);
          if (priority) drivers.push(`Priority tier ${priority}`);
          if (demand) drivers.push(`Weekly demand ${demand}`);

          // ---------- Step G: suggested next action (triage, not automation) ----------
          const action = recommend(level, invGap, singleSource);

          // Unique id so human feedback can reference it later
          const rec_id = `REC-${e.event_id}-${s.site_id}-${d.material_id}-${b.product_id}-${m.market}`;

          // Emit one recommendation row
          out.push({
            run_id: runId,
            rec_id,

            // Event evidence
            event_id: e.event_id,
            event_ts: e.event_ts,
            event_type: e.event_type,
            headline: e.headline,
            source_url: e.source_url,
            country: e.country,
            region: e.region,
            city: e.city,

            // Supply chain context
            site_id: s.site_id,
            supplier_name: s.supplier_name,
            site_name: s.site_name,

            material_id: d.material_id,
            material_name: d.material_name,
            criticality: d.criticality,
            single_source_flag: d.single_source_flag,

            product_id: b.product_id,
            product_name: b.product_name,
            product_family: b.product_family,

            market: m.market,
            avg_weekly_demand_units: toNum(m.avg_weekly_demand_units),
            priority_tier: toNum(m.priority_tier),

            on_hand_days: onHand,
            in_transit_days: inTransit,
            coverage_days: coverageDays,
            safety_stock_days: safety,
            lead_time_days: lead,
            next_po_eta_days: nextEta < 999 ? nextEta : null,
            time_to_impact_flag: timeToImpact,

            // Outputs
            risk_score: score,
            risk_level: level,
            drivers: drivers.join(' | '),
            recommended_action: action,

            // Safety flag
            auto_override_ready: false
          });
        }
      }
    }
  }
}

return out.map(x => ({ json: x }));


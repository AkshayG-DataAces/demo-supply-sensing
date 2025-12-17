/**
 * Roll up noisy rows (event×site×material×product×market)
 * into an executive-friendly risk list:
 * one row per event + site + material
 *
 * Keeps:
 * - MAX risk_score (worst case)
 * - Aggregates impacted products/markets
 * - Worst coverage_days + any time_to_impact
 */

const rows = $input.all().map(x => x.json);
const groups = new Map();

for (const r of rows) {
  const key = `${r.event_id}||${r.site_id}||${r.material_id}`;

  if (!groups.has(key)) {
    groups.set(key, {
      run_id: r.run_id,
      rollup_id: `ROLL-${r.event_id}-${r.site_id}-${r.material_id}`,

      // Event
      event_id: r.event_id,
      event_ts: r.event_ts,
      event_type: r.event_type,
      risk_type: r.risk_type,
      headline: r.headline,
      source_url: r.source_url,
      country: r.country,
      region: r.region,
      city: r.city,

      // Site
      site_id: r.site_id,
      supplier_name: r.supplier_name,
      site_name: r.site_name,

      // Material
      material_id: r.material_id,
      material_name: r.material_name,
      criticality: r.criticality,
      single_source_flag: r.single_source_flag,

      // Representative scoring fields (will be updated if a worse row appears)
      risk_score: r.risk_score,
      risk_level: r.risk_level,
      drivers: r.drivers,
      recommended_action: r.recommended_action,

      // Rollups
      impacted_products: new Set([r.product_name]),
      impacted_markets: new Set([r.market]),
      
      // Inventory: track worst-case scenario
      worst_on_hand_days: r.on_hand_days,
      worst_in_transit_days: r.in_transit_days,
      worst_coverage_days: r.coverage_days,
      worst_safety_stock_days: r.safety_stock_days,
      worst_lead_time_days: r.lead_time_days,
      worst_next_po_eta_days: r.next_po_eta_days,
      worst_time_to_impact: r.time_to_impact_flag,
      worst_market: r.market,
      worst_product: r.product_name,

      // Priority rollup: keep the best (lowest tier number)
      best_priority_tier: Number.isFinite(Number(r.priority_tier)) ? Number(r.priority_tier) : 999,
      max_weekly_demand: Number.isFinite(Number(r.avg_weekly_demand_units)) ? Number(r.avg_weekly_demand_units) : 0
    });
  } else {
    const g = groups.get(key);

    // Add impacted items
    if (r.product_name) g.impacted_products.add(r.product_name);
    if (r.market) g.impacted_markets.add(r.market);

    // Update rollups
    const pt = Number.isFinite(Number(r.priority_tier)) ? Number(r.priority_tier) : 999;
    g.best_priority_tier = Math.min(g.best_priority_tier, pt);
    
    const demand = Number.isFinite(Number(r.avg_weekly_demand_units)) ? Number(r.avg_weekly_demand_units) : 0;
    g.max_weekly_demand = Math.max(g.max_weekly_demand, demand);

    // Update worst inventory case (lowest coverage)
    const cov = Number.isFinite(Number(r.coverage_days)) ? Number(r.coverage_days) : 999;
    if (cov < g.worst_coverage_days) {
      g.worst_on_hand_days = r.on_hand_days;
      g.worst_in_transit_days = r.in_transit_days;
      g.worst_coverage_days = r.coverage_days;
      g.worst_safety_stock_days = r.safety_stock_days;
      g.worst_lead_time_days = r.lead_time_days;
      g.worst_next_po_eta_days = r.next_po_eta_days;
      g.worst_time_to_impact = r.time_to_impact_flag;
      g.worst_market = r.market;
      g.worst_product = r.product_name;
    }

    // Promote worst-case row
    if (Number(r.risk_score) > Number(g.risk_score)) {
      g.risk_score = r.risk_score;
      g.risk_level = r.risk_level;
      g.drivers = r.drivers;
      g.recommended_action = r.recommended_action;
    }
  }
}

// Finalize sets into strings
const out = [];
for (const g of groups.values()) {
  out.push({
    ...g,
    impacted_products: Array.from(g.impacted_products).join(', '),
    impacted_markets: Array.from(g.impacted_markets).join(', ')
  });
}

return out.map(x => ({ json: x }));

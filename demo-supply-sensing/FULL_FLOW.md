FULL FLOW with inputs and outputs

I’ll number every step and explicitly say:

Input

What we do

Output

STEP 1 — World signal comes in

Input

signal_events.csv

Relevant fields:

event_id

event_type

country

region

severity

headline

source_url

What we do
We do nothing smart yet.
We just say: “This happened here.”

Output

A normalized event object
(No decision yet)

STEP 2 — Is this relevant to us?

Input

Event from Step 1

supplier_sites.csv

Relevant fields:

country

region

site_id

What we do
We check:

“Do we have any supplier sites in this country or region?”

If no → ignore event
If yes → keep going

Output

event + impacted_site_ids[]

STEP 3 — What does that site produce?

Input

site_id

material_site_dependencies.csv

Relevant fields:

material_id

criticality

single_source_flag

alternate_site_id

What we do
We map:

site → materials

Output

event + site + material_ids[]

Still no scoring.

STEP 4 — What products depend on those materials?

Input

material_id

product_material_bom.csv

Relevant fields:

product_id

product_family

material_usage_class

What we do
We map:

material → product

Output

event + site + material + product_ids[]

STEP 5 — Which markets care?

Input

product_id

market_exposure.csv

Relevant fields:

market

avg_weekly_demand_units

priority_tier

What we do
We map:

product → market exposure

Output

Full exposure context

event
→ site
→ material
→ product
→ market


At this point, we know what could be impacted, but not whether it’s urgent.

STEP 6 — Do we have inventory to absorb this?

Input

material_id

inventory_position.csv

Relevant fields:

on_hand_days

safety_stock_days

lead_time_days

What we do
We compute simple facts:

Are we below safety stock?

Is lead time long?

Is there inventory in transit?

Output

Vulnerability indicators:

inventory_gap = safety_stock_days - on_hand_days
lead_time_risk = lead_time_days > threshold

STEP 7 — THIS IS THE SCORE (priority ranking)
What the score actually is

The score is a math combination of facts we already know.

Example logic (simple, explainable):

Start with severity (from the event)

Add risk if:

material is critical (A/B/C)

material is single-source

inventory is below safety stock

lead time is long

Example

risk_score =
  event_severity (4)
+ criticality_weight (A = +4)
+ single_source (Y = +3)
+ inventory_below_safety (Y = +3)
+ long_lead_time (Y = +2)

Total = 16

What this means

The number itself does NOT matter

What matters is:

16 > 9

so this appears higher on the list

Output

risk_score

risk_level (High / Medium / Low)

drivers[] (text explanation)

This lets you say:

“This is high risk because X, Y, Z.”

STEP 8 — Suggested human action (NOT automation)
Input

risk_level

inventory_gap

alternate_site_id

What we do

We apply very boring rules:

Condition	Suggested action
High risk + below safety	Planner review immediately
High risk + single source	Explore alternates / expedite
Medium risk	Monitor
Low risk	Info only
Output

recommended_action

confidence = High / Medium / Low

auto_override_ready = false

This is intentionally conservative.

STEP 9 — HUMAN PLANNING INPUT (this is critical)

This is where human planning actually happens.

What the human sees

They see a Risk Brief, not a CSV:

What happened

Why it matters

What products/markets are exposed

What the system suggests

What the human does

They choose one:

✅ Approve recommendation

❌ Reject

💬 Add comment

How we capture it

We store it in planner_feedback.csv.

Fields used:

rec_id

decision (approve/reject)

reason_code

comment

decided_ts

This is the learning loop input.

Why capturing human input matters

This allows us later to say:

“When floods happen in AU-NSW, planners usually expedite”

“When inventory gap < 5 days, planners ignore it”

That’s how future suggestions get better.
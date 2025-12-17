how to run n8n (docker command)

where to put the CSVs

how to import workflows

which node needs file path updates

how to execute the demo

what output files to expect

# data - start 

data/signal_events.csv
Notes:

severity is 1–5 and drives the scoring.
region is what we’ll join to supplier sites fast (no geo math required).

data/supplier_sites.csv

data/material_site_dependencies.csv

Criticality meaning (keep it simple for the demo):

A = patient-impacting / revenue-critical / no slack
B = important but manageable
C = low impact or easily substitutable

data/product_material_bom.csv

data/market_exposure.csv

data/inventory_position.csv

data/risk_watchlist.csv (optional but recommended)

data/planner_feedback.csv (empty starter)


# workflow in plain english
# Step 1: Something happens in the world

Example:

Flooding near Sydney
Port congestion in Melbourne
Labor strike in Mumbai

In the demo, this is a row in signal_events.csv.

In production, it would be:

a weather alert
a port delay feed
a news event

Important:
At this step, we are NOT deciding anything.
We are just saying: “Something happened here.”

# Step 2: We ask a very basic question -- maybe this should actually be first we only look for things in cities we source or deliver too ? (move to step 1 )

**“Do we source anything from there?”**

To answer that, we look at:

*supplier_sites.csv*

If we see:
a supplier site in AU-NSW
then the event is relevant.

If we don’t:
we ignore it

This is how we avoid “watching the whole world.”

# Step 3: If a site is hit, what does it make?

**Now we ask: “If this site has trouble, what breaks?”**

We answer that using:
*material_site_dependencies.csv*

Example:

Sydney site → makes API Alpha

Still no scoring. Just mapping.

# Step 4: If that material is late, what products are affected?

**Now we ask: “What products need that material?”**

We answer using:
*product_material_bom.csv*

Example:

API Alpha → DermAway 50mg and 100mg

Again: still no AI, no magic. Just joins.

# Step 5: If those products are affected, where do we sell them?

**Now we ask: “Which markets care?”**

We answer using:

*market_exposure.csv*

Example:

DermAway → US and EU markets

Now we finally understand business impact.

# Step 6: Is this actually a problem right now?

**Now we ask: “Do we have enough inventory to ride this out?”**

We answer using:

*inventory_position.csv*

We check:

how many days of inventory we have
how long it takes to replenish
what the safety stock is
This is the first time we decide if something is scary or not.

# Step 7: Turn that into a simple risk ranking

**Now we combine a few facts:**

how bad the event is
whether the material is critical
whether it’s single-sourced
whether inventory is below safety stock
whether lead time is long

We turn that into:

High / Medium / Low
(or a number, but the label is what matters)

This is the risk score.

# Important truth:
The number isn’t magic.
It just lets us sort and prioritize.

# Step 8: Suggest what a planner should look at

**Now we say: “Given this situation, what should a human do next?”**

Examples:

review this now

pull in supply

look for alternates

monitor only

We are NOT auto-changing the plan.

We are giving a starting point.

# Step 9: Capture the human decision

**The planner clicks:**

Approve
Reject

Or leaves a comment
We store that in:

planner_feedback.csv

This is how the system learns later.
What we are NOT doing 

We are not:

replacing Firstshift
changing forecasts automatically
trusting AI blindly
pretending the score is perfect
claiming global omniscience

We are:

adding external awareness
creating structured suggestions
keeping humans in control
The one paragraph you can literally read to your boss


# Demo statement:
We’re building a sensing layer that watches for real-world disruptions, checks whether they touch our sourcing footprint, traces the impact through materials and products, and then tells planners which risks are worth looking at and why. The CSVs are just stand-ins for ERP, inventory, and demand data so we can show the logic end-to-end. In production, the same flow would run off live feeds and Firstshift outputs, but the decision always stays with a human.

# What is the value 

*Today:*

planners find out late
they rely on emails, news, gut feel
high-impact risks get buried in noise

*With this:*
the system tells you where to look
explains why
and remembers what you decided last time


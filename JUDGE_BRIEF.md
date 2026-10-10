# JUDGE BRIEF — Ahmedabad Transit Companion
*One page. Glance at this while presenting. Everything here is real and demoable offline.*

**Repo:** https://github.com/choksi2212/metroo-hackk

---

## THE 15-SECOND OPENING (say this first, naturally)

> "We built this on the metro ride here — and that's the point. Every transit app plans
> station-to-station. Ours plans **destination-to-destination** across metro, BRTS *and* AMTS —
> **one journey, one ticket, one fare** — type 'MSI Service Center, Bodakdev' and it tells you
> the station, the **exact exit gate**, the bus last mile, and the walk to the doorstep. And it
> does all of that in **airplane mode** — zero network calls, because a metro app is useless
> when you're 20 metres underground."

*(If they ask what's underground: tunnels on the Blue Line; platforms have no reliable signal.)*

## THE 5 WOW MOMENTS — show in this order

1. **AIRPLANE MODE FIRST.** Don't save it for last — prove resilience up front.
   Turn airplane mode ON in front of them. Banner appears: *"Offline mode — using locally
   stored Ahmedabad transit data."* Search "Civil" → route generates fully offline.
   Reload the page — the whole app boots again from cache. Say: *"No server. No fallback.
   This is the actual app, right now."*
2. **THE PS-08 MOMENT — ₹38 vs ₹120.** Search "Airport" → SVP International Airport, from
   Mahatma Mandir. **Fastest: 60 min, ₹120** — metro + auto (₹90 of it is the auto).
   **Cheapest: 98 min, ₹38** — Yellow → Red at Motera → Blue at Old High Court → Kalupur,
   then the AMTS bus to the airport. Say: *"Same trip: ₹120 private, ₹38 on transit — people
   give up on transit and take private vehicles because it's three tickets and three apps.
   One ticket + one fare fixes it. That's PS-08, One City, One Journey."*
3. **FARE-SPLIT CARD — THE PPP.** On that airport route's details screen, the fare-split
   card shows exactly who earns what: **Yellow Line ₹30 · Red Line ₹15 · Blue Line ₹10 ·
   AMTS ₹8**. Say: *"The commuter pays once with one NCMC tap. A privately-run transit
   clearinghouse settles each operator its leg fare and charges operators per settled
   ticket — that's the PPP that makes multi-operator ticketing commercially workable."*
4. **EXACT EXIT GATE.** Search "MSI" → MSI Service Center, Bodakdev.
   Route: Yellow → Red at Motera → Blue at Old High Court → exit Thaltej.
   Open route details: **"Exit Gate 1 — Sarkhej–Gandhinagar (SG) Highway"**,
   then BRTS 401/700 to Iskon Cross Road, 3-min walk. The last 400 metres are where
   newcomers actually get lost — that's what nobody else plans.
5. **DISRUPTION FALLBACK.** Disruptions (demo) panel → "Mark exit unavailable (Gate 1)".
   Route **recalculates instantly**, fallback reason banner shows. Clear it → original
   route returns. Say: *"The operator knows a gate is broken; the passenger finds out
   before they're stranded at the top of the stairs."*

Bonus if time: switch language to **ગુજરાતી** (whole UI + route steps re-render, still offline),
or the local SVG network map — no map tiles, loads underground.

**THE DIFFERENTIATOR (drop this line anytime):**
> "Official apps plan station-to-station. This plans **destination-to-destination**."

---

## JUDGE Q&A — 10 questions, answers you can say in one breath

**Q1. Where does the data come from? Is it real?**
Real Gujarat Metro network — all 54 stations across the 4 operational lines with names in
English, Hindi and Gujarati; 40 bus stops (36 BRTS + 4 AMTS); fares from the published metro
fare chart, so the ₹38-vs-₹120 airport comparison is computed by our fare engine, not
hand-written. Exits, walking times and bus connections hand-verified against station layouts
and AMTS/BRTS route data, packaged as a local dataset.

**Q2. How is this PS-08, "One City, One Journey"?**
We combined all three operators — metro, BRTS and AMTS — into one planner with one fare
estimate and transfer walk times included. The airport run makes it concrete: ₹38 on transit
vs ₹120 private. People abandon transit because stitching three operators is three tickets,
three apps and no door-to-door answer. One journey, one ticket, one fare fixes exactly that.

**Q3. How does the fare-splitting work?**
The commuter pays once with a single NCMC tap. The fare-split card shows the settlement
view — on the airport route, Yellow Line ₹30 · Red Line ₹15 · Blue Line ₹10 · AMTS ₹8.
A transit clearinghouse takes that one payment and settles each operator its leg fare.

**Q4. What's the clearinghouse PPP?**
The clearinghouse is privately run: it's the commercial glue between three public operators.
It settles every multi-operator ticket and charges operators per settled ticket — so the
private partner earns in proportion to journeys it actually enables, and operators get
their leg fare without building settlement infrastructure of their own. It's the same
model that makes interbank card payments work — NCMC clearing is the transit version.

**Q5. Why a PWA and not an Android app?**
No app store, no install friction — a QR code on the station wall and you're using it in
seconds, which matters for tourists and one-time visitors. It also runs on iOS, any laptop
and any kiosk the metro installs, from one codebase.

**Q6. How would the metro actually deploy this?**
Zero integration: host the static bundle on their website or a station kiosk and print a
QR code. Deep links can embed "nearest station" prompts in tickets. When they later expose
real-time feeds, the disruption layer is already the ingestion point — swap demo data for a feed.

**Q7. What about privacy?**
Nothing leaves the device. No accounts, no analytics, no tracking — location stays in the
browser tab and history lives in local storage. We can't see where anyone went.

**Q8. Would you use GTFS or real metro APIs?**
The dataset is structured GTFS-shaped — stops, routes, transfers, footpaths — so it ports
cleanly. We deliberately went offline-first: GTFS data is already published data, so we ship
it with the app instead of fetching it, which is what makes the whole thing airplane-mode safe.

**Q9. What breaks at scale?**
Routing is the constraint, so it runs on a compact graph — 54 metro nodes plus 40 bus stops —
and answers in milliseconds with no server. Scaling to 500 stations means a bigger local
dataset and a progressive-download pattern (route cache by home station), not new architecture.

**Q10. What does it cost to run? Why doesn't the official app already do this?**
Almost nothing — static files on a CDN, a few rupees a month, no backend to monitor. And
official apps optimise for ticketing and station operations; they assume you already know
which station serves your destination. The hard, unglamorous part — the curated last-mile
dataset of exits, gates and walking paths across three operators — no one has built for
Ahmedabad. That's the moat we built tonight.

---

## IMPACT STAT BLOCK (for the closing slide)

| | |
|---|---|
| **54** stations | full operational network, all 4 lines |
| **40** bus stops | 36 BRTS + 4 AMTS, stitched into the same journey |
| **33** destinations | hospitals, colleges, malls, railway, markets, airport |
| **3** operators, **1** ticket | NCMC one-ticket; clearinghouse settles each operator |
| **3** languages | English · હિન્દી · ગુજરાતી |
| **0** network calls | airplane-mode safe, start to finish |
| **₹38 vs ₹120** | airport trip: one-ticket transit vs private auto |

**Last line to say:** *"Built on a moving metro train, for people riding it."*

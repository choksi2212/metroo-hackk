# DEMO — Ahmedabad Transit Companion

**Pitch (say this first):**
> "Most transit apps plan station-to-station. Ahmedabad Transit Companion plans destination-to-destination — and it works with zero internet. Type where you want to go; it tells you the station, the exact exit gate, the bus connection, and the last 400 metres to the doorstep. Metro, BRTS and AMTS stitched into **one journey, one ticket, one fare** — that's PS-08, One City, One Journey, on one screen."

**Repo:** https://github.com/choksi2212/metroo-hackk

**Before demoing:** open the app once while online (refresh once), then it's cached — everything below works in airplane mode.

---

## Demo 1 — THE PS-08 MOMENT: Mahatma Mandir → SVP Airport — ₹38 vs ₹120

*The headline. Same start, same destination, two very different prices — this is why people give up on transit, and what one ticket fixes.*

1. Home screen → type **"Airport"** in the search box.
2. Tap **SVP International Airport**.
3. Origin: tap **Use current location** (simulated at Mahatma Mandir).
4. Show the two route cards side by side:
   - **Fastest — 60 min · ₹120** — Yellow Line to Motera Stadium, then an auto to the airport. ₹90 of that ₹120 is the auto.
   - **Cheapest — 98 min · ₹38** — Yellow Line → Red Line at Motera Stadium → Blue Line at Old High Court → Kalupur Railway Station → 6-min walk to the Cantt. Railway Station (AMTS) stop → AMTS bus to the Airport (AMTS) stop → short walk to the terminal.
5. Say the line: *"Same trip. Private vehicle: ₹120. Riding metro + AMTS the whole way: ₹38 — barely a third of the price. People give up on transit and take private vehicles because it's three tickets and three apps. One ticket + one fare fixes it. That's PS-08."*
6. Tap the **Cheapest** card → open **Route details** — walk through the steps:
   - board the Yellow Line toward Motera Stadium
   - change to the Red Line at Motera Stadium, change to the Blue Line at Old High Court
   - ride to Kalupur Railway Station
   - walk 6 min to the Cantt. Railway Station (AMTS) stop, AMTS bus toward the airport
7. Scroll to the **fare-split card** — *"How the fare splits (one ticket, settled between operators)"*:
   - Per-operator rows, straight from the fare data: **Yellow Line ₹30 · Red Line ₹15 · Blue Line ₹10 · AMTS ₹8**.
   - Say: *"The commuter pays once with a single NCMC tap. A transit clearinghouse settles each operator its leg fare — the clearinghouse is privately run and charges operators per settled ticket. That's the PPP that makes one-ticket, multi-operator journeys commercially workable."*
   - If a judge adds the rows (₹63) and points at the ₹38 header: ₹38 is the commuter's single blended fare — one metro fare for the full 28 km rail journey (₹30) + ₹8 AMTS. The card is the settlement view — what each operator's own slab earns when the clearinghouse settles per leg. Both come from the same fare table.

## Demo 2 — Flagship: Mahatma Mandir → MSI Service Center, Bodakdev

*The real first-timer problem that inspired the app.*

1. Home screen → type **"MSI"** in the search box.
2. Tap **MSI Service Center — Bodakdev**.
3. Origin: tap **Use current location** (simulated at Mahatma Mandir).
4. Show the route cards:
   - **Fastest — 77 min · ₹30** — Yellow Line → Red Line at Motera → Blue Line at Old High Court → Thaltej, then an 18-min walk.
   - **Least-walking — 83 min · ₹37** — same metro run, then BRTS 401/700 from Thaltej Gam toward Iskon Cross Road, short walk to the service center.
5. Open **Route details** on Least-walking — walk through the steps:
   - board the Yellow Line toward Motera Stadium
   - change at Motera Stadium, change at Old High Court
   - **exit from Gate 1 at Thaltej — "Sarkhej–Gandhinagar (SG) Highway"**
   - BRTS 401/700 toward Iskon Cross Road, 3 min walk to the service center
6. Point out: **total time, ₹cost, walking minutes, accessibility info on every gate**.
7. The fare-split card here shows the multi-operator settlement too: **Yellow ₹30 · Red ₹15 · Blue ₹15 · BRTS ₹7**.

## Demo 3 — Language switcher

1. Top-right → **ગુ** (Gujarati). The whole UI + route steps re-render in Gujarati.
2. Switch to **हिं** (Hindi) if asked. Zero network calls — translations are local.

## Demo 4 — Airplane mode (the money shot)

1. Turn **airplane mode ON** (or Wi-Fi off). The banner appears: *"Offline mode — using locally stored Ahmedabad transit data."*
2. Search **"Civil"** → tap Civil Hospital.
3. Use current location → route generates fully offline: Red Line → Blue Line → Kalupur → BRTS to Civil Hospital stop.
4. Open route details, show the exit gate + step list.
5. **Save the journey** (bookmark icon) → go Home → Saved journeys → it's there after close/reopen.

## Demo 5 — Disruption fallback (operator view)

1. Plan any route that exits at Thaltej Gate 1 (e.g. MSI demo above).
2. In **Disruptions (demo)** panel → tap **"Mark exit unavailable (Gate 1)"**.
3. The route **recalculates instantly** and shows a fallback reason banner.
4. Tap **Clear all disruptions** → original route returns.
5. Say: *"The metro knows a gate is broken. The passenger finds out before they're stranded at the top of the stairs."*

## Demo 6 — Saved journeys survive restart

1. With a saved journey present, close the browser tab completely.
2. Airplane mode still ON. Reopen the app.
3. Home → **Saved journeys** → the journey is there, offline.

## Demo 7 — Network map

1. Tap **Network map** — schematic SVG of the full 4-line network (Blue/Red/Yellow/Violet).
2. With a route planned, the map shows the highlighted station path.
3. Say: *"No map tiles, no Google Maps — this is a local SVG, so it loads underground."*

---

## One-line answers for judges

- **"Does it use Google Maps?"** — No. Zero external APIs. The map is a local SVG; search is over local JSON.
- **"Where does the data come from?"** — Real GMRC network (54 stations, 4 lines, real interchanges) plus 40 bus stops — 36 BRTS + 4 AMTS. Fares come from the published fare chart, so the ₹38-vs-₹120 airport comparison is computed by the fare engine, not hand-written.
- **"How is this PS-08, One City, One Journey?"** — One planner across all three operators with one fare estimate and transfer walk times included; the airport run shows the fare gap one ticket closes (₹38 transit vs ₹120 private).
- **"What's the fare-split card?"** — The settlement view of a one-ticket NCMC journey: commuter pays once, a privately-run transit clearinghouse settles each operator its leg fare. That's the PPP.
- **"How would the metro use this?"** — Embed as the PS-08 journey layer in the official Ahmedabad Metro app; the ticket flow ends at the gate today, this carries the passenger to the doorstep across all three operators.
- **"What happens underground?"** — Everything is cached by the service worker; airplane mode is a supported mode, not an edge case.
- **"Why not native Android?"** — The core value is the offline journey-planning logic; a PWA demos on any device and can be wrapped in WebView later.

## Timing (2-minute version)

0:00–0:15 — pitch
0:15–0:30 — airplane mode ON + reload (prove offline first; leave it on)
0:30–1:00 — **PS-08 moment**: Mahatma Mandir → Airport, ₹38 vs ₹120 + fare-split card
1:00–1:20 — Demo 2 flagship exit gate + Demo 5 disruption fallback
1:20–1:35 — Demo 3 language switch
1:35–2:00 — saved journeys + map + judge questions

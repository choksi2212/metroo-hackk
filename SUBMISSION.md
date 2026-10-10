# Ahmedabad Transit Companion — Hackathon Submission

**Public repo:** https://github.com/choksi2212/metroo-hackk

**Problem statement: PS-08 — One City, One Journey** — metro, BRTS, and AMTS are separate operators with separate tickets and confusing transfers, so commuters give up and fall back to private vehicles.

**One-line pitch:** Ahmedabad Transit Companion takes newcomers from any destination to the right metro station, exit, bus connection, and doorstep—even without internet.

## Deliverables mapping

- Multimodal journey planner: ✓
- One fare estimate for the whole journey: ✓
- Transfer walking times: ✓
- BONUS fare-splitting logic: ✓

## What works right now

- **Destination search (33 places)** — type "MSI Service Center" or "Bodakdev"; 33 curated places (hospitals, colleges, malls, railway stations, service centers) each resolve to a full door-to-door plan, not just a station name.
- **3 route options per query** — Fastest / Cheapest / Least-walking, computed by an offline Dijkstra over a combined metro + BRTS + AMTS + walking graph. No server round-trip, no external routing APIs.
- **Metro + BRTS + AMTS legs** — a single itinerary can chain all three operators, replacing three separate tickets and confusing transfers with one planned journey.
- **Exact exit gates + lift/escalator** — every itinerary names the specific station exit, the landmark facing it (e.g. "Exit 2, toward Prahladnagar Garden"), and the lift/escalator side, so first-timers don't come up on the wrong side of the road.
- **One fare estimate + BONUS PPP fare-split card** — metro fare slabs, BRTS fare, NCMC discount, and realistic walk/metro speeds baked into every route card; the fare-split card breaks each operator's share of the total.
- **Transfer walking times** — every interchange and last-mile hop shows realistic walk minutes between metro, BRTS, and AMTS, so transfers are never a guess.
- **Trilingual UI (EN/HI/GU)** — English, हिन्दी, and ગુજરાતી across every screen, label, and instruction.
- **Disruption fallback** — toggle a blocked exit, closed interchange, or suspended BRTS stop and routes recompute around it live; if no route survives, the app says so explicitly instead of guessing.
- **Saved journeys** — pin frequent trips to the home screen and replay them offline (localStorage).
- **Fully offline PWA, airplane-mode tested** — service worker + web manifest; airplane-mode tested end-to-end: shell, search, routing, language switch, saves, and map all load with zero network requests.
- **Schematic network map** — bundled local SVG metro map, no map tiles or CDNs required.

**100% offline, zero external APIs, zero accounts** — designed as a module that can be embedded in the official Ahmedabad Metro app.

**Hashtags:** #AhmedabadMetro #OfflineFirst #PWA #LastMileConnectivity #TransitForAll

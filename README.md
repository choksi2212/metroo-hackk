# YatraSetu — Ahmedabad Transit Companion

> **From destination to doorstep — even without internet.**

YatraSetu is an offline-first Progressive Web App for Ahmedabad and Gandhinagar transit. It helps a commuter start with a destination — not a station — and produces a practical door-to-door journey across metro, BRTS, AMTS, walking, and auto-rickshaw connections.

Most metro planners stop at the station gate. YatraSetu continues the journey: it identifies the closest station, the useful exit, the direction, the last-mile connection, the estimated fare, and the walking time.

Built for **Metro Hacks 2026 — PS-08: One City, One Journey**.

---

## Product at a glance

| Capability | What YatraSetu does |
|---|---|
| Destination-first planning | Search places such as MSI Service Center, SVP Airport, Civil Hospital, or GIFT City |
| Multimodal routing | Combines metro, BRTS, AMTS, walking, and auto links |
| Route choices | Returns fastest, cheapest, and least-walking options |
| Last-mile clarity | Shows station exit gates, landmarks, directions, and accessibility information |
| Offline operation | Loads local datasets and a precached app shell without runtime APIs |
| Languages | English, हिन्दी, and ગુજરાતી |
| Location support | Uses device GPS, finds the nearest station, and tells the commuter which station was selected |
| Journey memory | Stores recent destinations and saved journeys in browser LocalStorage |
| Visual orientation | Provides a local schematic SVG network map |

## Why this exists

A first-time visitor usually knows **where they are going**, not which metro station to select. Even after reaching the correct station, the journey is not finished:

1. Which station is closest to the destination?
2. Which exit reaches the correct side of the road?
3. Is there a BRTS or AMTS connection for the final stretch?
4. How much walking is involved?
5. What will the complete journey cost?

YatraSetu models those hand-offs in one local journey graph. It is designed as a journey layer that could eventually be embedded in an official transit application.

---

## System architecture

```text
                         +----------------------+
                         |      Commuter        |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         |    React interface   |
                         +--+----+----+----+----+
                            |    |    |    |
                 +----------+    |    |    +----------> SVG network map
                 |               |    +---------------> LocalStorage
                 v               v
        Destination search   Browser GPS
                 |               |
                 v               v
        Local JSON datasets  Nearest station
                 |               |
                 +-------+-------+
                         v
                 Multimodal graph
                         |
                         v
                   Dijkstra engine
                         |
                         v
             Fastest / Cheapest / Least walking

     Service worker ---> Precached app shell + local data ---> React interface
```

### Architectural principles

- **Offline by construction:** no Google Maps, geocoding, backend, map tiles, or runtime routing API.
- **Data-driven routing:** stations, buses, places, exits, fares, and connections are JSON rather than hard-coded into the UI.
- **Deterministic results:** Dijkstra gives repeatable, explainable routes.
- **Separation of concerns:** the interface handles interaction; `data.js` handles loading, search, and storage; `router.js` handles graph construction and routing.
- **Progressive enhancement:** GPS is helpful, but manual station selection remains available when permission is denied or unavailable.

## End-to-end control flow

```text
  COMMUTER          REACT APP          LOCAL DATA          GPS          ROUTER       STORAGE
      |                 |                  |                |              |             |
      |-- search ------>|                  |                |              |             |
      |                 |-- score -------->|                |              |             |
      |<-- destinations-|                  |                |              |             |
      |-- choose place->|                  |                |              |             |
      |-- choose origin>|                  |                |              |             |
      |                 |-- request GPS ------------------->|              |             |
      |                 |<-- coordinates -------------------|              |             |
      |                 |-- nearest station->|              |              |             |
      |<-- station toast|                  |                |              |             |
      |                 |----------------------------------------------->|             |
      |                 |                  |<-- graph + fares ----------|             |
      |                 |<-- route variants-----------------------------|             |
      |<-- route cards--|                  |                |              |             |
      |-- save journey->|------------------------------------------------------------->|
      |<-- saved state--|                  |                |              |             |
```

## Routing model

The route engine represents the city as a weighted, undirected graph.

### Node types

```text
st:<station-id>       Metro station
brts:<stop-id>        BRTS or AMTS stop
place:<place-id>      Searchable destination
```

### Edge types

| Edge | Meaning | Main weight inputs |
|---|---|---|
| Metro | Adjacent metro stations | Segment distance and metro speed |
| Metro ↔ bus | Transfer walk | Transfer walking minutes |
| BRTS / AMTS | Bus corridor segment | Distance, network speed, wait time |
| Destination walk | Station/stop to destination | Walking minutes and exit metadata |
| Auto | Station to destination by auto | Estimated minutes and fixed cost |

### Route preferences

The same graph is evaluated with three cost functions:

- **Fastest:** minimizes estimated travel time.
- **Cheapest:** reduces the effective weight of public-transit edges and penalizes auto travel.
- **Least walking:** makes walking edges more expensive so the engine prefers routes with less walking.

After a path is found, the engine converts the raw node path into readable legs, groups consecutive metro or bus segments, calculates fare, and deduplicates equivalent itineraries.

```text
                 +------------------------+
                 | Origin + destination   |
                 +-----------+------------+
                             |
                 +-----------v------------+
                 | Build adjacency graph  |
                 +-----+---------+--------+
                       |         |
             +---------+--+   +--+---------+   +------------------+
             | Fastest    |   | Cheapest  |   | Least walking    |
             | cost       |   | cost      |   | cost             |
             +------+-----+   +-----+-----+   +--------+---------+
                    |               |                  |
                    v               v                  v
                 Dijkstra        Dijkstra           Dijkstra
                    |               |                  |
                    +---------------+------------------+
                                    v
                         Reconstruct node paths
                                    |
                                    v
                           Convert into legs
                                    |
                                    v
                         Calculate fares and walking
                                    |
                                    v
                              Route cards
```

## Data layer

All runtime datasets live in [`public/data`](public/data). Current repository counts:

- **54** metro stations
- **40** bus stops: 36 BRTS and 4 AMTS
- **34** searchable destinations
- **72** station exits
- **53** metro connections
- **18** metro-to-bus transfer links
- **48** bus segments
- **37** destination connections

| File | Responsibility |
|---|---|
| [`stations.json`](public/data/stations.json) | Station names, coordinates, lines, and localized names |
| [`exits.json`](public/data/exits.json) | Gate number, landmark, direction, lift, escalator, and bus relation |
| [`brts-stops.json`](public/data/brts-stops.json) | BRTS and AMTS stops, routes, coordinates, and network names |
| [`places.json`](public/data/places.json) | Destination search catalogue and coordinates |
| [`connections.json`](public/data/connections.json) | Metro, bus, transfer, walking, and auto edges |
| [`fares.json`](public/data/fares.json) | Fare slabs, speeds, wait times, and fixed bus fares |
| [`translations.json`](public/data/translations.json) | English, Hindi, and Gujarati interface strings |
| [`demo-scenarios.json`](public/data/demo-scenarios.json) | Offline route-engine scenario fixtures |

The network geometry and station naming are based on the Gujarat Metro network. Walking times, some bus times, and some exit metadata are curated approximations for this prototype and should be replaced with authoritative operator data in production.

## Offline and PWA strategy

```text
  First visit
      |
      v
  Vite-built app
      |
      v
  Service worker registration
      |
      v
  Precache: JS, CSS, HTML, JSON, SVG, fonts
      |
      v
  Airplane mode
      |
      v
  App shell opens from cache
      |
      v
  Local search + routing + map + saved journeys
```

The production build generates:

- `dist/sw.js`
- `dist/workbox-*.js`
- `dist/manifest.webmanifest`
- An installable standalone PWA manifest
- A precache containing the app shell, local datasets, fonts, and icons

No user account, analytics service, backend, map tile provider, or external routing API is required for the core experience.

## User journey

```text
Home
  ↓
Search destination
  ↓
Select destination
  ↓
Choose current location or metro station
  ↓
Compare route options
  ↓
Open route details
  ↓
Follow metro / bus / exit / walking steps
  ↓
Save journey or view it on the local network map
```

When current location is used, the app displays a confirmation toast such as:

```text
Starting station selected: Thaltej (0.6 km away)
```

This makes the GPS-to-station decision visible instead of silently choosing an origin.

## Project structure

```text
metroo-hackk/
├── index.html                  # HTML entry point
├── package.json                # Scripts and dependencies
├── vite.config.js              # React, PWA, manifest, and precache configuration
├── public/
│   ├── data/                   # Offline transit datasets
│   ├── fonts/                  # Bundled Latin, Devanagari, and Gujarati fonts
│   └── icons/                  # Local PWA icons
├── src/
│   ├── main.jsx                # React bootstrap
│   ├── App.jsx                 # Screens, interactions, route cards, map, and steps
│   ├── data.js                 # Dataset loader, search, geolocation helpers, storage
│   ├── router.js               # Graph construction, Dijkstra, itineraries, fares
│   └── styles.css              # Responsive transit design system
├── test-scenarios.mjs          # Route-engine fixture runner
├── DEMO.md                     # Presentation walkthrough
├── DEFENSE.md                  # Judge questions and technical talking points
├── JUDGE_BRIEF.md              # One-page judging brief
├── OFFLINE-TEST.md             # Offline verification procedure
└── SUBMISSION.md               # Hackathon submission summary
```

## Run locally

### Requirements

- Node.js
- npm

### Development server

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview -- --host
```

The terminal prints local and network URLs. A phone can open the network URL when it is connected to the same Wi-Fi or hotspot as the development computer.

## What a judge can try

1. Search for **MSI Service Center** and choose an origin station.
2. Compare the fastest, cheapest, and least-walking route cards.
3. Open route details and inspect the exact exit gate, landmark, bus connection, and walking steps.
4. Search for **SVP International Airport** to see a metro-plus-auto option alongside a lower-cost public-transit option.
5. Switch between English, Hindi, and Gujarati.
6. Turn off the network after the first load and repeat search, routing, details, map, and save actions.
7. Use current location and confirm which station the app selected in the toast.
8. Save a journey, refresh or reopen the app, and verify that it remains in Saved journeys.

## Verification

The production build is verified with:

```bash
npm run build
```

The build checks that React/Vite can transform the application and that the PWA plugin can generate the service worker and manifest. The route fixture runner can be used when all scenario data is present:

```bash
node test-scenarios.mjs
```

For a full airplane-mode walkthrough, see [`OFFLINE-TEST.md`](OFFLINE-TEST.md).

## Honest prototype boundaries

YatraSetu is a working journey-planning prototype, not a live operator platform. It currently does not provide:

- Live train or bus arrival feeds
- Real ticket purchase or NCMC payment integration
- Live operator disruption ingestion
- A backend account system or cloud sync
- Authoritative production-grade gate and walking data for every location

The fare-split card is an explanatory settlement model for the PS-08 concept. It estimates operator shares; it does not execute financial settlement.

## Future production path

1. Replace curated snapshots with official GTFS, station-gate, fare, and disruption feeds.
2. Add real NCMC or account-based ticketing integration.
3. Validate every exit and walking connection with operator and accessibility teams.
4. Add live service alerts while keeping the last-known dataset available offline.
5. Package the PWA as an Android application or reuse the routing/data layer in a native React Native client.

## Credits

Built for **Metro Hacks 2026** as a solo project during a Gujarat Metro journey between Mahatma Mandir and APMC.

Repository: <https://github.com/choksi2212/metroo-hackk>

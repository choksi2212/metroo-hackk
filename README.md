# Ahmedabad Transit Companion

**From destination to doorstep, even without internet.**

> Ahmedabad Transit Companion takes newcomers from any destination to the right metro station, exit, bus connection, and doorstep—even without internet.

A fully offline Progressive Web App for Gujarat Metro (Ahmedabad + Gandhinagar). Most metro apps plan **station-to-station**. This plans **destination-to-destination**: you type where you want to go — "MSI Service Center, Bodakdev" — and it tells you the nearest metro station, the exact exit gate, the BRTS/bus last-mile connection, walking distances, fare, and time. It is designed as a module that could be embedded in the official Ahmedabad Metro app.

## Why

A first-time visitor to Ahmedabad knows their **destination**, not the nearest metro station. The official app plans station-to-station journeys and ends at the station gate. The commuter's real journey continues: which exit, which side of the road, which bus, how far is the last 800 metres. On top of that, underground metro sections and moving trains mean network drops — so the whole experience must work offline.

## Features

- **Destination-first search** over a local places dataset (33 landmarks: hospitals, colleges, malls, railway stations, service centers…)
- **Nearest-station resolution** with real GPS (falls back to a demo position when denied)
- **Route engine**: Dijkstra over a multimodal graph — metro (Blue/Red/Yellow/Violet lines), BRTS (Janmarg), walking, auto
- **Three route options**: Fastest / Cheapest / Least walking
- **Exact exit gate** for every station: gate number, landmark, direction, lift/escalator availability
- **Offline schematic SVG network map** with the selected route highlighted
- **Disruption fallback (operator demo)**: mark an exit / interchange / BRTS connection unavailable → the app recalculates and explains why the fallback was chosen
- **English / हिन्दी / ગુજરાતી** language switcher — all strings and route steps localized
- **Saved journeys** persisted in localStorage, available after closing the browser
- **Zero network calls at runtime** — no Google Maps, no geocoding, no CDN, no backend. Airplane-mode safe.

## Tech

- React + Vite
- vite-plugin-pwa (service worker caches the entire app shell + data)
- lucide-react (icons bundled locally)
- localStorage for recents/saved journeys
- Plain CSS (custom transit design system — orange `#f7941e`, blue `#0072bc`, white)
- All data as local JSON in `public/data/`

## Run

```bash
npm install
npm run dev        # dev server
npm run build      # production build + service worker (dist/)
npm run preview    # serve the production build
```

For the full offline test procedure (airplane mode), see `OFFLINE-TEST.md`.
For the demo script, see `DEMO.md`.

## Data

All datasets are local, under `public/data/`:

| File | Contents |
|---|---|
| `stations.json` | 54 Gujarat Metro stations, lines, coords, Gujarati/Hindi names, accessibility |
| `exits.json` | Station gates: landmark, direction, lift/escalator, BRTS link |
| `brts-stops.json` | 36 Janmarg BRTS stops with routes |
| `places.json` | 33 demo destinations |
| `connections.json` | Metro segments, interchanges, metro↔BRTS links, BRTS segments, place walks |
| `fares.json` | Fare slabs, speeds, wait times |
| `translations.json` | EN / HI / GU strings |
| `demo-scenarios.json` | The six demo scenarios with expected routes |

Station names, line colors, interchanges and rough geometry follow the real GMRC network (Phase 1 + Phase 2, operational as of Oct 2026). Walking times, BRTS ride times and some exit-gate details are realistic approximations for demo purposes — say so if asked.

## Repo layout

```
metro-companion/
├── index.html
├── vite.config.js        # PWA + manifest config
├── public/
│   ├── data/*.json       # all offline datasets
│   └── icons/*.svg       # local PWA icons
├── src/
│   ├── main.jsx
│   ├── App.jsx           # screens + UI
│   ├── router.js         # Dijkstra route engine
│   ├── data.js           # loader, search, storage
│   └── styles.css        # design system
├── README.md
├── DEMO.md
└── OFFLINE-TEST.md
```

## Credits

Built for **Metro Hacks 2026** — a two-hour hackathon on board a running Gujarat Metro train (Mahatma Mandir → APMC → Mahatma Mandir). Solo build.

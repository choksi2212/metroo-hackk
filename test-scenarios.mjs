#!/usr/bin/env node
// =============================================================================
// test-scenarios.mjs — Ahmedabad Transit Companion: route-engine scenario tests
//
// Run:   cd "N:/HERMESSSS/metro hacksa/metro-companion" && node test-scenarios.mjs
//
// 1. Loads all 8 public/data/*.json files
// 2. Builds lookup maps (stations / brtsStops / places) exactly like src/data.js
// 3. Imports the REAL src/router.js. Plain Node rejects router.js's bare JSON
//    import (`import fares from '../public/data/fares.json'` needs
//    `with { type: 'json' }` outside Vite), so a temporary shim is written to
//    .test-tmp/router.test.mjs with ONLY that import line rewritten to an
//    absolute file URL. No app source file is modified.
// 4. Runs all 6 scenarios from public/data/demo-scenarios.json
//    (station origins -> `st:<id>`, place origins -> `place:<id>`,
//     destinations always `place:<id>`)
// 5. Asserts >= 1 route variant per scenario; prints per-leg summaries
//    (type, line, endpoints, total minutes, cost)
// 6. Explicit disruption-fallback check: Mahatma Mandir -> MSI Service Center
//    with exit 'thaltej_g1' blocked — must still route AND avoid that gate
// 7. Fare-visibility check on the MSI scenario (demo1): the fastest variant
//    must cost Rs.25-40 (metro Rs.30 + possible BRTS Rs.7 last mile)
// 8. PS-08 AMTS scenario: Mahatma Mandir -> SVP Airport — the CHEAPEST variant
//    must include a brts leg with network 'AMTS' and total cost <= Rs.50
//    (the fastest variant may be metro+auto Rs.120 — that is fine)
// 9. Verifies every id referenced by connections.json exists in the data
//    (missing links reported, not silently ignored)
//
// NOTE: router.buildGraph() destructures `exits` from its data argument and
// calls exits.find(); src/data.js's cache does NOT include that key. This test
// passes `exits: exitsArr` so the engine can be exercised; the mismatch is
// reported below as a data gap (the fix belongs in the app, not here).
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(ROOT, 'public', 'data')
const H = '='.repeat(78)
const h = '-'.repeat(78)
const dataGaps = []
const failures = []
let passedCount = 0
let totalCount = 0

// --- 1. Load all 8 data files -------------------------------------------------
const FILES = ['stations.json', 'brts-stops.json', 'places.json', 'exits.json',
  'connections.json', 'fares.json', 'translations.json', 'demo-scenarios.json']
const readJson = (f) => JSON.parse(readFileSync(path.join(DATA_DIR, f), 'utf8'))

let loaded
try { loaded = FILES.map(readJson) }
catch (e) { console.error('FATAL: loading data files —', e.message); process.exit(2) }
const [stationsArr, brtsArr, placesArr, exitsArr, connections, fares, translations, demoScenarios] = loaded
if (!Array.isArray(stationsArr) || !Array.isArray(brtsArr) || !Array.isArray(placesArr)) {
  console.error('FATAL: stations/brts-stops/places must be JSON arrays'); process.exit(2)
}

// --- 2. Lookup maps (mirrors src/data.js loadData) ----------------------------
const stations = {}; for (const s of stationsArr) stations[s.id] = s
const brtsStops = {}; for (const b of brtsArr) brtsStops[b.id] = b
const places = {}; for (const p of placesArr) places[p.id] = p
// appShapeData = exactly what src/data.js's cache looks like (no `exits` key)
const appShapeData = { stationsArr, brtsArr, placesArr, exitsArr, connections, translations, demoScenarios, stations, brtsStops, places }
// test data adds the `exits` array the router actually consumes
const data = { ...appShapeData, exits: exitsArr }

// --- 3. Import the real router via temp shim -----------------------------------
const SHIM_DIR = path.join(ROOT, '.test-tmp')
let planRoute, buildGraph, dijkstra
try {
  rmSync(SHIM_DIR, { recursive: true, force: true })
  mkdirSync(SHIM_DIR, { recursive: true })
  const routerSrc = readFileSync(path.join(ROOT, 'src', 'router.js'), 'utf8')
  const faresUrl = JSON.stringify(pathToFileURL(path.join(DATA_DIR, 'fares.json')).href)
  const importLine = /import\s+fares\s+from\s+(['"])[^'"]*fares\.json\1\s*;?/
  if (!importLine.test(routerSrc)) throw new Error("fares.json import line not found in src/router.js")
  const shimSrc = routerSrc.replace(importLine, `import fares from ${faresUrl} with { type: 'json' };`)
  const shimPath = path.join(SHIM_DIR, 'router.test.mjs')
  writeFileSync(shimPath, shimSrc)
  ;({ planRoute, buildGraph, dijkstra } = await import(pathToFileURL(shimPath).href))
} catch (e) {
  console.error('FATAL: could not load src/router.js —', e.message)
  process.exit(2)
} finally {
  rmSync(SHIM_DIR, { recursive: true, force: true }) // module already cached in memory
}

// --- helpers -------------------------------------------------------------------
const nodeName = (n) => {
  const s = String(n || '')
  const i = s.indexOf(':')
  const kind = i < 0 ? '' : s.slice(0, i)
  const id = i < 0 ? '' : s.slice(i + 1)
  if (kind === 'st') return stations[id]?.name || n
  if (kind === 'brts') return brtsStops[id]?.name || n
  if (kind === 'place') return places[id]?.name || n
  return n
}
const km1 = (x) => Math.round((x || 0) * 10) / 10

function fmtLeg(l) {
  if (l.type === 'metro') return `metro [${l.line}] ${nodeName(l.from)} → ${nodeName(l.to)} · ${l.stops} stop${l.stops > 1 ? 's' : ''} · ${km1(l.km)} km`
  if (l.type === 'brts') return `BRTS${l.routeName ? ` (${l.routeName})` : ''} ${nodeName(l.from)} → ${nodeName(l.to)}`
  if (l.type === 'walk') return `walk ${Math.round(l.walkMin || 0)} min${l.exitGate ? ` via ${l.exitGate} @ ${nodeName(l.from)}` : ''}`
  if (l.type === 'auto') return `auto ${l.autoMin} min (₹${l.autoCost})`
  return `(${l.type})`
}

// If a scenario cannot route, pinpoint the missing link.
function diagnose(originNode, destNode, disruptions) {
  const adj = buildGraph({ ...data, disruptions })
  const { dist } = dijkstra(adj, originNode, () => 1)
  const originEdges = (adj.get(originNode) || []).map(e => e.to).join(', ') || 'NONE'
  const destEdges = (adj.get(destNode) || []).map(e => e.to).join(', ') || 'NONE'
  if (!dist.has(destNode)) {
    return `unreachable — from ${originNode} (edges: ${originEdges}) Dijkstra reaches ${dist.size} node(s) but never ${destNode}; destination edges: ${destEdges}`
  }
  return `dest reachable (graph ok) — itinerary construction produced no legs`
}

function runCheck({ id, title, originNode, destNode, disruptions, extraCheck }) {
  totalCount++
  console.log(`\n[${id}] ${title}`)
  console.log(`    plan: ${originNode} → ${destNode}${disruptions && Object.keys(disruptions).length ? `  |  disruptions ${JSON.stringify(disruptions)}` : ''}`)
  let variants = null, err = null
  try { variants = planRoute(data, originNode, destNode, disruptions || {}) }
  catch (e) { err = e }
  if (err) {
    failures.push(`${id}: planRoute threw — ${err.message}`)
    console.log(`    ✗ FAIL — planRoute threw: ${err.message}`)
    return null
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    const why = diagnose(originNode, destNode, disruptions || {})
    failures.push(`${id}: no route variants (${originNode} → ${destNode}) — ${why}`)
    console.log(`    ✗ FAIL — no route variants — ${why}`)
    return null
  }
  const malformed = variants.filter(v => !v || !Array.isArray(v.legs) || v.legs.length === 0 || !Number.isFinite(v.totalMin))
  if (malformed.length === variants.length) {
    failures.push(`${id}: ${malformed.length} variant(s) returned but all malformed (empty legs or non-finite totalMin)`)
    console.log(`    ✗ FAIL — all variants malformed: ${JSON.stringify(variants).slice(0, 300)}`)
    return null
  }
  if (extraCheck) {
    const problem = extraCheck(variants)
    if (problem) {
      failures.push(`${id}: ${problem}`)
      console.log(`    ✗ FAIL — ${problem}`)
      return null
    }
  }
  passedCount++
  console.log(`    ✓ PASS — ${variants.length} variant(s)`)
  for (const v of variants) {
    console.log(`      ${v.label}: ${Math.round(v.totalMin)} min · ₹${v.cost} · walk ${Math.round(v.walkMin || 0)} min · ${v.legs.length} leg(s)`)
    v.legs.forEach((l, i) => console.log(`        ${i + 1}. ${fmtLeg(l)}`))
  }
  return variants
}

// =============================================================================
console.log(H)
console.log('AHMEDABAD TRANSIT COMPANION — route engine scenario tests')
console.log(`${H}`)
console.log(`node ${process.version} · ${FILES.length} data files · ${stationsArr.length} stations · ${brtsArr.length} BRTS stops · ${placesArr.length} places · ${exitsArr.length} exits`)
console.log(h)

// --- integrity: every id referenced by connections.json must exist -----------
const missingSeen = new Set()
const reportMissing = (file, kind, id, src) => {
  const key = `${file}:${id}`
  if (missingSeen.has(key)) return
  missingSeen.add(key)
  const m = `${file}: no ${kind} with id '${id}' (referenced by ${src})`
  dataGaps.push(m)
  console.log('  DATA GAP: ' + m)
}
for (const seg of connections.metro) {
  if (!stations[seg.from]) reportMissing('stations.json', 'station', seg.from, `connections.metro (${seg.line})`)
  if (!stations[seg.to]) reportMissing('stations.json', 'station', seg.to, `connections.metro (${seg.line})`)
}
for (const ic of connections.interchanges) {
  if (!stations[ic.stationId]) reportMissing('stations.json', 'station', ic.stationId, 'connections.interchanges')
}
for (const l of connections.metroToBrts) {
  if (!stations[l.stationId]) reportMissing('stations.json', 'station', l.stationId, 'connections.metroToBrts')
  if (!brtsStops[l.brtsId]) reportMissing('brts-stops.json', 'BRTS stop', l.brtsId, 'connections.metroToBrts')
}
for (const s of connections.brtsSegments) {
  if (!brtsStops[s.from]) reportMissing('brts-stops.json', 'BRTS stop', s.from, 'connections.brtsSegments')
  if (!brtsStops[s.to]) reportMissing('brts-stops.json', 'BRTS stop', s.to, 'connections.brtsSegments')
}
for (const pw of connections.placeWalks) {
  if (!places[pw.placeId]) reportMissing('places.json', 'place', pw.placeId, 'connections.placeWalks')
  if (pw.mode === 'brts') {
    if (!brtsStops[pw.brtsId]) reportMissing('brts-stops.json', 'BRTS stop', pw.brtsId, `connections.placeWalks (place '${pw.placeId}')`)
  } else {
    if (pw.stationId && !stations[pw.stationId]) reportMissing('stations.json', 'station', pw.stationId, `connections.placeWalks (place '${pw.placeId}')`)
  }
  if (pw.exitGate && pw.stationId && !exitsArr.some(e => e.stationId === pw.stationId && e.gate === pw.exitGate)) {
    const m = `exits.json: no exit '${pw.exitGate}' at station '${pw.stationId}' — disruption blocking cannot affect the '${pw.placeId}' walk edge`
    const key = `exit:${pw.stationId}:${pw.exitGate}`
    if (!missingSeen.has(key)) { missingSeen.add(key); dataGaps.push(m); console.log('  DATA GAP: ' + m) }
  }
}
console.log(missingSeen.size ? `  integrity: ${missingSeen.size} gap(s) found` : '  integrity: all referenced ids exist ✓')

// --- integration probe: the exact data.js cache shape (no `exits` key) --------
console.log(h)
try {
  planRoute(appShapeData, 'st:mahatma_mandir', 'place:msi_service_center', {})
  console.log("  integration probe: data.js-shaped data object works with planRoute ✓")
} catch (e) {
  const m = `src/data.js cache has no 'exits' key, but src/router.js buildGraph calls exits.find() — planRoute(data) throws "${e.message}" (routing crashes in-app). Test works around it by passing exits: exitsArr.`
  dataGaps.push(m)
  console.log('  DATA GAP (app integration): ' + m)
}

// --- 4+5. run all 6 demo scenarios --------------------------------------------
console.log(h)
console.log('SCENARIOS (from public/data/demo-scenarios.json)')
console.log(h)

// Blocked-exit assertion for the thaltej_g1 disruption scenarios
const blockedExitCheck = (variants) => {
  for (const v of variants) {
    for (const l of v.legs) {
      if (l.type === 'walk' && l.from === 'st:thaltej' && l.exitGate === 'Gate 1')
        return `variant '${v.label}' still uses blocked exit thaltej_g1 (walk via Thaltej Gate 1)`
    }
  }
  return null
}

let demo1Best = null
let demo1Variants = null
for (const s of demoScenarios.scenarios) {
  if (s.expect?.route) console.log(`\n[${s.id}] expected: ${s.expect.route}`)
  const originNode = s.originType === 'place' ? `place:${s.origin}` : `st:${s.origin}`
  const destNode = `place:${s.destination}`
  // endpoint ids must exist in the right dataset
  const originOk = s.originType === 'place' ? !!places[s.origin] : !!stations[s.origin]
  if (!originOk) {
    totalCount++
    const m = `origin id '${s.origin}' (originType=${s.originType}) not found in ${s.originType === 'place' ? 'places.json' : 'stations.json'}`
    failures.push(`${s.id}: ${m}`)
    dataGaps.push(m)
    console.log(`    ✗ FAIL — ${m}`)
    continue
  }
  if (!places[s.destination]) {
    totalCount++
    const m = `destination place id '${s.destination}' not found in places.json`
    failures.push(`${s.id}: ${m}`)
    dataGaps.push(m)
    console.log(`    ✗ FAIL — ${m}`)
    continue
  }
  const extra = s.disruptions?.exits?.includes('thaltej_g1') ? blockedExitCheck : null
  const variants = runCheck({ id: s.id, title: s.title, originNode, destNode, disruptions: s.disruptions || {}, extraCheck: extra })
  if (s.id === 'demo1') { demo1Best = variants?.[0] || null; demo1Variants = variants }
  if (s.id === 'demo5' && variants) {
    const a = JSON.stringify(demo1Best?.legs?.map(l => l.to))
    const b = JSON.stringify(variants[0]?.legs?.map(l => l.to))
    console.log(`    (best route ${a === b ? 'UNCHANGED vs demo1 baseline' : 'RE-ROUTED vs demo1 baseline ✓'})`)
  }
}

// --- 6. explicit disruption fallback check ------------------------------------
console.log(`\n${h}`)
console.log('EXPLICIT DISRUPTION FALLBACK CHECK')
console.log(h)
const fbVariants = runCheck({
  id: 'fallback-thaltej_g1',
  title: 'Mahatma Mandir → MSI Service Center with exit thaltej_g1 blocked',
  originNode: 'st:mahatma_mandir',
  destNode: 'place:msi_service_center',
  disruptions: { exits: ['thaltej_g1'] },
  extraCheck: blockedExitCheck,
})
if (fbVariants && demo1Best) {
  const a = JSON.stringify(demo1Best.legs?.map(l => l.to))
  const b = JSON.stringify(fbVariants[0]?.legs?.map(l => l.to))
  console.log(`    fallback engaged: best route ${a === b ? 'identical to undisrupted demo1 (alternative equally optimal)' : 'differs from undisrupted demo1 ✓'}`)
}

// --- 7. fare-visibility check on the MSI scenario (demo1 fastest variant) ----
console.log(`\n${h}`)
console.log('FARE-VISIBILITY CHECK (demo1: Mahatma Mandir → MSI Service Center)')
console.log(h)
totalCount++
{
  const fastest = demo1Variants?.find(v => v.label === 'fastest') || null
  if (!fastest) {
    const m = 'demo1 fare-visibility: no variant labelled fastest (labels: ' + (demo1Variants?.map(v => v.label).join(', ') || 'no variants') + ')'
    failures.push(m)
    console.log(`    ✗ FAIL — ${m}`)
  } else if (!Number.isFinite(fastest.cost) || fastest.cost < 25 || fastest.cost > 40) {
    const m = `demo1 fare-visibility: fastest variant cost ₹${fastest.cost} outside expected ₹25–40 (metro ₹30 + possible BRTS ₹7)`
    failures.push(m)
    console.log(`    ✗ FAIL — ${m}`)
  } else {
    passedCount++
    console.log(`    ✓ PASS — fastest variant cost ₹${fastest.cost} is within ₹25–40 (metro fare + possible BRTS ₹7 last mile)`)
  }
}

// --- 8. PS-08 AMTS scenario: Mahatma Mandir → SVP Airport --------------------
// The airport has no metro link: fastest is metro+auto (₹120), but the
// CHEAPEST variant must ride the AMTS bus network (network:'AMTS' legs) via
// Kalupur Railway Station → amts_cantt → amts_rakhial → amts_airport, ₹≤50.
console.log(`\n${h}`)
console.log('PS-08 AMTS SCENARIO (Mahatma Mandir → SVP Airport)')
console.log(h)
const ps08Variants = runCheck({
  id: 'PS-08',
  title: 'Mahatma Mandir → SVP Airport (AMTS bus must win on cost)',
  originNode: 'st:mahatma_mandir',
  destNode: 'place:svp_airport',
  disruptions: {},
  extraCheck: (variants) => {
    const cheapest = variants.find(v => v.label === 'cheapest')
    if (!cheapest) {
      return `no variant labelled 'cheapest' (labels found: ${variants.map(v => v.label).join(', ')})`
    }
    const amtsLegs = cheapest.legs.filter(l => l.type === 'brts' && l.network === 'AMTS')
    if (amtsLegs.length === 0) {
      return `cheapest variant has no AMTS leg — legs: ${cheapest.legs.map(l => l.type + (l.network ? `(${l.network})` : '')).join(' → ')} · ₹${cheapest.cost}`
    }
    if (!Number.isFinite(cheapest.cost) || cheapest.cost > 50) {
      return `cheapest variant rides AMTS but costs ₹${cheapest.cost} > ₹50`
    }
    return null
  },
})
if (ps08Variants) {
  const cheapest = ps08Variants.find(v => v.label === 'cheapest')
  const summary = cheapest.legs.map(l =>
    l.type === 'brts' ? `${l.network} ${nodeName(l.from)}→${nodeName(l.to)}` :
    l.type === 'metro' ? `metro[${l.line}] ${nodeName(l.from)}→${nodeName(l.to)}` :
    l.type === 'walk' ? `walk ${Math.round(l.walkMin)}min` :
    l.type === 'auto' ? `auto ${l.autoMin}min(₹${l.autoCost})` : l.type
  ).join(' → ')
  console.log(`    PS-08 cheapest legs summary: ${summary} · ₹${cheapest.cost} · ${Math.round(cheapest.totalMin)} min`)
}

// --- summary --------------------------------------------------------------------
console.log(`\n${H}`)
console.log(`RESULT: ${passedCount}/${totalCount} checks passed · ${failures.length} failure(s) · ${dataGaps.length} data gap(s)`)
for (const f of failures) console.log('  FAILED: ' + f)
for (const g of dataGaps) console.log('  DATA GAP: ' + g)
console.log(H)
process.exitCode = failures.length ? 1 : 0

// Route engine — offline Dijkstra over metro + BRTS + walk graph
// Nodes: metro stations ("st:<id>"), BRTS stops ("brts:<id>"), places ("place:<id>")
import fares from '../public/data/fares.json'

// Build adjacency from loaded datasets
export function buildGraph({ stations, brtsStops, connections, exits, places, disruptions }) {
  const adj = new Map()
  const addEdge = (a, b, w, meta) => {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push({ to: b, w, ...meta })
    adj.get(b).push({ to: a, w, ...meta })
  }

  // Disruption helpers
  const exitBlocked = (exitId) => disruptions?.exits?.includes(exitId)
  const brtsBlocked = (brtsId) => disruptions?.brts?.includes(brtsId)
  const interchangeBlocked = (stationId) => disruptions?.interchanges?.includes(stationId)

  // 1. Metro segments (minutes from km + speed)
  for (const seg of connections.metro) {
    const min = (seg.km / fares.metroSpeedKmph) * 60
    addEdge(`st:${seg.from}`, `st:${seg.to}`, min, { type: 'metro', line: seg.line, km: seg.km })
  }

  // 2. Interchanges (transfer penalty)
  for (const ic of connections.interchanges) {
    if (interchangeBlocked(ic.stationId)) continue
    // transfer is a same-node penalty — represent as self-edge weight used in path expansion
  }

  // 3. Metro ↔ BRTS links
  for (const link of connections.metroToBrts) {
    if (brtsBlocked(link.brtsId)) continue
    addEdge(`st:${link.stationId}`, `brts:${link.brtsId}`, link.walkMin, { type: 'walk', walkMin: link.walkMin })
  }

  // 4. BRTS segments
  for (const seg of connections.brtsSegments) {
    if (brtsBlocked(seg.from) || brtsBlocked(seg.to)) continue
    const network = seg.network || 'BRTS'
    const speed = network === 'AMTS' ? fares.amtsSpeedKmph : fares.brtsSpeedKmph
    const wait = network === 'AMTS' ? fares.amtsWaitMin : fares.brtsWaitMin
    const min = (seg.km / speed) * 60 + wait
    addEdge(`brts:${seg.from}`, `brts:${seg.to}`, min, { type: 'brts', km: seg.km, network })
  }

  // 5. Places: link to their walk connections from places.json + placeWalks
  for (const pw of connections.placeWalks) {
    if (pw.mode === 'brts') {
      if (brtsBlocked(pw.brtsId)) continue
      addEdge(`place:${pw.placeId}`, `brts:${pw.brtsId}`, pw.walkMin + (pw.brtsRideMin || 0), { type: 'brtsLastMile', ...pw })
    } else if (pw.mode === 'auto') {
      addEdge(`place:${pw.placeId}`, `st:${pw.stationId}`, pw.autoMin, { type: 'auto', ...pw })
    } else {
      // walking — blocked exit disallowed
      const exit = exits.find(e => e.stationId === pw.stationId && e.gate === pw.exitGate)
      if (exit && exitBlocked(exit.id)) continue
      addEdge(`place:${pw.placeId}`, `st:${pw.stationId}`, pw.walkMin, { type: 'walkLastMile', ...pw })
    }
  }

  return adj
}

// Dijkstra with path tracking. costFn(n, edge) -> cost number
export function dijkstra(adj, start, costFn) {
  const dist = new Map()
  const prev = new Map()
  const pq = [[0, start]]
  dist.set(start, 0)
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()
    if (d > (dist.get(u) ?? Infinity)) continue
    for (const e of adj.get(u) || []) {
      const c = costFn(u, e)
      if (c === null) continue
      const nd = d + c
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, { node: u, edge: e })
        pq.push([nd, e.to])
      }
    }
  }
  return { dist, prev }
}

export function reconstruct(prev, end) {
  const path = []
  let cur = end
  while (prev.has(cur)) {
    const { node, edge } = prev.get(cur)
    path.unshift({ node: cur, edge })
    cur = node
  }
  path.unshift({ node: cur, edge: null })
  return path
}

// Metro fare lookup
export function metroFare(km) {
  for (const slab of fares.metroFareSlabs) {
    if (km <= slab.maxKm) return slab.fare
  }
  return 30
}

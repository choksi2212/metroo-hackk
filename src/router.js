// Route engine — offline Dijkstra over metro + BRTS + walk graph
// Nodes: metro stations ("st:<id>"), BRTS stops ("brts:<id>"), places ("place:<id>")
import fares from '../public/data/fares.json'

// Build adjacency from loaded datasets
export function buildGraph({ stations, brtsStops, connections, exitsArr = [], places, disruptions }) {
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
      const exit = exitsArr.find(e => e.stationId === pw.stationId && e.gate === pw.exitGate)
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

// Build leg-based itinerary from a raw node path
export function toItinerary(path, { stations, brtsStops, places, exitsArr = [], disruptions }) {
  const legs = []
  let current = null
  const stName = (id) => stations[id]?.name || id
  const stGu = (id) => stations[id]?.nameGu || ''
  const placeName = (id) => places[id]?.name || id

  const nodeLabel = (n) => {
    const [kind, id] = n.split(':')
    if (kind === 'st') return stName(id)
    if (kind === 'brts') return brtsStops[id]?.name || id
    if (kind === 'place') return placeName(id)
    return n
  }

  for (let i = 1; i < path.length; i++) {
    const { edge } = path[i]
    const prevNode = path[i - 1].node
    if (!edge) continue
    const type = edge.type
    if (type === 'metro') {
      const line = edge.line
      if (current && current.type === 'metro' && current.line === line) {
        if (prevNode === `st:${current.toId}`) {
          current.to = path[i].node
          current.toId = path[i].node.split(':')[1]
        }
        current.km += edge.km
        current.stops += 1
      } else {
        if (current) legs.push(current)
        current = { type: 'metro', line, from: prevNode, fromId: prevNode.split(':')[1], to: path[i].node, toId: path[i].node.split(':')[1], km: edge.km, stops: 1 }
      }
    } else if (type === 'brts' || type === 'brtsLastMile') {
      const routeName = edge.brtsStopName || 'BRTS'
      const network = edge.network || 'BRTS'
      if (current && (current.type === 'brts' || current.type === 'brtsLastMile') && current.network === network) {
        if (prevNode === current.to) { current.to = path[i].node; current.toId = path[i].node.split(':')[1] }
        current.km += edge.km || 0
        current.stops = (current.stops || 1) + 1
      } else {
        if (current) legs.push(current)
        current = { type: 'brts', network, from: prevNode, fromId: prevNode.split(':')[1], to: path[i].node, toId: path[i].node.split(':')[1], km: edge.km || 0, stops: 1, routeName: edge.brtsStopName || null }
      }
    } else if (type === 'walk' || type === 'walkLastMile') {
      if (current) legs.push(current)
      current = null
      legs.push({ type: 'walk', from: prevNode, to: path[i].node, walkMin: edge.walkMin || Math.round(((edge.distKm || 0.3) / fares.walkSpeedKmph) * 60), distKm: edge.distKm, exitGate: edge.exitGate || null, exitId: edge.exitId || null })
    } else if (type === 'auto') {
      if (current) legs.push(current)
      current = null
      legs.push({ type: 'auto', from: prevNode, to: path[i].node, autoMin: edge.autoMin, autoCost: edge.autoCost })
    }
  }
  if (current) legs.push(current)
  return legs
}

// Full route computation: origin node -> destination node, 3 preference variants
export function planRoute(data, originNode, destNode, disruptions = {}) {
  const adj = buildGraph({ ...data, disruptions })
  const variants = []

  const baseCost = (u, e) => e.w
  const cheapCost = (u, e) => {
    if (e.type === 'metro') return e.w
    if (e.type === 'brts') return e.w * 0.7
    if (e.type === 'auto') return e.w * 3   // private vehicles priced out: the whole point of one-ticket transit
    return e.w
  }
  const walkCost = (u, e) => {
    if (e.type === 'walk' || e.type === 'walkLastMile') return e.w * 2.2
    return e.w
  }

  for (const [label, fn] of [['fastest', baseCost], ['cheapest', cheapCost], ['leastWalking', walkCost]]) {
    try {
      const { dist, prev } = dijkstra(adj, originNode, fn)
      if (dist.get(destNode) === undefined) continue
      const path = reconstruct(prev, destNode)
      const legs = toItinerary(path, data)
      if (!legs.length) continue
      variants.push({ label, legs, totalMin: dist.get(destNode) })
    } catch (err) {
      console.error('[route engine]', label, err)
    }
  }

  // Compute per-variant cost & walk minutes; dedupe
  const seen = new Set()
  const out = []
  for (const v of variants) {
    let cost = 0, walkMin = 0, metroKm = 0, brtsRides = 0
    for (const leg of v.legs) {
      if (leg.type === 'metro') { metroKm += leg.km }
      else if (leg.type === 'brts') { brtsRides += 1; cost += (leg.network === 'AMTS' ? fares.amtsFare : fares.brtsFare) }
      else if (leg.type === 'walk') { walkMin += leg.walkMin }
      else if (leg.type === 'auto') { cost += leg.autoCost }
    }
    cost += metroFare(metroKm)
    v.cost = Math.round(cost)
    v.walkMin = walkMin
    v.metroKm = metroKm
    const key = JSON.stringify(v.legs.map(l => l.type + (l.line || '') + (l.from || '') + (l.to || '')))
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

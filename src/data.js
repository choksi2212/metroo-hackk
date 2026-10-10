// Data loader — fetches all local JSON once, exposes lookup maps
let cache = null

export async function loadData() {
  if (cache) return cache
  const [stationsArr, brtsArr, placesArr, exitsArr, connections, translations, demoScenarios] = await Promise.all([
    fetch('/data/stations.json').then(r => r.json()),
    fetch('/data/brts-stops.json').then(r => r.json()),
    fetch('/data/places.json').then(r => r.json()),
    fetch('/data/exits.json').then(r => r.json()),
    fetch('/data/connections.json').then(r => r.json()),
    fetch('/data/translations.json').then(r => r.json()),
    fetch('/data/demo-scenarios.json').then(r => r.json())
  ])

  const stations = {}
  for (const s of stationsArr) stations[s.id] = s
  const brtsStops = {}
  for (const b of brtsArr) brtsStops[b.id] = b
  const places = {}
  for (const p of placesArr) places[p.id] = p

  cache = { stationsArr, brtsArr, placesArr, exitsArr, connections, translations, demoScenarios, stations, brtsStops, places }
  return cache
}

// Haversine distance in km
export function haversine(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function nearestStations(data, lat, lng, n = 3) {
  const pts = Object.values(data.stations).map(s => ({ s, d: haversine({ lat, lng }, s) }))
  pts.sort((a, b) => a.d - b.d)
  return pts.slice(0, n)
}

export function searchPlaces(data, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = []
  for (const p of data.placesArr) {
    const name = p.name.toLowerCase()
    const area = (p.area || '').toLowerCase()
    let score = 0
    if (name.startsWith(q)) score += 100
    else if (name.includes(q)) score += 60
    if (area.includes(q)) score += 30
    if (name.includes(' ' + q)) score += 20
    if (score > 0) scored.push({ p, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map(x => x.p)
}

export const RECENT_KEY = 'atc_recent_destinations'
export const SAVED_KEY = 'atc_saved_journeys'

export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
export function addRecent(placeId) {
  const list = getRecent().filter(x => x !== placeId)
  list.unshift(placeId)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)))
}
export function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}
export function addSaved(journey) {
  const list = getSaved()
  journey.savedAt = Date.now()
  list.unshift(journey)
  localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20)))
}
export function removeSaved(id) {
  const list = getSaved().filter(j => j.id !== id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}

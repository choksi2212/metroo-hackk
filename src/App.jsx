import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Search, MapPin, Navigation, Wifi, WifiOff, Clock, IndianRupee, Footprints,
  TrainFront, BusFront, ArrowLeft, ArrowRight, Globe, Bookmark, BookmarkCheck,
  Trash2, AlertTriangle, ShieldAlert, Undo2,
  ChevronRight, CircleDot, Map as MapIcon, ListChecks, RotateCcw,
  Building2, Stethoscope, GraduationCap, Plane, ShoppingBag, Landmark as LandmarkIcon,
  Store, Wrench, Cpu, X
} from 'lucide-react'
import { loadData, searchPlaces, getRecent, addRecent, getSaved, addSaved, removeSaved, nearestStations, haversine } from './data.js'
import { planRoute, metroFare } from './router.js'

const LINE_COLORS = { blue: '#0072bc', red: '#e31e24', yellow: '#f7941e', violet: '#8f4fbf' }
const LINE_NAMES = { blue: 'Blue Line', red: 'Red Line', yellow: 'Yellow Line', violet: 'Violet Line' }

const CATEGORY_ICONS = {
  railway: TrainFront, airport: Plane, college: GraduationCap, hospital: Stethoscope,
  market: Store, mall: ShoppingBag, landmark: LandmarkIcon, service: Wrench, tech: Cpu
}

export default function App() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [lang, setLang] = useState(() => localStorage.getItem('atc_lang') || 'en')
  const [online, setOnline] = useState(navigator.onLine)
  const [screen, setScreen] = useState('home') // home | search | origin | routes | details | saved | map
  const [mapFrom, setMapFrom] = useState('home') // where the map was opened from
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [origin, setOrigin] = useState(null) // {type:'station', id} | {type:'current'}
  const [routes, setRoutes] = useState([])
  const [activeRoute, setActiveRoute] = useState(0)
  const [disruptions, setDisruptions] = useState({ exits: [], interchanges: [], brts: [] })
  const [fallbackReason, setFallbackReason] = useState(null)
  const [toast, setToast] = useState(null)
  const [saved, setSaved] = useState([])
  const [currentPos, setCurrentPos] = useState(null)

  const t = useMemo(() => {
    if (!data) return {}
    return data.translations[lang] || data.translations.en
  }, [data, lang])

  const tfmt = useCallback((key, vars = {}) => {
    let s = t[key] || key
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
    return s
  }, [t])

  // Localized line name (falls back to English)
  const lineName = (l) => t?.lines?.[l] || LINE_NAMES[l]


  useEffect(() => { if (data) addRecent(selectedPlace?.id) }, [selectedPlace])
  useEffect(() => { localStorage.setItem('atc_lang', lang) }, [lang])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => { loadData().then(setData).catch(e => { console.error('load failed', e); setLoadError(e?.message || String(e)) }) }, [])
  useEffect(() => { setSaved(getSaved()) }, [screen])

  // Real geolocation only — no simulated position. If the browser can't give us a
  // fix (permission denied, no GPS, airplane mode), we surface it honestly.
  const useCurrentLocation = (callback) => {
    const finish = (pos) => {
      setCurrentPos(pos)
      setOrigin({ type: 'current' })
      if (callback) callback({ type: 'current', pos })
    }
    const fail = (msg) => {
      setToast(msg)
      setTimeout(() => setToast(null), 2600)
    }
    if (!navigator.geolocation) {
      fail(t.geoUnavailable || 'Location unavailable on this device — pick a station below.')
      return
    }
    let done = false
    const once = (fn, arg) => { if (!done) { done = true; fn(arg) } }
    // Hard deadline: never leave the user stuck on a hanging permission prompt
    const guard = setTimeout(() => once(fail, t.geoUnavailable || 'Location unavailable — pick a station below.'), 8000)
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(guard); once(finish, { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Current location' }) },
      (err) => {
        clearTimeout(guard)
        const msg = err?.code === 1
          ? (t.geoDenied || 'Location permission denied — pick a station below.')
          : (t.geoUnavailable || 'Location unavailable — pick a station below.')
        once(fail, msg)
      },
      { timeout: 7000, maximumAge: 60000 }
    )
  }

  const doSearch = (q) => {
    if (!data) return
    setQuery(q)
    setResults(searchPlaces(data, q))
    setScreen('search')
  }

  const pickPlace = (p) => { setSelectedPlace(p); setScreen('origin') }

  const planFromOrigin = (origin, posOverride) => {
    if (!selectedPlace) return
    let originNode = null
    if (origin?.type === 'station') originNode = `st:${origin.id}`
    else if (origin?.type === 'current') {
      const pos = posOverride?.pos || currentPos
      if (!pos) return
      const near = nearestStations(data, pos.lat, pos.lng, 1)[0]
      originNode = `st:${near.s.id}`
    } else if (origin?.type === 'place') originNode = `place:${origin.id}`
    if (!originNode) return

    const destNode = `place:${selectedPlace.id}`
    const variants = planRoute(data, originNode, destNode, disruptions)
    setRoutes(variants)
    setActiveRoute(0)
    setScreen('routes')
  }

  // Operator disruption demo: recalculate if route used a blocked exit/interchange
  const toggleDisruption = (kind, id) => {
    setDisruptions(prev => {
      const next = { ...prev, [kind]: prev[kind].includes(id) ? prev[kind].filter(x => x !== id) : [...prev[kind], id] }
      if (selectedPlace && routes.length) {
        // recompute
        const originNode = origin?.type === 'station' ? `st:${origin.id}` : origin?.type === 'place' ? `place:${origin.id}` : currentPos ? `st:${nearestStations(data, currentPos.lat, currentPos.lng, 1)[0].s.id}` : null
        if (originNode) {
          const variants = planRoute(data, originNode, `place:${selectedPlace.id}`, next)
          const prevBest = routes[0]?.legs
          if (variants.length) {
            const newBest = variants[0].legs
            const changed = JSON.stringify(newBest.map(l => l.to)) !== JSON.stringify(prevBest?.map(l => l.to))
            setRoutes(variants)
            setActiveRoute(0)
            setFallbackReason(changed ? 'disruption' : null)
          } else {
            setRoutes([])
            setFallbackReason('noRoute')
          }
        }
      }
      return next
    })
  }

  const saveJourney = () => {
    if (!routes[activeRoute] || !selectedPlace) return
    addSaved({
      id: `${selectedPlace.id}-${Date.now()}`,
      placeId: selectedPlace.id,
      placeName: selectedPlace.name,
      originLabel: origin?.type === 'station' ? data.stations[origin.id]?.name : 'Current location',
      lang,
      legs: routes[activeRoute].legs,
      totalMin: routes[activeRoute].totalMin,
      cost: routes[activeRoute].cost,
      label: routes[activeRoute].label
    })
    setToast(t.savedJourney || 'Journey saved')
    setTimeout(() => setToast(null), 2000)
    setSaved(getSaved())
  }

  if (!data) {
    return (
      <div className="loading">
        <div className="loading-ring" aria-label="Loading" />
        <p>{loadError ? `Data load error: ${loadError}` : 'Loading offline transit data…'}</p>
      </div>
    )
  }

  const nearbyForPlace = selectedPlace ? nearestStations(data, selectedPlace.lat, selectedPlace.lng, 3) : []

  return (
    <div className="app" data-screen={screen}>
      {/* Header */}
      <header className="header">
        {screen !== 'home' && (
          <button className="icon-btn" aria-label={t.back || 'Back'} onClick={() => {
            if (screen === 'origin') setScreen('search')
            else if (screen === 'routes') setScreen('origin')
            else if (screen === 'details') setScreen('routes')
            else if (screen === 'map') setScreen(mapFrom)
            else setScreen('home')
          }}>
            <ArrowLeft size={22} />
          </button>
        )}
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/icons/icon-192.svg" alt="" width="22" height="22" />
          </span>
          <div className="brand-text">
            <h1>{t.appName}</h1>
            <p className="tagline">{t.tagline}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`net-pill ${online ? 'net-online' : 'net-offline'}`} role="status" aria-live="polite">
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{online ? t.online : t.offline}</span>
          </div>
          <label className="lang-select" aria-label={t.language}>
            <Globe size={15} />
            <select value={lang} onChange={e => setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="hi">हिं</option>
              <option value="gu">ગુ</option>
            </select>
          </label>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff size={15} />
          <span>{t.offlineModeMsg}</span>
        </div>
      )}

      <main className="main">
        {screen === 'home' && (
          <section className="home">
            <div className="search-box" role="search">
              <Search size={20} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                onChange={e => doSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary current-btn" onClick={() => useCurrentLocation()}>
              <MapPin size={18} /> {t.useCurrentLocation}
            </button>

            {getRecent().length > 0 && (
              <div className="home-section">
                <h2><Clock size={16} /> {t.recentDestinations}</h2>
                <div className="chip-row">
                  {getRecent().map(id => data.places[id] && (
                    <button key={id} className="chip" onClick={() => pickPlace(data.places[id])}>
                      {data.places[id].name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="home-section">
              <h2><ListChecks size={16} /> {t.quickDemos}</h2>
              <div className="chip-row">
                {['msi_service_center','ahmedabad_railway_station','gujarat_university','civil_hospital','mahatma_mandir','gift_city'].map(id => data.places[id] && (
                  <button key={id} className="chip chip-demo" onClick={() => pickPlace(data.places[id])}>
                    {data.places[id].name}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-ghost map-btn" onClick={() => { setMapFrom('home'); setScreen('map') }}>
              <MapIcon size={18} /> {t.networkMap}
            </button>
            <button className="btn btn-ghost" onClick={() => setScreen('saved')}>
              <Bookmark size={18} /> {t.savedJourneys} ({saved.length})
            </button>
          </section>
        )}

        {screen === 'search' && (
          <section className="search-screen">
            <div className="search-box" role="search">
              <Search size={20} aria-hidden="true" />
              <input
                type="search"
                value={query}
                autoFocus
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                onChange={e => doSearch(e.target.value)}
              />
            </div>
            {results.length === 0 && query && (
              <p className="empty">{t.noResults}</p>
            )}
            <ul className="place-list">
              {results.map(p => {
                const Icon = CATEGORY_ICONS[p.category] || Building2
                const near = nearestStations(data, p.lat, p.lng, 1)[0]
                return (
                  <li key={p.id}>
                    <button className="place-card" onClick={() => pickPlace(p)}>
                      <span className="place-icon"><Icon size={20} /></span>
                      <span className="place-info">
                        <span className="place-name">{p.name}</span>
                        <span className="place-area">{p.area} · {near.s.name} {near.d.toFixed(1)} km</span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {screen === 'origin' && selectedPlace && (
          <section className="origin-screen">
            <div className="dest-hero">
              <h2>{selectedPlace.name}</h2>
              <p>{selectedPlace.area} · {selectedPlace.hint}</p>
            </div>
            <div className="home-section">
              <h2>{t.selectOrigin}</h2>
              <button className="btn btn-secondary full" onClick={() => useCurrentLocation((o) => planFromOrigin(o))}>
                <MapPin size={18} /> {t.useCurrentLocation}
              </button>
              <ul className="station-list">
                {Object.values(data.stations).sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                  <li key={s.id}>
                    <button className="station-row" onClick={() => { setOrigin({ type: 'station', id: s.id }); planFromOrigin({ type: 'station', id: s.id }) }}>
                      <span className="line-dots">
                        {s.lines.map(l => <span key={l} className="dot" style={{ background: LINE_COLORS[l] }} />)}
                      </span>
                      <span className="station-name">{s.name}</span>
                      <ChevronRight size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {screen === 'routes' && (
          <section className="routes-screen">
            <h2 className="sr-only">{t.routeOptions}</h2>
            {routes.length === 0 && (
              <div className="fallback-note">
                <AlertTriangle size={20} />
                <p>{t.noResults || 'No route available under current disruptions.'}</p>
              </div>
            )}
            {routes.map((r, i) => (
              <article key={i} className={`route-card ${i === activeRoute ? 'route-active' : ''}`} onClick={() => setActiveRoute(i)} onKeyDown={e => { if (e.key === 'Enter') setActiveRoute(i) }} tabIndex={0} role="button" aria-pressed={i === activeRoute}>
                <div className="route-head">
                  <span className={`route-badge route-${r.label}`}>{t[r.label] || r.label}</span>
                  <div className="route-nums">
                    <span><Clock size={15} /> {Math.round(r.totalMin)} {t.min}</span>
                    <span><IndianRupee size={14} /> {r.cost}</span>
                    <span><Footprints size={14} /> {r.walkMin} {t.min}</span>
                  </div>
                </div>
                <div className="route-lines">
                  {r.legs.map((leg, j) => {
                    if (leg.type === 'metro') {
                      return <span key={j} className="leg-chip" style={{ borderColor: LINE_COLORS[leg.line], color: LINE_COLORS[leg.line] }}>
                        <TrainFront size={13} /> {lineName(leg.line)}
                      </span>
                    }
                    if (leg.type === 'brts') return <span key={j} className="leg-chip leg-brts"><BusFront size={13} /> {leg.network === 'AMTS' ? 'AMTS' : 'BRTS'}</span>
                    if (leg.type === 'walk') return <span key={j} className="leg-chip leg-walk"><Footprints size={13} /> {t.walking}</span>
                    if (leg.type === 'auto') return <span key={j} className="leg-chip leg-auto"><Navigation size={13} /> Auto</span>
                    return null
                  })}
                </div>
              </article>
            ))}
            {routes.length > 0 && (
              <div className="route-actions">
                <button className="btn btn-primary" onClick={() => setScreen('details')}>
                  {t.routeDetails} <ArrowRight size={17} />
                </button>
                <button className="btn btn-ghost" onClick={() => { setMapFrom('routes'); setScreen('map') }}>
                  <MapIcon size={17} /> {t.showOnMap}
                </button>
                <button className="btn btn-ghost" onClick={saveJourney}>
                  <BookmarkCheck size={17} /> {t.saveJourney}
                </button>
              </div>
            )}

            <div className="demo-panel">
              <h3><ShieldAlert size={16} /> {t.disruptions}</h3>
              <p className="demo-note">Operator panel — simulate live disruptions to test fallback routing.</p>
              <div className="demo-grid">
                {(() => {
                  if (!routes.length || !routes[activeRoute]) return null
                  const legs = routes[activeRoute].legs
                  const exitLeg = legs.find(l => l.type === 'walk' && l.exitGate)
                  const stationIds = new Set()
                  legs.forEach(l => { if (l.type === 'metro') { stationIds.add(l.fromId); stationIds.add(l.toId) } })
                  const ic = data.connections.interchanges.filter(i => stationIds.has(i.stationId))
                  const brtsUsed = legs.some(l => l.type === 'brts')
                  return (
                    <>
                      {exitLeg && (() => {
                        const ex = data.exitsArr.find(e => e.stationId === exitLeg.from?.split(':')[1] && e.gate === exitLeg.exitGate)
                        const exitId = ex?.id
                        return exitId ? (
                          <button className={`demo-btn ${disruptions.exits.includes(exitId) ? 'demo-on' : ''}`} onClick={() => toggleDisruption('exits', exitId)}>
                            <X size={14} /> {t.markExitUnavailable} ({exitLeg.exitGate})
                          </button>
                        ) : null
                      })()}
                      {ic.map(i => (
                        <button key={i.stationId} className={`demo-btn ${disruptions.interchanges.includes(i.stationId) ? 'demo-on' : ''}`} onClick={() => toggleDisruption('interchanges', i.stationId)}>
                          <X size={14} /> {t.markInterchangeUnavailable} ({data.stations[i.stationId]?.name})
                        </button>
                      ))}
                      {brtsUsed && (
                        <button className={`demo-btn ${disruptions.brts.length ? 'demo-on' : ''}`} onClick={() => { const leg = routes[activeRoute].legs.find(l => l.type === 'brts'); if (leg) toggleDisruption('brts', leg.from.split(':')[1]) }}>
                          <X size={14} /> {t.markBrtsUnavailable}
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
              {disruptions.exits.length + disruptions.interchanges.length + disruptions.brts.length > 0 && (
                <button className="btn btn-ghost demo-clear" onClick={() => { setDisruptions({ exits: [], interchanges: [], brts: [] }); setFallbackReason(null); if (selectedPlace && origin) planFromOrigin(origin) }}>
                  <Undo2 size={15} /> {t.clearDisruptions}
                </button>
              )}
              {fallbackReason && (
                <p className="fallback-note" role="alert">
                  <AlertTriangle size={16} />
                  {fallbackReason === 'disruption' ? tfmt('fallbackReason', { reason: t.markExitUnavailable }) : 'No route available — clear disruptions.'}
                </p>
              )}
            </div>
          </section>
        )}

        {screen === 'details' && routes[activeRoute] && (
          <section className="details-screen">
            <h2>{t.routeDetails}</h2>
            <div className="detail-hero">
              <div className="detail-stats">
                <div><Clock size={16} /><strong>{Math.round(routes[activeRoute].totalMin)}</strong> {t.min}</div>
                <div><IndianRupee size={15} /><strong>{routes[activeRoute].cost}</strong></div>
                <div><Footprints size={15} /><strong>{routes[activeRoute].walkMin}</strong> {t.min} {t.walking}</div>
              </div>
            </div>
            <ol className="steps">
              {buildSteps(routes[activeRoute].legs, { t, tfmt, data, lang }).map((s, i) => (
                <li key={i} className={`step step-${s.kind}`}>
                  <span className="step-icon">{s.icon}</span>
                  <div className="step-body">
                    <p>{s.text}</p>
                    {s.sub && <p className="step-sub">{s.sub}</p>}
                  </div>
                </li>
              ))}
            </ol>
            {routes.length > 1 && (
              <div className="backup">
                <h3>{t.backupRoute}</h3>
                <button className="btn btn-ghost" onClick={() => { setActiveRoute((activeRoute + 1) % routes.length) }}>
                  <RotateCcw size={15} /> {t[routes[(activeRoute + 1) % routes.length].label]}
                </button>
              </div>
            )}
            <div className="fare-split" data-testid="fare-split">
              <h3>{t.fareSplitTitle || 'How the fare splits (one NCMC ticket, settled between operators)'}</h3>
              <ul>
                {(() => {
                  const legs = routes[activeRoute].legs
                  // Metro charges ONE fare for the whole journey (distance-based), not per line —
                  // the clearinghouse settles GMRC the trip fare, each bus operator per ride.
                  const metroKm = legs.filter(l => l.type === 'metro').reduce((sum, l) => sum + (l.km || 0), 0)
                  const rows = []
                  if (metroKm > 0) rows.push({ name: 'Metro (GMRC)', amt: metroFare(metroKm) })
                  const busRides = {}
                  legs.filter(l => l.type === 'brts').forEach(l => {
                    const net = l.network === 'AMTS' ? 'AMTS' : 'BRTS'
                    busRides[net] = (busRides[net] || 0) + 1
                  })
                  Object.entries(busRides).forEach(([net, n]) => rows.push({ name: net + (n > 1 ? ' ×' + n : ''), amt: (net === 'AMTS' ? 8 : 7) * n }))
                  legs.filter(l => l.type === 'auto').forEach(l => rows.push({ name: 'Auto', amt: l.autoCost || 0 }))
                  return rows.map((r, i) => (
                    <li key={i}>
                      <span>{r.name}</span>
                      <strong>₹{r.amt}</strong>
                    </li>
                  ))
                })()}
              </ul>
              <p className="fare-split-note">{t.fareSplitNote || 'Commuter pays once via NCMC; a transit clearinghouse settles each operator its leg fare. This is the PPP: the clearinghouse is privately run, operators pay per settled ticket.'}</p>
            </div>
            <div className="route-actions">
              <button className="btn btn-primary" onClick={saveJourney}>
                <BookmarkCheck size={17} /> {t.saveJourney}
              </button>
            </div>
          </section>
        )}

        {screen === 'map' && (
          <section className="map-screen">
            <h2>{t.networkMap}</h2>
            <NetworkMap data={data} route={routes[activeRoute]} origin={origin} selectedPlace={selectedPlace} t={t} />
          </section>
        )}

        {screen === 'saved' && (
          <section className="saved-screen">
            <h2>{t.savedJourneys}</h2>
            {saved.length === 0 && <p className="empty">{t.noSavedJourneys}</p>}
            <ul className="saved-list">
              {saved.map(j => (
                <li key={j.id} className="saved-card">
                  <div className="saved-head">
                    <strong>{j.placeName}</strong>
                    <button className="icon-btn" aria-label={t.remove} onClick={() => { removeSaved(j.id); setSaved(getSaved()) }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="saved-meta">{j.originLabel} → {j.placeName} · {Math.round(j.totalMin)} min · ₹{j.cost} · {t[j.label]}</p>
                  <div className="route-lines">
                    {j.legs.map((leg, k) => (
                      leg.type === 'metro' ? <span key={k} className="leg-chip" style={{ borderColor: LINE_COLORS[leg.line], color: LINE_COLORS[leg.line] }}><TrainFront size={13} /> {lineName(leg.line)}</span> :
                      leg.type === 'brts' ? <span key={k} className="leg-chip leg-brts"><BusFront size={13} /> {(leg.network === 'AMTS' ? 'AMTS' : 'BRTS')}</span> :
                      leg.type === 'walk' ? <span key={k} className="leg-chip leg-walk"><Footprints size={13} /> {Math.round(leg.walkMin)}m</span> :
                      <span key={k} className="leg-chip leg-auto"><Navigation size={13} /> Auto</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

// Build human-readable steps from legs
function buildSteps(legs, { t, tfmt, data, lang }) {
  const steps = []
  const nameOf = (node) => {
    const [kind, id] = (node || '').split(':')
    if (kind === 'st') return (lang !== 'en' && data.stations[id]?.[`name${lang.toUpperCase()}`]) || data.stations[id]?.name || id
    if (kind === 'brts') return data.brtsStops[id]?.name || id
    if (kind === 'place') return (lang !== 'en' && data.places[id]?.name) || data.places[id]?.name || id
    return node
  }
  for (const leg of legs) {
    if (leg.type === 'metro') {
      const lineName = (lang !== 'en' && data.translations?.[lang]?.lines?.[leg.line]) || LINE_NAMES[leg.line]
      const dir = directionOf(leg, data)
      steps.push({ kind: 'metro', icon: <TrainFront size={18} />, text: tfmt('stepBoard', { line: lineName, direction: dir }) })
      steps.push({ kind: 'metro', icon: <CircleDot size={16} />, text: tfmt('stepRide', { n: leg.stops, station: nameOf(leg.to) }) })
    } else if (leg.type === 'brts') {
      steps.push({ kind: 'brts', icon: <BusFront size={18} />, text: tfmt('stepTakeBus', { route: leg.routeName || 'BRTS', stop: nameOf(leg.from) }) })
      steps.push({ kind: 'brts', icon: <CircleDot size={16} />, text: tfmt('stepRideBus', { n: leg.stops, stop: nameOf(leg.to) }) })
    } else if (leg.type === 'walk') {
      if (leg.exitGate) {
        const exit = data.exitsArr.find(e => e.gate === leg.exitGate && (!leg.from || e.stationId === leg.from.split(':')[1]))
        steps.push({ kind: 'exit', icon: <Navigation size={18} />, text: tfmt('stepExitGate', { gate: leg.exitGate }), sub: exit ? `${exit.landmark} · ${exit.direction}${exit.lift ? ' · ' + t.liftAvailable : ''}` : null })
      }
      steps.push({ kind: 'walk', icon: <Footprints size={18} />, text: tfmt('stepExitWalk', { dist: `${leg.distKm ?? (leg.walkMin * 0.08).toFixed(1)} km (${leg.walkMin} min)` }) })
    } else if (leg.type === 'auto') {
      steps.push({ kind: 'auto', icon: <Navigation size={18} />, text: `Auto ${leg.autoMin} min (₹${leg.autoCost})`, sub: t.accessibleRoute ? undefined : undefined })
    }
  }
  steps.push({ kind: 'arrive', icon: <MapPin size={18} />, text: t.stepArrived })
  return steps
}

function directionOf(leg, data) {
  // Terminus direction naming: which end is farther from leg.from
  const lineStations = (data.connections.metro || []).filter(s => s.line === leg.line)
  if (!lineStations.length) return ''
  const first = lineStations[0].from, last = lineStations[lineStations.length - 1].to
  const from = leg.fromId
  if (from === first) return nameOfTerminus(last, data)
  if (from === last) return nameOfTerminus(first, data)
  // middle: pick the terminus that is not the from station — use order position
  const order = {}
  lineStations.forEach((s, i) => { order[s.from] = i; order[s.to] = i + 1 })
  return order[from] !== undefined && order[from] < lineStations.length / 2 ? nameOfTerminus(last, data) : nameOfTerminus(first, data)
}

function nameOfTerminus(stationId, data) {
  return data.stations[stationId]?.name || stationId
}

// SVG schematic network map
function NetworkMap({ data, route, origin, selectedPlace, t }) {
  const stations = Object.values(data.stations)
  const lats = stations.map(s => s.lat), lngs = stations.map(s => s.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const W = 760, H = 900, PAD = 40
  const x = lng => PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD)
  const y = lat => PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * PAD)

  const routeStations = new Set()
  if (route) {
    for (const leg of route.legs) {
      if (leg.type === 'metro') {
        const segs = data.connections.metro.filter(s => s.line === leg.line)
        // collect ordered stations between fromId and toId on that line
        const order = {}
        segs.forEach((s, i) => { order[s.from] = i; order[s.to] = i + 1 })
        const a = order[leg.fromId] ?? 0, b = order[leg.toId] ?? segs.length
        segs.forEach((s, i) => { if (i >= Math.min(a, b - 1) && i < Math.max(a, b)) { routeStations.add(s.from); routeStations.add(s.to) } })
      }
    }
  }

  return (
    <div className="map-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.networkMap} className="network-svg">
        {(data.connections.metro || []).reduce((acc, seg) => {
          const s1 = data.stations[seg.from], s2 = data.stations[seg.to]
          if (!s1 || !s2) return acc
          const onRoute = routeStations.has(seg.from) && routeStations.has(seg.to)
          if (acc.done[seg.line]) {
            const idx = acc.done[seg.line]
            acc.paths[idx].d += ` L ${x(s2.lng)} ${y(s2.lat)}`
          } else {
            acc.paths.push({ line: seg.line, d: `M ${x(s1.lng)} ${y(s1.lat)} L ${x(s2.lng)} ${y(s2.lat)}` })
            acc.done[seg.line] = acc.paths.length - 1
          }
          return acc
        }, { paths: [], done: {} }).paths.map(p => (
          <path key={p.line + p.d.slice(0, 20)} d={p.d} stroke={LINE_COLORS[p.line]} strokeWidth={routeStations.size && p.pathsInRoute ? 8 : 5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        ))}
        {/* station dots */}
        {stations.map(s => (
          <g key={s.id} className={routeStations.has(s.id) ? 'st-dot st-on-route' : 'st-dot'}>
            <circle cx={x(s.lng)} cy={y(s.lat)} r={routeStations.has(s.id) ? 7 : 5} fill="#fff" stroke={s.lines.length > 1 ? '#0f172a' : LINE_COLORS[s.lines[0]]} strokeWidth={2.5} />
            <text x={x(s.lng) + 8} y={y(s.lat) + 3.5} fontSize={11} fill="#0f172a">{s.name}</text>
          </g>
        ))}
        {selectedPlace && (
          <g>
            <circle cx={x(selectedPlace.lng)} cy={y(selectedPlace.lat)} r={7} fill="#f7941e" stroke="#fff" strokeWidth={2.5} />
            <text x={x(selectedPlace.lng) + 9} y={y(selectedPlace.lat) + 3.5} fontSize={12} fontWeight={700} fill="#b45309">{selectedPlace.name}</text>
          </g>
        )}
      </svg>
      <div className="map-legend">
        {Object.entries(LINE_COLORS).map(([k, c]) => (
          <span key={k}><i style={{ background: c }} /> {LINE_NAMES[k]}</span>
        ))}
      </div>
    </div>
  )
}

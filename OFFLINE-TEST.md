# OFFLINE TEST — airplane-mode procedure

Goal: prove the app makes **zero network requests after first cache** and every feature works offline.

## One-time preparation (online)

```bash
npm install
npm run build
npm run preview   # serves dist/ at http://localhost:4173
```

1. Open `http://localhost:4173` in Chrome/Edge while online.
2. Let it load fully, then **refresh once** (the service worker installs on first load, controls on second).
3. (Optional) DevTools → Application → Service Workers → confirm `sw.js` is *activated and running*.
4. (Optional) Application → Manifest → "Install" to add it as an app.

## Airplane-mode test

1. Open DevTools → **Network** tab → check **"Offline"** (or turn off Wi-Fi / enable airplane mode on the phone).
2. **Close the browser completely** (all tabs/processes).
3. Reopen the browser → navigate to `http://localhost:4173`.
   - ✅ App shell loads.
   - ✅ Offline banner shows: "Offline mode — using locally stored Ahmedabad transit data."
4. **Search**: type "MSI" → destination card appears.
5. **Route**: Use current location (falls back to demo position when GPS is unavailable) → 3 route options appear.
6. **Route details**: steps render with exit gate + landmark.
7. **Language**: switch to ગુજરાતી / हिन्दी → all strings re-render.
8. **Save journey** → Home → Saved journeys → present.
9. **Network map** loads (local SVG).
10. In the Network tab: **no failed requests, no pending requests** — everything served from the service worker cache.

## Disruption fallback test (also offline)

1. Plan: current location → MSI Service Center.
2. Disruptions panel → "Mark exit unavailable (Gate 1)".
3. ✅ Route recalculates, fallback reason shown.
4. Clear all disruptions → original route returns.

## Phone test (optional but impressive)

1. Serve the dev/preview build on your laptop over LAN: `npm run preview -- --host`.
2. Phone on same Wi-Fi → open the URL → allow the PWA to install ("Add to Home Screen").
3. Refresh once, then turn on **airplane mode** on the phone.
4. Open the installed app from the home screen → search + route + language all work offline.

## Checklist

- [ ] App loads with network offline
- [ ] Search works offline
- [ ] Route calculation works offline
- [ ] Route details + exit gates render offline
- [ ] Language switch works offline
- [ ] Saved journeys persist after browser restart, offline
- [ ] Network map (SVG) renders offline
- [ ] DevTools Network tab shows zero external requests
- [ ] No console errors

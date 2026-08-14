# Suhel Roadlines — Working Context

Handoff notes for the iOS 26 / Liquid Glass rebuild. Written to survive a fresh
session with no prior chat history.

---

## 1. What this app is

A React trucking/transport ERP for Suhel Roadlines. Four record types:

| Record | Key fields |
|---|---|
| **trip** | `slNumber`, `date`, `vehicleNumber`, `driverName`, `mobileNumber`, `villages[]`, `quantity`, `advanceAmount`, `vehicleType`, `strStatus` / `strNumber` |
| **vehicle** | doc id **is** `vehicleNumber`; `driverName`, `mobileNumber`, `vehicleType`, `isActive` |
| **advance** | `vehicleNumber`, `tripId`, `tripDate`, `advanceAmount`, `advanceType` (`initial` \| `additional`), `note`, `isSettled` |
| **village** | `villageName`, `isActive`, `usageCount`, `lastUsed` |

**Data quirk worth knowing:** a trip can carry *both* `strNumber` and
`strStatus` with the same `'not received'` / `'Received'` values. `strNumber` is
really an STR *status* field that was mislabelled. Always read STR state through
`isStrReceived()` in `src/services/homeService.js`, which checks both.

### Stack

React 18.3.1 (upgraded from 17 during this work — `src/index.js` uses
`createRoot`), react-router-dom 6, CRA 5 (`react-scripts`), Firebase 12,
date-fns 4, react-csv, `liquid-glass-web-react` 0.1.1 (MIT, used only for its
displacement-map maths). Node 18.20.4 per `.nvmrc`.

---

## 2. Current state

### Commits (on `master`, **not pushed**)

| SHA | Contents |
|---|---|
| `1d39c10` | iOS 26 design system, Liquid Glass primitives, RTDB-backed fast data path, and the `.app-shell > *` / CSS-import-order / segmented off-by-one fixes |
| `9f47853` | STR Status, Add Trip, Add Advance rebuilt; Firestore write-path fix |

Everything after `9f47853` is **uncommitted**: the motion system, the Settings
rewrite, and the `villageService.updateVillage` / `deleteVillage` additions.

### Screens

| Screen | File | Status |
|---|---|---|
| Home | `Dashboard/SimpleDashboard.js` | Done |
| STR Status | `STRStatus/SimpleSTRStatus.js` | Done |
| Add Trip | `AddEntry/AddEntryForm.js` | Done |
| Add Advance | `AddAdvance/AddAdvance.js` | Done |
| Settings | `Settings/SettingsPage.js` | Done, uncommitted |
| — | all of the above | reworked again: action bars moved to the nav bar, §3 |
| Reports | `Reports/ReportsPage.js` | Done — rebuilt on the design system, §3a |

### Routing

`App.js` wraps `ToastProvider` → `Router` → `AppLayout` → `Routes`. Note the
naming trap: `Simple*` means "live" for Dashboard and STRStatus, but for
AddEntry / AddAdvance / Reports / Settings the `Simple*` file is an 8-line
re-export and the real code is in the non-prefixed or `*Page` file.

| Route | Renders |
|---|---|
| `/` | `SimpleDashboard` |
| `/str-status` | `SimpleSTRStatus` — honours `?filter=due\|paid\|all` |
| `/reports` | `SimpleReports` → `ReportsPage` — honours `?range=today\|week\|month\|year` and `?tab=trips\|advances` |
| `/settings` | `SimpleSettings` → `SettingsPage` |
| `/add-entry` | `SimpleAddEntry` → `AddEntryForm` |
| `/add-advance` | `SimpleAddAdvance` → `AddAdvance` |

---

## 3. The design system — `src/ui/`

Import from the barrel: `import { Button, ListRow, Sheet } from '../../ui'`.

### Tokens — `src/styles/ios26.css`

Single source of truth. System palette, label/fill/separator ramps, iOS text
styles as `font:` shorthands (`--t-body`, `--t-headline`, `--t-large-title`…),
metrics (`--hit: 44px`, `--field-font: 16px`, `--gutter: 16px`), concentric
radii, safe-area vars, elevation, **two glass material recipes**, spring
easings, z-layer scale. Includes dark mode plus
`prefers-reduced-transparency` / `-contrast` / `-motion` overrides.

`App.js` imports one token layer now:

```js
import './styles/ios26.css';
```

`App.css` and `styles/ios-design-system.css` are **deleted** — Reports was the
last screen on them. Their two load-bearing globals, the universal
`box-sizing: border-box` and the `h1..h6 { margin: 0 }` reset, moved to
`src/index.css`; everything in `src/ui` assumes both. Deleting that sheet without
moving those first breaks every layout in the app.

### Glass — `src/ui/glass/`

`<GlassSurface as variant="regular|clear" radius capsule interactive dim>`

Three tiers from `detectGlassTier()`:

- `displacement` — backdrop refracted through `feDisplacementMap`. Chromium
  only. Gated on `CSS.supports('-webkit-app-region', 'no-drag')` because WebKit
  *parses* `backdrop-filter: url()` and silently drops it.
- `frost` — `backdrop-filter: blur/saturate/brightness`. Safari, Firefox.
- `opaque` — solid fill. Forced by Reduce Transparency.

Layer order back-to-front: refract → dim → frost → tint → specular → **content
(never filtered, so text stays crisp)**. Three displacement taps at scales
`.09 / .083 / .076` produce the chromatic fringe. Filter ids are scoped with
dimensions to defeat Safari's filter-output caching. A React context makes
nested glass render flat — Apple's no-glass-on-glass rule.

`displacementMap.js` wraps `renderDisplacementMap` from
`liquid-glass-web-react` and caches by `WxH r{radius}-{variant}-{quality}`.
We deliberately do **not** use that library's `<LiquidGlass>` lens component:
it filters *content* rather than backdrop and is size-capped in Safari.

### Components

| Module | Exports |
|---|---|
| `Button.js` | `variant="filled\|tinted\|gray\|plain\|glass"`, `size`, `role="destructive\|brand"`, `block`, `loading`, `capsule`, `icon` |
| `Field.js` | `TextField`, `NumberField`, `CurrencyField`, `PhoneField`, `DateField`, `TextArea`, `SearchField`, `Field`. `layout="stacked\|row"` |
| `Picker.js` | Replaces every native `<select>`. Trigger row + Sheet of options. `searchable`, `onCreate`, `multiple` |
| `Segmented.js` | Sliding-pill segmented control, optional per-option `count` |
| `List.js` | `ListSection` (header/footer/inset), `ListRow`, `ListLink`. **The table replacement** |
| `Display.js` | `Card`, `SectionHeader`, `Badge`, `Chip`, `Switch`, `EmptyState`, `Skeleton`, `Divider`, `Stat` |
| `Chart.js` | `BarChart`, `niceCeil`. The only chart primitive — see §3a |
| `overlay/` | `Sheet`, `ActionSheet`, `Alert`, `ToastProvider` + `useToast`, `useOverlay` |
| `chrome/` | `NavBar` (takes an optional `subtitle`), `NavButton`, `NavSearchButton`, `BackButton`, `useScrolled`, `TabBar`, `DockButton` |
| `motion/` | `RouteTransition`, `Stagger`, `Appear` |

Class prefixes: `btn26`, `fld`, `pkr26`, `seg26`, `lst26`, `card26`, `bdg26`, `cht26`,
`chp26`, `swt26`, `sht26`, `act26`, `alr26`, `tst26`, `nav26`, `tab26`,
`dock26`, `rt26`, `stg26`, `glass`.

`useToast()` returns a callable: `toast(msg, {tone, duration})`,
`toast.success()`, `toast.error()`, `toast.dismiss(id)`.

### Motion — `src/ui/motion/`

Grounded in WWDC23 *Animate with springs* and WWDC24 *Enhance your UI
animations and transitions*.

`RouteTransition` keeps **both** views mounted during a transition — that's
what gives push its continuity. Direction comes from a `ROUTE_DEPTH` map (tab
roots `0`, `/add-entry` and `/add-advance` `1`) plus `useNavigationType()`:

- deeper → **push** (incoming `100% → 0`, outgoing parallaxes to `-32%`, dims to
  `0.6` opacity)
- shallower → **pop** (exact inverse)
- same depth → **switch** (cross-fade, no travel), or pop on a real Back

Outgoing layer is `position: absolute` + `pointer-events: none` +
`aria-hidden`, dropped after 460ms.

`Stagger` uses nth-child delays capped at 7 steps and reaches rows inside
`.lst26__card`. Reduced Motion swaps all travel for cross-fades.

---

### 3a. Reports and the chart primitive

Grounded in WWDC22 [Design an effective
chart](https://developer.apple.com/videos/play/wwdc2022/110340/) and *Design app
experiences with charts*. The reasoning matters more than the markup:

- **Bars, not lines or points.** Trip data is sparse — plenty of days have no
  trips. Points make the pattern unreadable and a line over-emphasises the
  segments bridging the gaps. Bars keep zero days visible without turning them
  into a distraction, and cumulative visual weight matches the period total.
- **Dynamic upper bound, lower bound pinned to 0**, like Health's step count, so
  a bar twice as tall is twice the value. `niceCeil` picks a step from
  1/1.5/2/2.5/3/4/5/6/7.5/10 × 10ⁿ so labels stay round *and* the tallest bar
  fills at least two thirds of the height. The narrower 1/2/2.5/5/10 set rounded
  11,000 up to 20,000 and wasted half the plot.
- **~4 grid lines.** Two (floor and ceiling) leave the middle unreadable; seven
  is noise.
- **Full-height hit targets.** Each column is a real `<button>` spanning the whole
  plot height, so a short bar and the space above it are equally tappable. Arrow
  keys move the selection, Escape clears it — same experience for keyboard, Voice
  Control and Switch Control.
- **One accessibility element per data point**, labelled contextualising-value
  first, words spelled out: `"14 August, ₹8,000"`. Axis names are omitted because
  the group label already carries them.
- **The description does the work.** The hero states the take-away as a sentence
  plus one concrete number, compared against the real previous calendar period
  ("▲ 120% vs last month"), so the figure means something read on its own.
- **Selecting a bar rewrites the summary line** rather than floating a tooltip
  over the bars. Nothing is ever occluded, and it doubles as the `aria-live`
  announcement.
- Colour never carries meaning alone: selection is opacity plus the readout.

Screen order, and why each sits where it does: range control (scopes everything
below) → take-away card with the chart inside it → stat row (secondary
magnitudes) → **top vehicles by measure** (a ranking you can act on, replacing
the old dead "unique vehicles: 4") → records with a Trips/Advances segmented and
one search field → Export CSV as a closing row.

The chart has **its own window**, captioned. The Day range plots the trailing
seven days, because a one-bar chart shows no pattern; the totals above stay bound
to the selected period. Chart emptiness is judged on the chart's window, not the
period.

`BarChart` is HTML, not SVG: percentage heights mean nothing is measured, resize
costs no JavaScript, and growth/stagger are plain CSS transitions that collapse
to a cross-fade under Reduce Motion via the `--dur-*` tokens.

**Cost.** Trips, advances, vehicles and villages are read **once per mount** from
the fastSync cache; range, measure and search are all `useMemo` over that —
O(T+A) to join once, then O(T) per keystroke with no network. The old page
refetched both collections on every keystroke of its two text filters and ran the
advance join twice per load.

One naming trap fixed: the chart measure is labelled **"Trip count"**, not
"Trips", because the records section already has a Trips tab and two controls
sharing an accessible name is ambiguous.

### Edit sessions — `src/components/Layout/`

Apple's rule: a tab bar owns navigation, a toolbar owns actions for the current
context, and the two should not be stacked at the bottom of the same screen.
With a tab bar present, contextual actions belong in the **navigation bar**
([Apple Developer Forums](https://developer.apple.com/forums/thread/790916)).
Liquid Glass is also for the navigation layer only, never laid over content.

Every screen used to pin its own capsule above the tab dock, which put a second
bar of actions on the bottom edge and covered the rows underneath. That is gone.
A screen now registers an **edit session** and the nav bar takes over:

- `editSession.js` — `EditSessionContext`, held as state by `AppLayout`
- `useCommitAction.js` — the hook screens actually call

```js
useCommitAction({
  token: 'str-status',      // identifies the session; see below
  active: pending > 0,      // default true
  status: `${pending} unsaved`, // nav bar subtitle, orange dot prefixed
  commitLabel: 'Save',
  busy: saving,
  disabled: false,
  onCommit, onCancel
});
```

While a session is live the nav bar shows **Cancel** on the leading edge and the
commit button on the trailing edge; search and notifications stand down, and the
large title is suppressed. Handlers are read through a ref inside the hook, so
the identities passed into the session never change — pass whatever you like
without memoising. `token` matters because `RouteTransition` keeps the outgoing
screen mounted for ~460 ms: cleanup clears the session **only** if the token
still matches, otherwise a departing screen wipes the arriving screen's session.

| Screen | Session |
|---|---|
| STR Status | active once a row is touched. Cancel restores the loaded values from a `baseline` ref, no refetch |
| Add Trip | active always. `Save`; Cancel is `navigate(-1)` |
| Add Advance | active always. `Add`, disabled until a trip and a positive amount exist |
| Settings | none — its "Add Vehicle" capsule became an add **row** closing the Fleet section, the way Settings offers Add Account |

Both forms keep a `<button type="submit" hidden>` so keyboard submission still
works now that the visible button is outside the `<form>`, and their
`handleSubmit` tolerates being called with no event.

---

## 4. Data layer

### `src/firebase/config.js`

Config comes **only** from `.env.local` (`REACT_APP_FIREBASE_*`); nothing is
hardcoded and there is no second project anywhere in the tree. Project is
`suhail-roadlines`. `.env.example` documents the keys. **CRA reads `.env.local`
only at dev-server startup, so restart after changing it.**

The module exports exactly four bindings — `db`, `rtdb`, `isFirebaseAvailable`,
`isRealtimeAvailable`. The old `auth` / `storage` / default-`app` exports are
gone; they were null placeholders kept "so old imports keep working" and nothing
imported them.

Deployment note: `netlify.toml` intentionally carries no Firebase values. They
must be set in Netlify's own environment variables, or the deployed build falls
back to local storage and looks like an app with no data.

Firestore initialises with `persistentLocalCache` +
`persistentMultipleTabManager`, and **falls back to plain `getFirestore(app)`
if that throws** (IndexedDB unavailable: Safari private browsing, blocked
storage, some webviews). Realtime Database initialises alongside.

### `src/services/fastSync.js`

Three tiers so the UI never waits on Firestore:

| Tier | Latency | Role |
|---|---|---|
| in-memory + sessionStorage | ~0 ms | what the UI renders |
| RTDB `/cache` | ~50–150 ms | shared cache + cross-device sync |
| Firestore | ~300–900 ms | system of record |

**Writes:** memory → RTDB `/cache` + `/outbox` → Firestore → delete the outbox
entry. A failed promotion leaves the outbox entry for retry on next start
(`flushOutbox`, deferred 1.5s after load). **Reads:** stale-while-revalidate.
Dates are serialised to ISO strings for RTDB, so consumers must handle both
Timestamp and string — use `toDate()` from `homeService`.

RTDB rules live in `database.rules.json` (deploy with
`firebase deploy --only database`). **They are wide open, and the app has no
authentication at all** — anyone with the URL has full read/write. Flagged to
the user; not yet addressed.

### `src/services/firebaseService.js`

Public API unchanged, but reads route through `fastSync.readCollection` and
writes through `fastSync.writeRecord`. Every method guards on
`checkFirebaseAvailability()` and falls back to
`src/services/localStorageService.js`.

`getTripsByDateRange` now filters the cached list client-side instead of
querying Firestore. `dashboardService.getTodayMetrics` derives from the cache
instead of three separate queries.

### `src/services/homeService.js`

`getHomeSummary()` for the home screen, plus shared helpers: `toDate`,
`isStrReceived`, `relativeDayLabel`, `formatINR`, `formatCompactINR`.

---

## 5. Bugs found and fixed (do not reintroduce)

1. **`.app-shell > * { position: relative }`** — same specificity as
   `.tabdock26 { position: fixed }` but later in source order, so it silently
   overrode it. The tab dock and both overlays fell into normal flow at the
   bottom of the document. Fixed by moving the background wash to
   `z-index: -1`; no child needs a `position` override.
2. **CSS import order** — legacy sheet loaded after `ios26.css` and overrode
   everything, including `body { background }`.
3. **Segmented / TabBar off-by-one** — both measured
   `list.children[activeIndex]`, but the sliding pill *is* `children[0]`, so
   selection landed one tab off. Both now query `[role="tab"]`. There is a test
   asserting the pill really is `children[0]`, specifically to fail if anyone
   reverts this.
4. **TabBar false Home highlight** — `Math.max(0, findIndex)` turned `-1` into
   `0`. Now `-1` hides the pill.
5. **Firestore never initialised** — `persistentLocalCache` threw and the catch
   set `db = null`. Reads degraded quietly to localStorage so the app *looked*
   fine; every write died with *"Expected first argument to collection() to be a
   CollectionReference"*. Fixed with the `getFirestore` fallback **and** by
   adding availability guards to the write paths (`addTrip`, `addVehicle`,
   `addVillage`, `updateTrip`, `updateSTRStatus`, `updateVillageUsage`,
   `getNextSlNumber`); `newId()` no longer dereferences a null `db`.
6. **`villageService.updateVillage` / `deleteVillage` never existed**, yet old
   SettingsPage and VillageList both called them — every village edit and
   delete threw and was swallowed. Both added; delete is a soft delete
   (`isActive: false`), matching vehicles.
7. **Add Advance had a date hardcoded to `'2025-08-31'`** and an N+1 per-trip
   advance fetch. Both fixed.
8. Sub-16px inputs (caused iOS focus zoom), `transform` on `:focus` (caret
   jitter), autocomplete dropdowns that never closed on outside tap.
9. **"Firebase config incomplete" with a correct `.env.local`.** The dev server
   was started *before* `.env.local` was written, and CRA inlines
   `process.env.*` at server start. Diagnose it by grepping the served bundle
   rather than trusting the file:
   `curl -s localhost:3000/static/js/bundle.js | grep -c <projectId>` → 0 means
   restart. Fixing this is what made `isFirebaseAvailable` true again.
10. **Reports, from the old implementation.** All fixed in the rebuild, none to
    be reintroduced: the STR `<select>` was bound to `strNumber`, so editing "STR
    Status" corrupted the STR number and changed nothing the table displayed; the
    Advances column rendered `advanceAmount` while the summary card and the CSV
    used `totalAdvances`, so the row and the total disagreed; `advanceCount`
    double-counted whenever a real initial advance existed; villages could only be
    removed in the edit modal, never added, and validation then refused to submit;
    the Advances tab ignored the vehicle and village filters; trips were filtered
    on `date` but advances on `createdAt`, so a late-logged advance silently left
    the totals; `new Date('yyyy-MM-dd')` parsed as UTC and shifted the start
    boundary a day in IST; `csvData` was never cleared when the trip list emptied,
    so the export went stale; and `avgAdvancePerTrip` was computed but never
    rendered.
11. STR's date-range chip was 32px tall — under the 44pt minimum. It now expands
    its hit area with `::after { inset: -5px -6px }` rather than growing the
    chip, and carries a chevron so it reads as opening something.

---

## 6. Outstanding work

### Next: delete the orphans

Every screen is on the design system and the legacy sheet is gone, so what
remains is dead code. These are all unreachable, none is in the build graph, and
they are the only reason eslint still reports errors:

```
Layout/SimpleLayout.js + .css      Dashboard/Dashboard.js
Reports/Reports.js + .css          Settings/Settings.js + .css
STRStatus/STRStatus.js + .css      AddEntry/AddEntry.js + .css
AddAdvance/AddAdvanceForm.js + .css
Settings/VillageList.js + .css     (orphaned by the Settings rewrite)
src/assets/css/framework7-bundle.css  (~20k lines, imported nowhere)
```

`Common/Toast.js` + `.css` can go with them: the legacy Toast is imported only by
orphans now, and every live screen uses `useToast`.

Then drop `framework7`, `framework7-react`, `framework7-icons` and
`skeleton-elements` from `package.json`.

`src/App.test.js` is untouched Create React App boilerplate asserting a "learn
react" link this app has never had. It has failed since the initial commit and is
the only reason `npm test` comes back red. Delete it or replace it with a real
test.

### Then: final verification

Production build clean, eslint clean on the live tree, render tests across all
converted screens.

### The data situation

`suhail-roadlines` was **completely empty** — Firestore `trips` / `vehicles` /
`advances` / `villages` all returned `{}`, and RTDB `/` returned `null`. That was
why every screen and every date range showed nothing; not a query bug.

Any historical records lived in an earlier Firebase project that was deleted
long ago. It is unreachable and **not recoverable** — treat `suhail-roadlines` as
the only data source and don't go looking for the old one.

Current contents are mock records seeded via the Firestore REST API: 4 vehicles,
7 villages, 13 trips (9 this month, 4 last month; 8 STR due / 5 received) and 16
advances. Trip and advance ids are `mock_`-prefixed so they can be deleted in one
pass. Note `getAllTrips` uses `orderBy('createdAt')`, and Firestore silently
omits documents missing that field — any seeded trip must set it.

STR state is written to `strStatus` **and** `strNumber` together, because
`isStrReceived()` reads both.

### Known risks not yet addressed

- **No authentication.** Firestore and RTDB are world-readable/writable.
- **Silent split-brain.** The localStorage fallback means a failed save writes
  locally and can diverge from Firestore. Better to fail loudly once the root
  cause is confirmed.
- Displacement glass is Chromium-only and unmeasured on a real device. The user
  chose displacement over frost-only; performance on mid-range Android is
  unverified.

---

## 7. Conventions

- **Verify before claiming done:** `npx react-scripts build` must print
  *Compiled successfully*, and `npx eslint <paths>` must be clean for files in
  the live tree.
- Temporary tests are written as `src/__verify__.test.js`, run with
  `CI=true npx react-scripts test --testPathPattern="__verify__"`, then
  **deleted**. CRA sets `resetMocks: true`, so mock implementations must be
  attached in `beforeEach`, not in the `jest.mock` factory.
- jsdom does not apply stylesheets. CSS-dependent claims are verified by
  grepping the compiled CSS in `build/static/css/`, not by computed style.
- Screen CSS files hold **layout only**; every element comes from `src/ui`.
- **No screen pins its own action bar.** The tab dock owns the bottom edge. A
  screen's commit action goes to the nav bar via `useCommitAction` — see §8.
- No `window.confirm` / `window.alert`. Use `Alert` or `ActionSheet`.
- Never let an input fall below `--field-font` (16px).

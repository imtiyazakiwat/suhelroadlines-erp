# Suhel Roadlines — Working Context

Handoff notes for the iOS 26 / Liquid Glass rebuild. Written to survive a fresh
session with no prior chat history.

---

## 0. How to build in this app — read this before writing any UI

This app is held to Apple's standard, not to "looks modern". Every screen here
was rebuilt by working from Apple's own guidance and justifying each element.
Anything added later has to clear the same bar, or the app goes back to feeling
like a web page wearing an iOS costume.

### The process, in order

1. **Consult the source first.** Find the relevant Apple material before
   designing: the [Human Interface
   Guidelines](https://developer.apple.com/design/human-interface-guidelines/),
   the WWDC design sessions, and the platform behaviour of a first-party app that
   already solves the problem (Settings, Health, Stocks, Reminders, Wallet,
   Calendar). Note *what* it says and where. The HIG pages are JS-rendered and
   often unreadable to a fetcher — search for the guidance, and prefer the WWDC
   session transcripts, which are plain text and more specific.
2. **State the screen's job in one sentence.** If you cannot, the screen is doing
   two jobs and should be two screens.
3. **For every single element, answer four questions and write the answer down
   as a comment:**
   - *Why does this exist?* What question does the user have that this answers?
   - *Is it needed?* What breaks if it is deleted? "It looks empty otherwise" is
     not a reason. A number nobody can act on is worse than no number.
   - *Why here?* Position is an argument about priority. Justify the order.
   - *What does it cost?* Renders, network calls, complexity, and the attention
     it takes from whatever it sits next to.
4. **Choose the form from the data, not from taste.** The Reports chart uses bars
   because the trip data is sparse and lines over-emphasise the gaps — that is a
   decision derived from the data shape, and it is the kind of reasoning expected
   here. Test designs against real and awkward data early: empty, one row,
   hundreds of rows, missing fields, very long names.
5. **Justify motion the same way.** Animation must communicate something —
   direction of travel, that bars are anchored at zero, that a value changed.
   Decoration that communicates nothing gets cut. All timing comes from the
   `--dur-*` / `--ease-*` tokens, which collapse under Reduce Motion for free.
6. **Design the non-visual version at the same time.** For everything shown
   visually, decide how it reads to VoiceOver and how it works from a keyboard.
   Not afterwards — the accessible structure usually improves the visual one.
7. **Verify, then claim.** See §7.

### iOS interaction psychology that keeps coming up

- **Content is the interface.** Chrome floats above content and never
  permanently covers it. Liquid Glass belongs to the navigation layer only, never
  to content itself.
- **Recognition over recall.** Show the options; don't make people remember them.
  This is why every `<select>` became a `Picker` with searchable options, and why
  village codes are visible on the rows rather than memorised.
- **Progressive disclosure.** Show the summary, let people drill in. A phone
  cannot show ten columns, so a row plus a detail sheet beats a table every time.
- **Direct manipulation with immediate feedback.** Press states are instant
  (scale + dim, never a colour change). Optimistic UI where a write is likely to
  succeed, with an honest failure path — never a success message for something
  that did not happen.
- **Recoverability.** Destructive actions confirm; edits can be cancelled; a
  failed save keeps the user's input. Never lose typed work.
- **Respect the thumb.** 44pt minimum targets, primary actions within reach,
  hit areas grown past the paint box rather than inflating the visual control.
- **Fewer, clearer choices.** Every extra control costs a decision. Four range
  options beat eight.
- **Never invent content.** The home screen once advertised "4% diesel cashback"
  that did not exist. Fake data, fake offers and placeholder metrics are worse
  than blank space because they teach people to distrust the screen.

### Hard rules, learned the hard way

Each of these came from a real bug in this repo. Breaking one reintroduces it.

- The tab bar owns the bottom edge. **A screen never pins its own action bar
  there** — contextual actions go to the nav bar via `useCommitAction` (§3).
- **No `window.confirm` / `window.alert`.** Use `Alert` or `ActionSheet`.
- Never let an input fall below `--field-font` (16px), or iOS zooms on focus.
- No `transform` on `:focus` for text inputs — the caret jitters.
- **Normalise input on the way in, not at save time.** If you uppercase a vehicle
  number when saving, the screen and the database disagree. See
  `src/services/textService.js`.
- **Optional fields must be genuinely optional.** Validate format only when a
  value is present. A missing phone number must never block a whole trip.
- Screen CSS is **layout only**; every element comes from `src/ui`.
- Sheets do not open sheets as a navigation device — push a route instead (§3b).
- Glass on glass renders flat. Don't nest it.
- Prefer deriving state with `useMemo` over refetching. Reads happen once per
  mount; filtering is local.

### Anti-patterns this codebase has already been cured of

Watch for these in anything new: a metric that is computed but never rendered;
two places showing the same quantity from different fields; a count where a
ranking would be actionable; a filter that applies to one tab but not its
sibling; a `<table>` on a phone; refetching on every keystroke; success toasts on
failed writes; and unreachable UI for a state the data layer filters out.

---

## 1. What this app is

A React trucking/transport ERP for Suhel Roadlines. Four record types:

| Record | Key fields |
|---|---|
| **trip** | `slNumber`, `date`, `vehicleNumber`, `driverName`, `mobileNumber`, `villages[]`, `quantity`, `advanceAmount`, `vehicleType`, `strStatus` / `strNumber` |
| **vehicle** | doc id **is** `vehicleNumber`; `driverName`, `mobileNumber`, `vehicleType`, **`isOwn`**, `isActive` |
| **advance** | `vehicleNumber`, `tripId`, `tripDate`, `advanceAmount`, `advanceType` (`initial` \| `additional`), `note`, `isSettled` |
| **village** | `villageName`, **`code`**, `isActive`, `usageCount`, `lastUsed` |

`driverName` **and** `mobileNumber` are **both optional** on trips and vehicles.
A vehicle is regularly booked before the driver is assigned, and the app used to
refuse the whole record over a missing name.

`isOwn` marks the firm's own lorries apart from hired ones. Boolean, not an enum,
because the only question is "is this mine". Read it as **`vehicle.isOwn === true`
everywhere**: it defaults to `false` and existing records have no such field, so a
missing value means "never marked", which must not be shown as ownership nobody
entered.

Village `code` is the short
form used on paperwork; it is uppercase, unique, and suggested from the name.
**Trips store village *names*, not codes**, so no migration was needed — the code
is resolved for display from the villages list.

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
| Settings | `Settings/SettingsPage.js` + `VehiclesPage.js` + `VillagesPage.js` + `DataPage.js` | Done — split into pushed screens, §3b |
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
| `/settings` | `SimpleSettings` → `SettingsPage` — navigation only |
| `/settings/vehicles` | `VehiclesPage` — pushed, depth 1 |
| `/settings/villages` | `VillagesPage` — pushed, depth 1 |
| `/settings/data` | `DataPage` — pushed, depth 1. Counts and pruning, §3c |
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
| `Picker.js` | Replaces every native `<select>`. Trigger row + Sheet of options. `searchable`, `onCreate`, `multiple`, `summary` (overrides the trigger text — use it when the chosen values are rendered next to the picker, so the row does not restate "2 selected" above the two chips it counts) |
| `Segmented.js` | Sliding-pill segmented control, optional per-option `count` |
| `List.js` | `ListSection` (header/footer/inset), `ListRow`, `ListLink`. **The table replacement** |
| `Display.js` | `Card`, `SectionHeader`, `Badge`, `Chip`, `Switch`, `EmptyState`, `Skeleton`, `Divider`, `Stat` |
| `Chart.js` | `BarChart` (plus `compact` trend-platter mode), `niceCeil`. The only chart primitive — §3a |
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

**`compact` mode** is the trend-platter treatment used by Health's preview
charts: no grid, no axis, not interactive, and the whole strip is a single
labelled `role="img"` rather than one accessibility element per bar — because it
is a preview of a real chart elsewhere, and a screen reader should not have to
walk seven values for a decoration. The Home month card uses it.

Home's month card replaced a **"Save on Diesel Expenses — Get 4% Cashback"**
promo tile. That offer did not exist and nothing was redeemable; it occupied the
most prominent slot on the app's first screen. The replacement shows the month's
advance total, the trip count, a delta against last month, and a seven-day
sparkline, and taps through to `/reports?range=month`. It summarises and drills
in — the widget contract — rather than trying to analyse on the home screen.
`homeService.getHomeSummary()` computes it in the pass it already makes, so it
costs no extra reads. `deltaPct` is `null`, not `0`, when there is no baseline: "0%
vs last month" would claim a comparison that was never made.

### 3b. Settings, and why sheets stopped nesting

`/settings` is navigation only. Vehicles and villages are managed on **pushed
routes** — `/settings/vehicles`, `/settings/villages` — registered in
`ROUTE_DEPTH` at depth 1 so `RouteTransition` pushes them, with titles in
`AppLayout`'s `TITLES` map so the Back button appears.

It used to open a manager sheet from the Settings list and then an editor sheet
*from inside that sheet*. Apple's own Settings never does this: Settings > Mail >
Accounts > Add Account is a navigation stack. Pushing gets a real Back button,
working browser back, deep links, and one modal layer at a time.

The add action is a row that **closes** the list — the "Add Account" pattern —
not a floating button and not a nav bar plus.

`vehicleService.getAllVehicles(includeInactive)` and
`villageService.getAllVillages(includeInactive)` default to hiding inactive
records, because a picker should only offer things you can dispatch. The
management screens pass `true`. Before that flag existed, deactivating a vehicle
made it vanish from Settings as well, and the "Inactive" badge in that list was
unreachable code.

### 3c. Own vehicles, removal, and pruning

**Own vs hired.** `/settings/vehicles` splits the list into **My vehicles** and
**Other vehicles** rather than growing a second filter. Recognition over recall:
both groups stay on screen, so "how many of these are mine" needs no tap, and a
segmented control would have hidden one group behind the other while competing
with the status filter directly above it for meaning. An empty group is dropped —
a header over blank space implies records that are not there. The trip and
advance pickers sort own vehicles first and mark them `My vehicle` in the
subtitle; the marker is not in the label because the label must stay exactly the
number, and the Picker matches typed text against both, so typing "my" filters to
the own fleet.

**Removal is two actions, offered from one row.** They were the same button, which
is the whole reason "delete not working" was reported: `Remove vehicle` set
`isActive: false`, so a vehicle the user had asked to get rid of kept appearing
forever. Now `Remove vehicle…` opens an ActionSheet, reversible option first:

| Action | Service | Effect |
|---|---|---|
| Deactivate / Reactivate | `deactivateVehicle` | `isActive` flag, applied immediately, stays in the cache and in Settings under Inactive |
| Delete Permanently | `deleteVehicle` | second confirmation, then a real Firestore delete |

Trips and advances are never cascaded. They store the vehicle *number* as a
string, so history outlives the vehicle record, and cascading would destroy the
books to tidy a list. Villages work identically (`deactivateVillage` /
`deleteVillage`), and deactivated villages are now **listed** on their screen with
an inactive subtitle — they used to be filtered out, which made deactivation a
one-way door and the badge unreachable code.

**Pruning — `/settings/data` + `src/services/dataService.js`.** Modelled on
Settings > General > Transfer or Reset iPhone: counts, then reset options in red,
on a screen you navigate to on purpose. Two scopes, narrower first, because
clearing a season of records while keeping the fleet is the routine operation:
`Delete Trips & Advances` (trips + advances + tripAdvances, one confirmation) and
`Delete All Data` (adds vehicles + villages, **two** confirmations, because it is
irreversible, unbacked, and lands on every device sharing the database).

Deleting has to happen in all four places or the records come back, in this order:

1. Firestore, in `writeBatch` chunks of 400 (the cap is 500)
2. RTDB `/cache/<col>`
3. RTDB `/outbox/<col>` — miss this and `flushOutbox` faithfully re-promotes
   exactly what was just deleted
4. memory + `sessionStorage` `srl_fast_*` + `localStorage` `suhelroadline_*`

2-4 are `fastSync.clearCollection`, which is new and also the honest way to
recover from a poisoned cache without touching the system of record. It clears
memory *first*, because `ensureSubscription` ignores empty RTDB snapshots and
would otherwise leave the in-memory copy standing. Firestore goes first overall so
a half-run leaves stale caches rather than a record resurrected from a cache into
an empty Firestore. Counts report `null`, never `0`, when a read failed — on a
screen whose next button is irreversible those two must not look the same.

### 3d. Add Trip, and what makes it fast

Screen's job: record one trip in as few decisions as possible, and keep the
vehicle and village books up to date as a side effect of doing so.

**Two required fields**, and only two: which vehicle, and where it is going.
Everything else defaults (SL number, date, type, STR status) or is optional
(driver, mobile, quantity, advance). The STR-status and vehicle-type validations
that used to sit alongside them could never fire — both come from a Segmented
control that is always on one of its options, and both default again in the
service — so they were dead strings on a form filled in twenty times a day.

**Vehicle number.** A searchable `Picker` with `onCreate`, so an unknown number is
typed straight into the search field and added from the row beneath it. The create
row says **Add**, not "Use": the label has to describe the consequence, or the
automatic save is a surprise rather than a convenience. Picking a known vehicle
carries its driver, mobile **and type** across; typing an unknown number
**clears** the driver fields, because otherwise the previously picked vehicle's
driver rode along and got saved onto the new one.

**Villages.** Chips are the value, and the picker row beneath them is the action —
Calendar's shape for guests. Multi-select keeps the sheet open, so a three-village
route is one visit. A village typed in is created immediately (Title Cased, with a
code suggested from the name) so the chip is real; a village chosen has its
`usageCount` bumped, which is what keeps the list ordered by what you actually
use.

**The advance is part of the trip.** `tripService.addTrip` writes an `initial`
advance in the same pass when an amount is present, which is the whole reason the
field is on this form: the ledger and Reports stay correct without a second visit
to Add Advance. The section footer says so, and changes when an amount is entered.

**What gets saved automatically, and when.** Villages on entry; the vehicle when
the trip is saved, so an abandoned form leaves no vehicle behind. The vehicle
upsert only writes values that are **present and different**, and never sends
`isOwn` — a merge would otherwise reset ownership every time a trip was logged.
The book-keeping runs in its own `try`: the trip is already committed by then, so a
failure reports "Trip saved. The vehicle list could not be updated." rather than
the outer catch's "Could not save the trip", which was a lie about a record that
was on file.

**Errors belong to fields, not to section footers.** A `Field`/`Picker` renders
its own `error` next to the input and sets `aria-invalid`; the section footer
carries the persistent hint. Passing the error to both printed every message
twice, one line apart, and pushed the hint off screen exactly when it mattered.

### Input normalisation — `src/services/textService.js`

Every form goes through it, so all screens behave identically:
`normaliseVehicleNumber` (uppercase, keeps the separators people type),
`formatVehicleNumber` (uppercase **and trimmed**),
`titleCase` / `normaliseVillageName`, `normaliseVillageCode` (A–Z0–9, max 6),
`suggestVillageCode` (first three letters, then a numeric suffix to avoid
collisions), `sameText` (case-insensitive compare), `isValidMobile` /
`mobileError` (**empty is valid**).

Normalisation happens **as you type**. Correcting silently at save time shows the
user one value and stores another. Village names are matched case-insensitively,
which is what stops "bagalkot" and "Bagalkot" both appearing in the picker.

The two vehicle-number helpers are not interchangeable.
`normaliseVehicleNumber` deliberately keeps a **trailing space** so you can keep
typing — right for a field, wrong for anything else. `formatVehicleNumber` trims,
and is what belongs at the two points where the value stops being editable:

- **saving**, because the vehicle number is the Firestore document *id*, so
  `"KA 01 "` and `"KA 01"` would be two vehicles neither of which could be
  reconciled with the other. Every save path now uses it;
- **displaying**, because records written before normalisation existed are still
  mixed case. Uppercasing on read rather than migrating is deliberate: the doc id
  *is* the number, so normalising stored keys means copy-and-delete per record,
  not an update. Display sites: `VehiclesPage`, `ReportsPage` (rows, detail,
  top-vehicles, CSV, delete confirmation), `SimpleSTRStatus`, `SearchOverlay`,
  `NotificationsSheet`, `homeService` reminders, and both vehicle pickers.

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
| Vehicles / Villages / Data | none — sheets and alerts own their own commits |

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
`clearCollection` wipes a collection out of every tier below Firestore; see §3c
for why it clears memory before the RTDB node.
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

**Every mutation must go through `fastSync`.** A raw `updateDoc` is invisible to
the UI, because reads come from the cache tiers and a Firestore-only write leaves
all three holding the old record. Two vehicle methods were doing exactly that; see
§5.14. Use `setDoc(..., { merge: true })` rather than `updateDoc` for updates: the
document may exist only in the cache or the outbox (normal for a record added
seconds earlier, since `addVehicle` resolves on the RTDB write), and `updateDoc`
throws `not-found` on it while a merge creates it.

### `src/services/dataService.js`

Counting and bulk deletion — `getDataFootprint`, `pruneCollections`,
`pruneRecords`, `pruneAllData`. See §3c. Nothing else in the app deletes in bulk.

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
11. **Tapping a sheet's header button dismissed the sheet.** This is what "the
    add buttons are broken" was. The drag-to-dismiss handlers live on
    `.sht26__grip`, which **wraps the header actions**, and `onPointerUp`
    dismissed on velocity alone with no minimum distance: ~8px of finger drift
    over ~15ms is 0.53 px/ms, over the 0.5 threshold. So a tap on Add or Save
    closed the sheet instead of running the action. Mouse clicks have no drift,
    which is why it only ever reproduced on touch. Fixed three ways in
    `Sheet.js`: a press starting on an interactive element is never a drag, a
    `DRAG_SLOP` floor of 10px must be exceeded before velocity counts, and
    `setPointerCapture` guarantees `pointerup` arrives (without it a pointer that
    slid off the grip left the gesture stuck active and the panel frozen mid-drag,
    which also read as "the button did nothing").
12. **Stacked overlays fought each other.** Every open overlay put a
    capture-phase Escape listener on `document`, and `stopPropagation()` does not
    stop sibling listeners on the same node — so Escape collapsed the whole stack.
    Each also ran its own focus trap, so a background sheet would pull focus out
    of the foreground one. And all overlays shared `--z-sheet`, leaving stacking
    to portal mount order. `useOverlay` now keeps a stack, returns
    `{ panelRef, depth }`, and gives the topmost overlay exclusive Escape, focus
    trapping and autofocus; `depth` drives
    `z-index: calc(var(--z-sheet) + var(--ovl-depth) * 10)` and a lighter,
    unblurred scrim for nested layers (two full-strength scrims read as ~56%
    black and stack two backdrop filters).
13. STR's date-range chip was 32px tall — under the 44pt minimum. It now expands
    its hit area with `::after { inset: -5px -6px }` rather than growing the
    chip, and carries a chevron so it reads as opening something.
14. **"Vehicle delete not working."** Three faults stacked, all in
    `vehicleService`. (a) `updateVehicle` and `deleteVehicle` called `updateDoc`
    **directly, bypassing fastSync** — so the caches (memory, `sessionStorage`,
    RTDB `/cache/vehicles`) kept the old record and the list re-rendered the row
    you had just changed or removed. (b) `updateDoc` throws `not-found` when the
    document exists only in the cache or outbox, which is the normal state for a
    vehicle added seconds earlier, since `addVehicle` resolves on the RTDB write.
    (c) neither had a `checkFirebaseAvailability()` guard, so with Firestore
    unavailable they called `doc(null, …)` and the raw Firebase error surfaced as
    "Could not save the vehicle". All three fixed: both go through
    `fastSync.writeRecord` / `removeRecord`, updates use
    `setDoc(..., { merge: true })` so a cache-only document is created rather
    than throwing, and both guard and fall back to `localVehicleService` (which
    had no `deleteVehicle` at all, and ignored `includeInactive`, so deactivating
    in fallback mode hid the record from the screen that manages it).
15. **`deleteVehicle` was a soft delete wearing a delete label** — it set
    `isActive: false` and nothing else, so a vehicle the user had asked to remove
    kept appearing forever with no way to get rid of it. Deactivation is now its
    own action and delete really deletes. `villageService.deleteVillage` was worse:
    `removeRecord` (which queues `op: 'delete'`) paired with a Firestore write that
    only flagged `isActive`, so the row vanished from the cache and returned on the
    next revalidation.
16. **The outbox promoters for vehicles and villages had no delete branch.** A
    queued delete was replayed as `setDoc(id, entry.data, { merge: true })` with
    `entry.data` set to `null` — which throws, sticks in the outbox forever, and
    would resurrect the record if it ever succeeded. Only trips handled it. All
    four now share `promoteDeleteOr(collection)`.
17. **The trip forms merged blanks over the vehicle book.** Both Add Trip and the
    Reports trip editor compared `existing.driverName !== formData.driverName` and
    then wrote the form's values over the record. With the driver fields optional
    that compares `undefined` against `''` — true on every save — and merged an
    empty name over a real one. They now write only values that are present and
    genuinely different. The same block also omitted `vehicleType` sometimes, and
    `addVehicle` defaults a missing type to `'lorry'`, so saving a trip for a
    tempo silently reclassified it; the type is now prefilled from the picked
    vehicle and always sent.
18. **`Picker` showed its placeholder for a value it had just created.** The
    trigger renders `options.find(o => o.value === value)?.label`, and a typed-in
    vehicle number is not in the list — so entering a new vehicle left the field
    reading "Select vehicle" as if nothing had been entered. The current value is
    now injected as an option labelled "New vehicle" when it is not already there.
19. **A failed vehicle-book update reported "Could not save the trip"** after the
    trip had been saved, because the upsert shared the outer `try`. It has its own
    now; the message names what actually failed.
20. **The same error string rendered twice**, once by the field (which also sets
    `aria-invalid`) and once in the `ListSection` footer that was passed the same
    value. Footers carry hints; controls carry their own errors.
21. **A count sitting on top of the list it counted.** Add Trip had a
    "Villages — 2 added" row directly above the chips, and the multi-select
    trigger beneath them read "2 selected". One value, three representations. The
    count row is gone and the trigger takes a `summary`.

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

**Testing gotcha that will bite you.** jsdom implements no `PointerEvent`, and
`fireEvent.pointerDown(node, { clientY })` therefore builds a bare `Event` that
**silently drops `clientY`**. The handler computes `undefined - undefined`, every
comparison against `NaN` is false, and a drag test passes whether or not the bug
is present. Dispatch a `MouseEvent` named `pointerdown` instead:

```js
fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }));
```

The Sheet suite includes a test asserting the panel's `transform` actually
follows the pointer, specifically so this failure mode cannot come back
unnoticed.

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
pass — or wiped from the app itself now, via `/settings/data` (§3c). Note `getAllTrips` uses `orderBy('createdAt')`, and Firestore silently
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

- **Verify before claiming done:** `npx react-scripts build` must compile, and
  `npx eslint <paths>` must be clean for files in the live tree. A command
  exiting 0 is not evidence a feature works — assert the behaviour.
- **Design decisions belong in comments, next to the code.** Every non-obvious
  element in this app carries a comment saying why it exists and why it sits
  where it does, usually citing the Apple guidance behind it. That is the only
  reason this file could be written, and the only way the next change can respect
  the last one. Keep doing it.
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

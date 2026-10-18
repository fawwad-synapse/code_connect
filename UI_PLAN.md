# UI Plan: RescueRank first-use clarity

Scope: static review of the current frontend source (`/`, `/priorities`, `/resources`, `/reports`, `/field`, `/prepositioning`, plus shared navigation, map, queue, and offline components). UI-only recommendations; no backend features. Effort estimates are implementation hours, not research or user-testing time.

## Page-by-page issues and fixes

| Page / element | Why a first-time user may hesitate or misunderstand | Concrete UI fix |
|---|---|---|
| `/` — simulator toolbar at the top | Five demo actions compete with the real emergency task; terms like “Inject Duplicate Reports” and “Silent Zone” are unexplained. “Simulated” is easy to miss. | Collapse under “Try a demo”; show a one-line effect before each action and a persistent “DEMO DATA” label. Keep “View people needing help” as the page’s primary action. |
| `/` — KPI cards | “Critical Priorities,” “Cases,” “Triage Cohort,” and “Silent Zone” are jargon. Some displayed totals (for example units/shelters/occupancy) are fixed in UI code, so they can look like live operational telemetry. | Lead with “People needing help” and “Teams available”; label any illustrative value “Demo estimate” or remove it unless backed by current data. Add a short “What this number means” hint. |
| `/` — response queue | “Transparent Priority Score,” “Vuln,” “Gap,” and confidence badges need interpretation; tiny text makes “who first, and why” hard to scan. Clicking a row opens a drawer, but it is not signposted. | Rename to “People to help first”; make name/area, help level, and one short reason the largest row content. Label the number “Help priority (0–100)” and make each row a real keyboard-focusable button. |
| `/` — map, layer toggles, legend and pins | “Geospatial layers,” “silent zone,” risk colors, uncertainty, and capped pins require recall. Color carries much of the meaning; 150-of-600 is easy to miss. | Add a visible “How to read this map” legend with icon + words for every category, a clear “Showing 150 of 600” notice, and plain labels on layer toggles. Keep hazard/risk distinct from information uncertainty. |
| `/priorities` — title, filters and list | “Triage Priority Ledger,” “weighted vulnerability,” “warning gap,” “low confidence,” and “Score” are internal language. Colors/numbers do not identify risk in words. List fetches 50, while no next-page control is visible. | Call it “People needing help”; explain the ranking in one sentence. Put text labels (“Urgent,” “High,” “Needs checking”) beside icons and scores. Add an explicit page control or clearly label the displayed subset; show filter count and a one-tap “Clear filters.” |
| `/resources` — inventory and dispatch | “Tactical Asset Coordination,” “OR-Tools,” “MIP,” “telemetry,” “solver,” and “override” obscure the practical action. “Run dispatch” can change assignments without a review/confirmation. Initial empty/error states rely on toast messages. | Title “Rescue teams and assignments”; primary button “Recommend team assignments.” Explain that it uses capacity, travel time, and medical needs. Before applying, summarize how many households/teams will change and ask confirmation; show visible loading, empty, and inline error states. Make override say “Change this team” and confirm its effect. |
| `/reports` — report form and feed | “Incident ingestion,” “LangGraph,” “Haversine deduplication,” and “cluster” are implementation terms. Presets look like real reports; sample Urdu text is visibly garbled. Coordinates are unexplained, and the form and feed compete as two main areas. | Title “Report an emergency”; explain what to enter and that presets are examples. Replace preset text with verified UTF-8 examples, label coordinates as optional map location, and show a clear “Submit report” primary action. Explain “Similar reports are grouped” in plain language. |
| `/reports` — loading, success, empty and simulated state | Fetch/submit errors appear as toasts only; an empty feed has no explanation. The header says “Live LangGraph Engine,” which may imply live external integrations. | Use an inline status region: loading, “No reports yet,” retry, and success with report status. Mark sample/preset reports “Example data”; state which channels are actually connected. |
| `/field` — form and connection status | “Vulnerability & Distress Assessment,” “IndexedDB,” “occupants,” “signal quality,” and “chronic medical dependency” are hard to understand quickly. Most text is 10–12px and controls are small for stressed responders on a phone. | Make “Send an emergency report” the single primary action. Use 16px labels and inputs, simple wording (“People here,” “Anyone unable to walk?”, “Medical help needed?”, “Water level,” “Phone signal”), large stacked controls, and a clear GPS/location fallback. |
| `/field` — offline queue and submit result | Online/offline and pending reports are present, but success/failure is mostly toast-based. “Saved locally” vs “sent to EOC” can be confused. | Persistent status banner with icon + words: “Offline — saved on this phone” or “Sent — received by response center”; show queued count and per-report sync state. Keep retry visible and never imply a queued report was delivered. |
| `/prepositioning` — title, time tabs and cards | “Pre-positioning protocol,” “T-6h/T-3h/T-0h,” forecast ETA and rationale are not self-explanatory. Users may mistake recommendations for dispatched teams. Empty/loading states are missing from the timeline presentation. | Call it “Prepare teams before flooding.” Translate tabs to “6 hours before / 3 hours before / During response” with a one-line explanation. Label cards “Recommendation — not yet dispatched”; add loading, no-actions, and retry states. |
| Shared: navigation, map popups, drawers, dialogs | Main navigation disappears below `md` without a replacement menu; many controls are tiny, icon-only, or clickable `div`s. Focus/ARIA labels are inconsistent. | Provide a compact mobile menu with persistent Field Report access; use semantic buttons/links, visible keyboard focus, accessible names for icon-only controls, and consistent dialog focus/escape behavior. |

## Plain-language glossary

| Current term | Use everywhere | One-line explanation when detail is needed |
|---|---|---|
| Hazard / hazard exposure | Flood risk / expected water level | “How much flooding the forecast suggests in this area.” |
| Warning gap | People not reached | “How many people may not have received or acknowledged a warning.” |
| Urgency | Need to act soon | “How quickly this household may need help.” |
| Confidence / low confidence | Information reliability / Needs checking | “How complete and reliable the information is; it is not the person’s risk level.” |
| P score / priority score | Help priority (0–100) | “A sorting aid for who may need help first; a higher number is more urgent.” |
| ETA / transit time | Estimated arrival | “Approximate travel time for the selected team.” |
| Vulnerability | Extra support needs | “Needs such as older age, limited mobility, living alone, or medical support.” |
| Silent zone | Area with few/no reports | “No reports may mean poor signal or missing information—not that the area is safe.” |
| Pre-positioning | Prepare teams nearby | “Move or ready teams before conditions worsen; this is not a dispatch.” |
| Override | Change team assignment | “A coordinator changes the recommended team and records why.” |

## Simple design system

- Risk labels always include an icon and text, not color alone: **Critical / Act now** — red + alert icon; **High / Urgent** — orange + upward/alert icon; **Medium / Check soon** — amber + clock icon; **Lower / Monitor** — blue/green + check icon. Use a separate purple info icon + “Information uncertain” for silent/low-data areas; uncertainty is not a risk tier.
- Typography: 16px default body, 14px secondary text, 12px only for metadata, 24–32px page title, 20px section title. Avoid long paragraphs; put the action and reason first.
- Spacing: 8px base scale (8/16/24/32); card padding 16–24px; keep a consistent 12–16px gap. Touch targets at least 44×44px.
- Buttons: one solid primary per screen; neutral secondary; red reserved for destructive/high consequence. Use sentence-case verbs (“Recommend assignments,” “Send report,” “Refresh list”). Show disabled/loading state and preserve text while loading.
- Cards: same radius, border, heading and status placement across pages. Status badge = icon + label + optional explanation. Keep selected/focus state visible in high contrast.
- Accessibility baseline: verify text contrast at WCAG AA (4.5:1 normal, 3:1 large); do not rely on color; visible focus ring; full keyboard operation; labels connected to inputs; descriptive alt text for meaningful images; `aria-label` for icon-only controls; respect reduced motion.
- Responsive: mobile-first, one-column forms/cards, no hidden-only navigation, map controls reachable without covering critical details, and no fixed 720px content that forces awkward scrolling on a phone.

## First-time-user flow

1. **Intro on first visit:** “RescueRank helps coordinators decide who may need help first, then match available teams. Demo records are synthetic.” Buttons: “Take 1-minute tour” and “Go to response view.” Persist dismissal locally; do not block urgent use.
2. **Response view:** highlight the top household and its plain-language reason; show the risk legend and say “higher help priority means review sooner—not an automatic rescue decision.”
3. **Open a person/area:** point to the details drawer/map popup; explain reliability vs risk and how to find more households in the area.
4. **Teams:** show the recommended dispatch action, its capacity/travel/medical checks, and that a coordinator must confirm before assignments change.
5. **Reports and field mode:** show one clearly marked sample report, then the field form; explain “offline saves on this device; it is not delivered until synced.” Finish with preparation timeline as recommendations, not actions already taken.

## Ranked changes: impact vs effort

| Rank | Change | Understanding impact | Effort |
|---:|---|---|---:|
| 1 | Replace jargon across all pages with glossary labels; add short explanations for remaining terms | Very high | 4–6 h |
| 2 | Make home queue lead with person/area, help level, and plain reason; add map legend labels | Very high | 5–7 h |
| 3 | Remove or label hard-coded KPI values and consistently mark synthetic/demo data | Very high | 2–3 h |
| 4 | Add visible loading, empty, error, success, and offline/delivery states instead of toast-only feedback | High | 4–6 h |
| 5 | Clarify one primary action per page; confirm dispatch and override with a before/after summary | High | 4–6 h |
| 6 | Raise body/control text to 16px, touch areas to 44px; fix contrast and keyboard focus | High | 6–9 h |
| 7 | Add phone navigation and reflow field/report forms for small screens | High | 4–6 h |
| 8 | Make risk and reliability labels use icon + text + color consistently | High | 3–4 h |
| 9 | Add the 5-step first-use guided demo and “How to read this page” help panels | Medium-high | 6–9 h |
| 10 | Clarify pagination/filter state and add keyboard-accessible selection in priority lists | Medium | 3–5 h |

## Top 10 changes at a glance

1. Speak in plain language throughout.
2. Put the person needing help and the reason first.
3. Make every synthetic value unmistakably demo data.
4. Show loading, empty, error, success, and offline states in-page.
5. Give each screen one primary action.
6. Confirm consequential dispatch/override changes.
7. Use readable 16px body text and 44px touch targets.
8. Pair every risk color with an icon and written label.
9. Make navigation and forms work comfortably on phones and keyboards.
10. Offer a short guided tour and a map/page-reading key.

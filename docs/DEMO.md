# RescueRank: 3-minute judge demo

## Before the timer

Run `docker compose up --build -d` and confirm all three services say `healthy` in `docker compose ps`. Open <http://localhost:3000>. Keep a second tab open at `/reports`.

Say this before showing any score: **“Every household, rescue unit, road closure and scenario in this prototype is synthetic demo data. No real SMS is sent unless real credentials are configured.”** The permanent **Synthetic demo data** badge in the header reinforces this.

## 0:00–0:40 — Who needs help first

1. On **Help Coordination Center** (`/`), point to **Top Response Queue**.
2. Click the first household card.
3. Show its help-priority number, risk badge, confidence badge and plain-language reasons.
4. Point to the map legend: red/critical, orange/high, yellow/medium and green/lower risk; purple outlines mean few reports, not safety.

Expected: the selected household explanation opens and uses the same score shown in the queue. This equality is covered for normal and 0/50/100% scenarios by the backend regression suite.

## 0:40–1:15 — Flood what-if and live re-planning

1. Move **What-if flood level** from 50% to 100%.
2. Wait about one second.
3. Point to **Plan updated** and the top-five before/after score rows.
4. Note that this changes only the what-if calculation; it does not overwrite the stored forecast.

Expected: scores and order change, then assignments and map lines refresh. Live API verification produced different top-five sets at 0% and 100%; the current verification run showed a 100% top score of 99.1.

## 1:15–2:05 — Scarce teams, competing demands and shelters

1. Click **Resource Board** in the top navigation.
2. Click **Recommend team assignments**.
3. Point to **Households considered**, **Assigned** and **Unassigned**.
4. Open one unassigned row and read its reason. Say: “Many households remain unassigned because the vehicles have limited passenger capacity and medical suitability. In the verified run, 100 were considered, 32 were assigned and 68 were unassigned; exact counts can vary with scenario state.”
5. Scroll to **Competing demands**. Read the real candidates, their scores, proposed winner and trade-off.
6. For a safe live demonstration, click **Change record** on an assignment, enter the coordinator ID and a reason, keep the current team, then click **Confirm and record override**. This records the human decision. Reassigning to another team is allowed only when that team has spare capacity and the required medical capability; the API regression test verifies a real resource change and audit record, but a fully loaded demo fleet correctly rejects an unsafe replacement.
7. In **Receiving Shelters**, show the demand bar. In the verified run, Korangi Community Hall showed `303 expected / 40 spaces available` and **Expected to overflow by 263 people**, with Malir Sports Complex suggested as an alternative.

Expected: the optimizer shows 100 considered, assigned plus unassigned equals 100, unassigned rows have reasons, at least one computed conflict is visible, and the override note appears after saving.

## 2:05–2:40 — A field report changes evidence

1. In the `/reports` tab, click **English (Trapped)** or enter a flood report.
2. Keep the supplied latitude/longitude and click **Send report**.
3. Return to `/` and point to the updated queue; if the WebSocket refresh has not arrived, click **Refresh** once.

Expected: the report appears in the feed and nearby household evidence increases, which can increase its score and rank. The live verification moved a Korangi household from rank 8/score 67.8 to rank 7/score 70.8. Duplicate reports are clustered; late reports get a lower evidence weight; conflicting clustered reports record which report won.

## 2:40–3:00 — Offline boundary and close

Only demonstrate this after manually verifying it in the judge’s browser:

1. Open `/field` once while online.
2. In browser DevTools, select **Network → Offline**.
3. Return to the page. Point to the visible offline banner.
4. Submit a field report; it should show as queued locally.
5. Restore **Online**; the queue should sync and clear.

Browser offline mode was not available in the automated verification environment, so this step remains **UNVERIFIED** here. Do not claim it passed until completing the five clicks above.

## Heatwave — verified optional follow-up

Use this only after the three-minute flood story, or replace the offline step with it.

1. In the header, open **Disaster type** and select **Heatwave**.
2. Point out that the URL now contains `hazard=heatwave`; refresh once to show that the selection persists.
3. On the main page, show that the slider is now **Peak heat index °C** and set it to **42°C**.
4. Open the first priority. Read the heat-specific reasons, such as age, chronic illness, missing cooling, unreliable water/electricity, outdoor work or warning access.
5. Open **Resource Board**. Show heat resources such as **Chhipa Heat Response Ambulance** and **Drinking Water Van**, plus **Cooling center** capacity instead of flood shelters.
6. Open **Prepare teams before impact**. Show the four heat phases: **T-12h**, **T-6h**, **T-3h** and **T-0h**.
7. Return to the header and select **Flood**. Confirm that flood remains the default mode and its flood-level slider, boats, shelters and flood timeline return.

Expected: all data refetches for the selected hazard. The verified API run at 42°C ranked `hh_zone_malir_067` first at 56.5, returned heat ambulances/water vans, named the shelter type **Cooling center**, and returned all four timeline phases. A cross-hazard regression used the same household `hh_zone_korangi_050`: flood score 69.7 and heatwave score 77.5 under stored forecasts. The production UI build passed, but these exact clicks were not browser-automated; perform them once before judging.

## What is simulated

- All 600 households and their vulnerability attributes.
- Rescue units, shelters, capacity, road closures and forecast scenario changes.
- Alerts when Telegram/WhatsApp credentials are absent; the UI says **Simulated alert (no real SMS sent)**.
- Routes and travel times are planning estimates, not live vehicle GPS/navigation.
- The scoring, capacity constraints, medical eligibility, report clustering/weighting, conflict computation and audit logging run in the backend; they are not pre-rendered screenshots.

## What we left out and why

- **Real household records:** unavailable and privacy-sensitive; synthetic data keeps the student demo safe.
- **Real SMS/WhatsApp delivery:** requires approved accounts, consent and paid/operational infrastructure.
- **Additional hazards beyond flood and heatwave:** profiles centralize labels and policy, but a genuinely new exposure model still needs scoring, seed and API wiring code; configuration alone is not yet enough.
- **A trained ML risk model:** no trustworthy labelled local outcome data was available; rule-based scoring is inspectable by responders.
- **Live GPS and road navigation:** the demo uses estimated travel time and simulated closures, not certified emergency routing.

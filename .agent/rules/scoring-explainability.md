# Always-On Rule: Scoring Transparency and Human Agency

1. **Deterministic, Configurable Scoring:**
   - The priority score must strictly be computed via the mathematical formula in `backend/app/services/scoring.py` governed by weights in `backend/app/core/scoring_config.yaml`.
   - The LLM **must never** compute, adjust, or override numerical priority scores or vehicle routing assignments.

2. **Full Factor Traceability:**
   - Every priority evaluation must produce an explicit `factor_breakdown` detailing each term's percentage contribution to the final score.
   - The UI must show this breakdown clearly on every priority inspection.

3. **Silence is Not Safety:**
   - Any zone or household with missing information must receive a conservative penalty, and silent high-hazard zones must display `UNKNOWN / HIGH UNCERTAINTY` with an uplift to prioritize reconnaissance.

4. **Human Overrides:**
   - Coordinators can override any priority rank or vehicle dispatch. All overrides must mandate an explanatory note and be written to `audit_log`.

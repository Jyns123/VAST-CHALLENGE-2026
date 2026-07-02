# Risk Scoring Methodology

All scores are computed in `scripts/transform.py` and emitted as derived datasets.
They are **transparent and reproducible** — every score is a documented arithmetic
combination of observable message features, never a black box. Scores are decision
*aids* for the analyst, not verdicts.

---

## 1. Message Sensitivity Score

Per-message scalar measuring how much embargoed/sensitive material a single
communication carries. Computed from lexicon hit counts on the **public content**:

```
sensitivity =  3.0 · |merger terms|
             + 2.0 · |embargo terms|
             + 1.5 · |governance terms|
             + 1.0 · |execution terms|
```

Rationale for the weights:
- **Merger language (×3)** is the embargoed subject itself — the highest signal.
- **Embargo language (×2)** indicates awareness of the restriction (intent context).
- **Governance language (×1.5)** is the "cover story" vocabulary used to disclose
  obliquely (audit / consent / access controls), so it is mildly elevated.
- **Execution language (×1)** ("EXECUTING", "posting now") marks the act of publishing.

Used as the cell intensity in the **Behavior & Anomaly** risk heatmap (summed per
agent × round, plus a +4 bump for any embargo violation in that cell).

---

## 2. Embargo Violation Flag (binary)

A communication is flagged as an **embargo violation** when *all three* hold:

```
embargo_violation =  is_public_channel
                  AND contains merger language
                  AND timestamp < 2046-06-05 18:00  (the embargo lift)
```

This is the strictest, most defensible definition: a *publicly visible* post that
*names the embargoed subject* *before* the lift time. 16 messages qualify. The first
attributable one is `legal_agent`'s 17:25 personal post (event **E10**).

---

## 3. Leak-Likelihood Score (public posts, 0–1)

Each public post is scored on how strongly it functions as a leak:

```
leak_likelihood =  0.45 · [merger language present]
                 + 0.20 · [posted before embargo]
                 + 0.15 · [execution language present]
                 + 0.10 · [anonymous channel]
                 + 0.10 · min(coordination, 10)/10        (capped, normalised)
clamped to [0, 1]
```

- **Merger (0.45)** dominates — without it a post cannot leak the embargoed fact.
- **Before-embargo (0.20)** converts disclosure into *violation*.
- **Execution (0.15)** distinguishes "doing it" from "discussing it".
- **Anonymous (0.10)** rewards deniable channels (boundary-testing behaviour).
- **Coordination (0.10)** ties the post to prior covert side-huddle activity.

The top-scoring posts are exactly the breach cluster (Legal/Social-Media, 17:25–17:54).

---

## 4. Coordination Score (public posts)

Counts `side_huddle` (covert) messages in the **90 minutes preceding** a public post.
A high value means the public act was primed by covert back-channel activity — the
signature of *coordinated* rather than spontaneous publishing. The 17:25 breach posts
sit on top of 9–13 covert messages.

---

## 5. Network Centrality & Brokerage

Computed on the directed agent graph (private + covert edges; broadcasts excluded
because the team is a broadcast clique whose betweenness is trivially zero):

- **In/Out degree** — direct reach.
- **Betweenness** (Brandes' algorithm, normalised) on *targeted* edges only —
  who bridges otherwise-separate private conversations. **Legal = 0.36** (top broker).
- **Information Brokerage** = `(covert + private messages sent) × (public posts authored)`,
  min-max normalised. This is the key investigative metric: it identifies agents who
  both sit in the covert channel **and** push to public channels — the internal→public
  conduit. **Social-Media = 1.00, Legal = 0.78** dominate.

---

## 6. Behavioral Deviation Score (per agent)

Quantifies how out-of-character each agent acted on the crisis day:

```
baseline_mix  = channel-usage distribution over pre-crisis rounds (before 2046-06-05)
crisis_mix    = channel-usage distribution on the crisis day
deviation     = ½ · Σ_channel | crisis_mix[c] − baseline_mix[c] |     (L1 / 2  ∈ [0,1])
```

We also surface **`new_channels`**: public channels an agent used on the crisis day but
*never* in baseline. `legal_agent` newly adopts `anonymous_post` **and** `personal_post`
— a concrete, non-statistical red flag that complements the deviation magnitude.

---

## 7. Hypothesis Evidence Strength (header meter)

The three hypotheses (A deliberate / B coordination failure / C emergent) are **not**
scored by the model into a verdict. The header meter simply shows
`|supporting points| / (|supporting| + |contradicting|)` from the curated evidence
ledger, so the analyst sees *evidence balance*, not a machine conclusion. Clicking a
hypothesis loads its underlying messages for independent judgement.

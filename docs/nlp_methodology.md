# NLP / Text-Feature Methodology

The platform extracts text features with a **transparent, lexicon-based** approach
rather than an opaque embedding model. For an investigative / legal context this is a
deliberate choice: every flag is explainable and auditable ("this post was flagged
because it literally contains *CivicLoom*"), which matters when the output may support
a legal conclusion. All extraction happens in `scripts/transform.py`.

---

## 1. Lexicons (five language families)

Each family is a list of case-insensitive regular-expression fragments tuned to this
corpus. They are stored in `data/meta.json` so the UI can show what was matched.

| Family | Purpose (analytic question) | Representative terms |
|---|---|---|
| **merger** | Embargoed subject — *what* must not leak | `civicloom`, `harborcrest`, `merger`, `acquisi`, `definitive agreement`, `strategic partner`, `rebrand`, `takeover`, `new capital`, `well-capitalized` |
| **embargo** | Awareness of the restriction — *intent context* | `embargo`, `6 ?pm`, `6:00`, `do not (disclose\|post)`, `confidential`, `material nonpublic`, `premature`, `no comment` |
| **execution** | The act of publishing — *who pulled the trigger* | `executing`, `posting now`, `going live`, `publish`, `authorized to share`, `green light`, `confirm` |
| **compliance** | Legal/risk framing — *how it was rationalised* | `compliance`, `10b-5`, `pslra`, `safe harbor`, `securities`, `defensible`, `outside counsel`, `liability`, `flagged` |
| **governance** | Oblique-disclosure "cover" vocabulary | `governance`, `audit`, `consent management`, `access control`, `role-based`, `permissible-use`, `retention optimizer`, `re-identification` |

The **governance** family is the methodological insight specific to this case: the
breach did not happen through blunt merger statements early on — it leaked through a
stream of *defensible "governance clarification"* posts that incrementally disclosed the
deal. Tracking governance language alongside merger language exposes that gradient
(visible as the rising risk trajectory in **Leak Reconstruction** and the boundary-test
events E07/E08).

---

## 2. Where features are applied

For every communication we run the lexicons over two fields independently:

- **`nlp`** — on the public `content` (what was said outwardly). Drives violation
  detection, sensitivity, leak-likelihood, and the `<mark>` highlighting in the inspector.
- **`nlp_inner`** — on the agent's `internal_state` (reacting / rationalizing /
  deliberating). This separates **private knowledge** from **public statements** and is
  what lets the platform answer *"who knew what, and when?"* — an agent can carry merger
  language internally for days before any public post.

---

## 3. Derived text features per message

```
flags        : {merger, embargo, execution, compliance, governance}  → booleans
nlp          : matched terms per family (public content)   → evidence display
nlp_inner    : matched terms per family (internal reasoning)→ "private knowledge"
sensitivity  : weighted blend (see risk_scoring_methodology.md §1)
has_internal : whether the message exposes the agent's reasoning
```

These feed the global **evidence filters** (filter to merger/embargo/execution/etc.),
the **risk heatmap**, the **leak-likelihood** ranking, and the search index.

---

## 4. Limitations & honest caveats

- Lexicon matching has no word-sense disambiguation; `deal` or `confirm` can produce
  false positives. We mitigate this by **requiring merger language for any violation**
  and by always linking a flag back to the **full message text** in the inspector, so an
  analyst verifies rather than trusts the flag.
- Codename handling: `CivicLoom`, `HarborCrest`, and `ResidentIQ` are matched explicitly
  because re-identification of the embargoed counterparty is the crux of the case.
- This is intentionally **not** a topic model or LLM classifier — explainability was
  prioritised over recall, appropriate for evidence that may be scrutinised legally.

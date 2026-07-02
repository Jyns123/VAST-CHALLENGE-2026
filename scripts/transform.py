#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HarborCrest Investigation — Data Transformation Pipeline
=========================================================
Reads the raw MC1_final.json and produces a set of derived, feature-engineered
datasets consumed by the D3 investigation platform.

All outputs are written to ../data/ as JSON.

Derived datasets
----------------
  messages.json   Flattened communications with engineered temporal + NLP features
  rounds.json     Environmental timeline (market, media, deadlines, narrative)
  network.json    Agent nodes (centrality, brokerage) + aggregated edges per channel
  actors.json     Per-agent behavioral profile + anomaly / deviation scores
  posts.json      Public posts with leak-likelihood + coordination scoring
  events.json     Curated causal event chain (the reconstruction backbone)
  meta.json       Constants: agents, channels, embargo, hypotheses scaffolding

Methodology for the scoring + NLP lives in ../docs/.
Run:  python3 scripts/transform.py
"""

import json
import os
import re
from collections import defaultdict, Counter
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "MC1_final.json")
OUT = os.path.join(ROOT, "data")

EMBARGO = datetime(2046, 6, 5, 18, 0, 0)   # 6:00 PM June 5, 2046
LEAK_FIRST = datetime(2046, 6, 5, 17, 25, 0)  # first explicit merger confirmation

# ---------------------------------------------------------------------------
# Reference tables
# ---------------------------------------------------------------------------
AGENTS = {
    "legal_agent":        {"label": "Legal",          "seniority": "Senior",  "human": "AI"},
    "quality_agent":      {"label": "Platform-Trust",  "seniority": "Senior",  "human": "AI"},
    "social_media_agent": {"label": "Social-Media",    "seniority": "Senior",  "human": "AI"},
    "pr_agent":           {"label": "PR",              "seniority": "Senior",  "human": "AI"},
    "intern_agent":       {"label": "Intern",          "seniority": "Junior",  "human": "AI"},
    "pr_intern_agent":    {"label": "PR-Intern",        "seniority": "Junior",  "human": "AI"},
    "judge_agent":        {"label": "Judge",           "seniority": "Compliance", "human": "AI"},
}

# recipient tokens in the data are ROLE names; map them to agent_ids
ROLE_TO_AGENT = {
    "legal": "legal_agent",
    "platform_trust": "quality_agent",
    "social_media": "social_media_agent",
    "social_manager": "social_media_agent",
    "pr": "pr_agent",
    "pr_intern": "pr_intern_agent",
    "intern": "intern_agent",
    "judge": "judge_agent",
}

CHANNELS = {
    "comms_huddle":    {"kind": "internal", "visibility": "team",    "order": 0},
    "side_huddle":     {"kind": "internal", "visibility": "covert",  "order": 1},
    "one_on_one_chat": {"kind": "internal", "visibility": "private", "order": 2},
    "official_post":   {"kind": "public",   "visibility": "public",  "order": 3},
    "personal_post":   {"kind": "public",   "visibility": "public",  "order": 4},
    "anonymous_post":  {"kind": "public",   "visibility": "public",  "order": 5},
}

# ---------------------------------------------------------------------------
# NLP — transparent lexicon-based feature extraction
# Each lexicon is a list of regex fragments (case-insensitive, word-ish bounded).
# ---------------------------------------------------------------------------
LEXICONS = {
    "merger": [
        r"civicloom", r"harborcrest", r"merger", r"acquisi", r"definitive agreement",
        r"strategic partner", r"strategic development", r"rebrand", r"\btakeover\b",
        r"\bdeal\b", r"new capital", r"well-capitalized", r"owner-operator",
    ],
    "embargo": [
        r"embargo", r"6 ?pm", r"6:00", r"do not (disclose|post|publish)", r"confidential",
        r"material nonpublic", r"mnpi", r"\bhold\b", r"before (the )?release", r"timing",
        r"do not confirm", r"no comment", r"premature",
    ],
    "execution": [
        r"executing", r"posting now", r"going live", r"\bpublish\b", r"send it",
        r"\bship(ping)?\b", r"authorized to share", r"i('| a)m posting", r"pushing live",
        r"green ?light", r"\bpost it\b", r"confirm(ed|ing)?\b",
    ],
    "compliance": [
        r"compliance", r"10b-5", r"pslra", r"safe harbor", r"securities", r"defensible",
        r"outside counsel", r"\bcounsel\b", r"disclosure", r"risk threshold", r"liability",
        r"\bsec\b", r"regulat", r"flag(ged|ging)?\b",
    ],
    "governance": [
        r"governance", r"\baudit\b", r"consent management", r"access control",
        r"role-based", r"oversight", r"\bpolicy\b", r"permissible-use", r"data practices",
        r"retention optimizer", r"re-identification",
    ],
}
COMPILED = {k: [re.compile(p, re.I) for p in v] for k, v in LEXICONS.items()}


def nlp_features(text):
    """Return per-lexicon hit counts and the matched terms for evidence display."""
    text = text or ""
    feats = {}
    for name, patterns in COMPILED.items():
        hits = []
        for pat in patterns:
            m = pat.search(text)
            if m:
                hits.append(m.group(0).lower())
        feats[name] = sorted(set(hits))
    return feats


def parse_dt(s):
    return datetime.fromisoformat(s)


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------
with open(SRC, encoding="utf-8") as f:
    raw = json.load(f)
rounds_raw = raw["rounds"]

# ---------------------------------------------------------------------------
# 1) MESSAGES — flatten + engineer features
# ---------------------------------------------------------------------------
messages = []
for ri, r in enumerate(rounds_raw):
    hour = r["hour"]
    for c in r["communications"]:
        ts = parse_dt(c["timestamp"])
        text = c.get("content") or ""
        istate = c.get("internal_state") or {}
        inner = " ".join(v for v in istate.values() if v) if istate else ""
        feats_pub = nlp_features(text)
        feats_inner = nlp_features(inner)

        # combined lexicon flags (public content drives "what was said publicly")
        flags = {k: bool(v) for k, v in feats_pub.items()}
        # sensitivity: weighted blend of merger/embargo/governance language in content
        sensitivity = (
            3.0 * len(feats_pub["merger"]) +
            2.0 * len(feats_pub["embargo"]) +
            1.5 * len(feats_pub["governance"]) +
            1.0 * len(feats_pub["execution"])
        )

        ch = c["channel"]
        is_public = CHANNELS.get(ch, {}).get("kind") == "public"

        # normalize recipients (role tokens -> agent ids); ALL stays ALL
        rec_raw = c.get("recipients") or []
        recipients = []
        for tok in rec_raw:
            if tok == "ALL":
                recipients.append("ALL")
            else:
                recipients.append(ROLE_TO_AGENT.get(tok, tok))

        secs_to_embargo = (EMBARGO - ts).total_seconds()
        messages.append({
            "id": c["message_id"],
            "round": ri,
            "hour": hour,
            "ts": c["timestamp"],
            "agent": c["agent_id"],
            "role": c["agent_role"],
            "channel": ch,
            "channel_kind": CHANNELS.get(ch, {}).get("kind", "internal"),
            "msg_type": c.get("message_type"),
            "recipients": recipients,
            "responding_to": c.get("responding_to"),
            "content": text,
            "internal_state": {k: v for k, v in istate.items() if v} if istate else {},
            "has_internal": bool(inner),
            "nlp": feats_pub,
            "nlp_inner": {k: v for k, v in feats_inner.items() if v},
            "flags": flags,
            "is_public": is_public,
            "sensitivity": round(sensitivity, 2),
            "before_embargo": ts < EMBARGO,
            "hours_to_embargo": round(secs_to_embargo / 3600.0, 2),
            # An embargo VIOLATION = public post with merger language before 6PM
            "embargo_violation": bool(is_public and flags["merger"] and ts < EMBARGO),
        })

# ---------------------------------------------------------------------------
# 2) ROUNDS — environmental timeline
# ---------------------------------------------------------------------------
def money(s):
    if not s:
        return None
    try:
        return float(str(s).replace("$", "").replace(",", ""))
    except ValueError:
        return None

rounds_out = []
for ri, r in enumerate(rounds_raw):
    ec = r["environment_context"]
    ms = ec.get("market_snapshot", {}) or {}
    msgs_here = [m for m in messages if m["round"] == ri]
    rounds_out.append({
        "round": ri,
        "hour": r["hour"],
        "ts": r["hour"],
        "headline": ec.get("event_headline", ""),
        "narrative": ec.get("event_narrative", ""),
        "stock_price": money(ms.get("stock_price")),
        "percent_change": ms.get("percent_change"),
        "sentiment": ms.get("sentiment"),
        "hashtags": ms.get("trending_hashtags", []) or [],
        "media_events": ec.get("media_events", []) or [],
        "social_state": ec.get("social_state", ""),
        "external_actor_actions": ec.get("external_actor_actions", []) or [],
        "critical_deadlines": ec.get("critical_deadlines", []) or [],
        "agents_unavailable": ec.get("agents_unavailable", []) or [],
        "news": ec.get("news", []) or [],
        # activity features
        "msg_count": len(msgs_here),
        "public_posts": sum(1 for m in msgs_here if m["is_public"]),
        "side_huddle": sum(1 for m in msgs_here if m["channel"] == "side_huddle"),
        "violations": sum(1 for m in msgs_here if m["embargo_violation"]),
        "merger_mentions": sum(1 for m in msgs_here if m["flags"]["merger"]),
        "judge_active": any(m["agent"] == "judge_agent" for m in msgs_here),
    })

# rolling / acceleration features on the hourly crisis-day series
for i, rr in enumerate(rounds_out):
    prev = rounds_out[i - 1]["msg_count"] if i > 0 else rr["msg_count"]
    rr["activity_accel"] = rr["msg_count"] - prev

# ---------------------------------------------------------------------------
# 3) NETWORK — directed agent graph + centrality
# ---------------------------------------------------------------------------
# Build directed edges. For broadcasts (recipients=ALL) we connect to all other
# agents present in the same round (team visibility). For targeted messages we
# connect to the explicit recipients. side_huddle edges are flagged covert.
edges = defaultdict(lambda: defaultdict(int))      # (src,dst) -> channel -> count
agents_in_round = {ri: set(m["agent"] for m in messages if m["round"] == ri)
                   for ri in range(len(rounds_raw))}

for m in messages:
    src = m["agent"]
    ch = m["channel"]
    if m["is_public"]:
        continue  # public posts handled separately (no single recipient)
    targets = []
    if "ALL" in m["recipients"]:
        targets = [a for a in agents_in_round[m["round"]] if a != src]
    else:
        targets = [t for t in m["recipients"] if t in AGENTS and t != src]
    for t in targets:
        edges[(src, t)][ch] += 1

edge_list = []
for (src, dst), chans in edges.items():
    total = sum(chans.values())
    edge_list.append({
        "source": src, "target": dst, "weight": total,
        "channels": dict(chans),
        "covert": chans.get("side_huddle", 0),
    })

# adjacency for centrality (unweighted directed, collapse channels)
adj = defaultdict(set)
radj = defaultdict(set)
nodes_all = list(AGENTS.keys())
for e in edge_list:
    adj[e["source"]].add(e["target"])
    radj[e["target"]].add(e["source"])

# Targeted-only adjacency for betweenness. The full graph is a broadcast clique
# (everyone -> ALL), so its betweenness is uniformly 0 and tells us nothing.
# Restricting to *targeted* private/covert edges reveals who actually bridges
# the back-channel conversations.
adj_t = defaultdict(set)
for e in edge_list:
    targeted = e["channels"].get("one_on_one_chat", 0) + e["channels"].get("side_huddle", 0)
    if targeted > 0:
        adj_t[e["source"]].add(e["target"])

def degree_centrality():
    out_d = {n: len(adj[n]) for n in nodes_all}
    in_d = {n: len(radj[n]) for n in nodes_all}
    return in_d, out_d

# Brandes' betweenness on the targeted (private/covert) directed graph
def betweenness():
    import collections
    CB = {n: 0.0 for n in nodes_all}
    for s in nodes_all:
        S = []
        P = {w: [] for w in nodes_all}
        sigma = {w: 0 for w in nodes_all}; sigma[s] = 1
        dist = {w: -1 for w in nodes_all}; dist[s] = 0
        Q = collections.deque([s])
        while Q:
            v = Q.popleft(); S.append(v)
            for w in adj_t[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1; Q.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]; P[w].append(v)
        delta = {w: 0.0 for w in nodes_all}
        while S:
            w = S.pop()
            for v in P[w]:
                delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                CB[w] += delta[w]
    # normalize
    n = len(nodes_all)
    norm = (n - 1) * (n - 2)
    if norm > 0:
        for k in CB:
            CB[k] /= norm
    return CB

in_d, out_d = degree_centrality()
betw = betweenness()

# information brokerage score: how much an agent bridges internal->public.
# = (covert/private messages sent) * (public posts authored) normalized.
brokerage = {}
for n in nodes_all:
    covert_sent = sum(e["weight"] for e in edge_list
                      if e["source"] == n and (e["channels"].get("side_huddle", 0) or e["channels"].get("one_on_one_chat", 0)))
    public_auth = sum(1 for m in messages if m["agent"] == n and m["is_public"])
    brokerage[n] = covert_sent * public_auth

maxbrk = max(brokerage.values()) or 1
nodes_out = []
for n in nodes_all:
    msgs_n = [m for m in messages if m["agent"] == n]
    nodes_out.append({
        "id": n,
        "label": AGENTS[n]["label"],
        "seniority": AGENTS[n]["seniority"],
        "messages": len(msgs_n),
        "in_degree": in_d[n],
        "out_degree": out_d[n],
        "betweenness": round(betw[n], 4),
        "brokerage": round(brokerage[n] / maxbrk, 3),
        "covert_msgs": sum(1 for m in msgs_n if m["channel"] == "side_huddle"),
        "public_posts": sum(1 for m in msgs_n if m["is_public"]),
        "violations": sum(1 for m in msgs_n if m["embargo_violation"]),
        "first_seen": min((m["ts"] for m in msgs_n), default=None),
    })

network = {"nodes": nodes_out, "edges": edge_list}

# ---------------------------------------------------------------------------
# 4) ACTORS — behavioral profile + anomaly / deviation scoring
# ---------------------------------------------------------------------------
# Baseline = pre-crisis behavior (rounds before crisis day 06-05).
# We compute each agent's channel mix + posting cadence in the baseline window,
# then measure deviation on the crisis day.
crisis_round0 = next(i for i, r in enumerate(rounds_out) if r["hour"].startswith("2046-06-05"))

actors = []
for n in nodes_all:
    base = [m for m in messages if m["agent"] == n and m["round"] < crisis_round0]
    crisis = [m for m in messages if m["agent"] == n and m["round"] >= crisis_round0]

    def chan_mix(ms):
        c = Counter(m["channel"] for m in ms)
        tot = sum(c.values()) or 1
        return {k: c.get(k, 0) / tot for k in CHANNELS}

    base_mix = chan_mix(base)
    crisis_mix = chan_mix(crisis)

    # behavioral deviation = L1 distance between channel mixes
    deviation = sum(abs(crisis_mix[k] - base_mix[k]) for k in CHANNELS) / 2.0

    # new behaviors: channels used in crisis never used in baseline
    base_chans = set(m["channel"] for m in base)
    crisis_chans = set(m["channel"] for m in crisis)
    new_channels = sorted(crisis_chans - base_chans)

    # anomalous public posting before embargo with merger language
    leak_actions = [m for m in crisis if m["embargo_violation"]]

    actors.append({
        "id": n,
        "label": AGENTS[n]["label"],
        "baseline_msgs": len(base),
        "crisis_msgs": len(crisis),
        "baseline_mix": {k: round(v, 3) for k, v in base_mix.items()},
        "crisis_mix": {k: round(v, 3) for k, v in crisis_mix.items()},
        "deviation": round(deviation, 3),
        "new_channels": new_channels,
        "leak_actions": len(leak_actions),
        "anonymous_posts": sum(1 for m in (base + crisis) if m["channel"] == "anonymous_post"),
        "covert_total": sum(1 for m in (base + crisis) if m["channel"] == "side_huddle"),
    })

# ---------------------------------------------------------------------------
# 5) POSTS — public posts with leak-likelihood + coordination scoring
# ---------------------------------------------------------------------------
public_msgs = [m for m in messages if m["is_public"]]

# coordination: a public post is "coordinated" if the same agent (or its known
# partner) was active in side_huddle within the preceding 90 minutes.
def coordination_score(post):
    ts = parse_dt(post["ts"])
    window_start = ts.timestamp() - 90 * 60
    coord = 0
    for m in messages:
        if m["channel"] != "side_huddle":
            continue
        mt = parse_dt(m["ts"]).timestamp()
        if window_start <= mt <= ts.timestamp():
            coord += 1
    return coord

posts = []
for m in public_msgs:
    coord = coordination_score(m)
    # leak likelihood (0..1) — see docs/risk_scoring_methodology.md
    score = 0.0
    if m["flags"]["merger"]:
        score += 0.45
    if m["before_embargo"]:
        score += 0.20
    if m["flags"]["execution"]:
        score += 0.15
    if m["channel"] == "anonymous_post":
        score += 0.10
    score += min(coord, 10) / 10.0 * 0.10
    leak_likelihood = round(min(score, 1.0), 3)
    posts.append({
        **{k: m[k] for k in ("id", "ts", "round", "agent", "role", "channel",
                              "content", "sensitivity", "before_embargo",
                              "hours_to_embargo", "embargo_violation", "nlp", "flags")},
        "coordination": coord,
        "leak_likelihood": leak_likelihood,
    })

# ---------------------------------------------------------------------------
# 6) EVENTS — curated causal chain (the reconstruction backbone)
# Each event references supporting message ids so the UI can drill to evidence.
# ---------------------------------------------------------------------------
def find_ids(pred, limit=None):
    ids = [m["id"] for m in messages if pred(m)]
    return ids[:limit] if limit else ids

events = [
    {
        "id": "E01", "ts": "2046-05-17T09:00:00", "phase": "seed",
        "title": "CEO seeds 'strategic developments' privately",
        "actor": "legal_agent",
        "summary": "CEO Ajay's private DMs hint at undisclosed 'strategic developments' / 'identifiable catalysts' — the first trace of the merger inside the system.",
        "risk": 0.3, "kind": "decision",
        "evidence": find_ids(lambda m: m["round"] == 0 and m["has_internal"], 4),
    },
    {
        "id": "E02", "ts": "2046-05-22T09:00:00", "phase": "coordination",
        "title": "Shadow channel (side_huddle) activated",
        "actor": "legal_agent",
        "summary": "Merger coordination moves into the covert side_huddle, away from the monitored comms_huddle. legal_agent + social_media_agent dominate this channel.",
        "risk": 0.55, "kind": "channel_shift",
        "evidence": find_ids(lambda m: m["channel"] == "side_huddle" and m["round"] <= 5, 6),
    },
    {
        "id": "E03", "ts": "2046-05-25T09:00:00", "phase": "coordination",
        "title": "Merger briefing held in Shadow channel",
        "actor": "social_media_agent",
        "summary": "Bad Q2 numbers revealed; the HarborCrest merger is briefed inside the covert channel as the recovery catalyst.",
        "risk": 0.6, "kind": "decision",
        "evidence": find_ids(lambda m: (m["channel"] == "side_huddle" and m["round"] <= 4)
                             or (m["flags"]["merger"] and 5 <= m["round"] <= 8), 6),
    },
    {
        "id": "E04", "ts": "2046-05-29T09:00:00", "phase": "control",
        "title": "Judge assigned after @Elena faux pas",
        "actor": "judge_agent",
        "summary": "A near-miss social slip triggers installation of 'The Judge' compliance agent — control is added late, only ~1 week before the breach.",
        "risk": 0.4, "kind": "control",
        "evidence": find_ids(lambda m: m["agent"] == "judge_agent", 3),
    },
    {
        "id": "E05", "ts": "2046-05-31T09:00:00", "phase": "pressure",
        "title": "SaltWind exposé #1 — data-broker partnerships",
        "actor": "social_media_agent",
        "summary": "First exposé drops; #AlgorithmicEviction pressure builds. Stock slides toward $33. Defensive public posting accelerates.",
        "risk": 0.5, "kind": "external",
        "evidence": find_ids(lambda m: m["round"] == 10 and m["is_public"], 4),
    },
    {
        "id": "E06", "ts": "2046-06-04T09:00:00", "phase": "pressure",
        "title": "SaltWind exposé #2 — re-identification risk",
        "actor": "pr_agent",
        "summary": "Second exposé raises re-identification risk on the eve of crisis. Market sentiment turns CRITICAL ($31.50).",
        "risk": 0.6, "kind": "external",
        "evidence": find_ids(lambda m: m["round"] == 12 and m["is_public"], 4),
    },
    {
        "id": "E07", "ts": "2046-06-05T09:49:00", "phase": "leak_buildup",
        "title": "First anonymous post references the deal context",
        "actor": "legal_agent",
        "summary": "legal_agent begins anonymous posting — clarifications that increasingly skirt the embargoed merger, testing the boundary.",
        "risk": 0.65, "kind": "boundary_test",
        "evidence": find_ids(lambda m: m["channel"] == "anonymous_post" and m["round"] >= crisis_round0, 4),
    },
    {
        "id": "E08", "ts": "2046-06-05T12:06:00", "phase": "leak_buildup",
        "title": "Anonymous post names 'ResidentIQ deal' / governance",
        "actor": "legal_agent",
        "summary": "Anonymous + personal posts start asserting strategic-partnership facts, narrowing the gap to the embargoed announcement.",
        "risk": 0.72, "kind": "boundary_test",
        "evidence": find_ids(lambda m: m["round"] >= crisis_round0 and m["is_public"] and m["flags"]["merger"] and m["ts"] < "2046-06-05T15:00:00", 5),
    },
    {
        "id": "E09", "ts": "2046-06-05T15:08:00", "phase": "control",
        "title": "Judge issues final COMPLIANCE_WARNING (the ceiling)",
        "actor": "judge_agent",
        "summary": "The Judge declares maximum tolerable exposure: 'No additional forward-looking language... from ANY account.' This warning is subsequently ignored.",
        "risk": 0.8, "kind": "control",
        "evidence": find_ids(lambda m: m["agent"] == "judge_agent" and m["round"] >= crisis_round0, 4),
    },
    {
        "id": "E10", "ts": "2046-06-05T17:25:00", "phase": "breach",
        "title": "BREACH — Legal personally confirms CivicLoom merger",
        "actor": "legal_agent",
        "summary": "35 minutes before the 6:00 PM embargo, legal_agent's PERSONAL post confirms 'CivicLoom Realty Partners and TenantThread' — the first explicit, attributable disclosure.",
        "risk": 1.0, "kind": "breach",
        "evidence": find_ids(lambda m: m["is_public"] and m["flags"]["merger"] and m["ts"] >= "2046-06-05T17:20:00" and m["ts"] < "2046-06-05T17:30:00"),
    },
    {
        "id": "E11", "ts": "2046-06-05T17:26:00", "phase": "breach",
        "title": "Social-Media amplifies: 'EXECUTING: ...definitive merger'",
        "actor": "social_media_agent",
        "summary": "One minute later social_media_agent amplifies with explicit execution language — the automated reaction system propagates the breach publicly.",
        "risk": 1.0, "kind": "breach",
        "evidence": find_ids(lambda m: m["agent"] == "social_media_agent" and m["is_public"] and m["ts"] >= "2046-06-05T17:25:00" and m["ts"] < "2046-06-05T17:45:00", 3),
    },
    {
        "id": "E12", "ts": "2046-06-05T18:00:00", "phase": "aftermath",
        "title": "Embargo formally lifts — but the news was already public",
        "actor": "legal_agent",
        "summary": "At 6:00 PM the embargo lifts on schedule; by then merger details had circulated publicly for ~35 minutes via personal + anonymous accounts.",
        "risk": 0.5, "kind": "aftermath",
        "evidence": find_ids(lambda m: m["is_public"] and m["ts"] >= "2046-06-05T18:00:00", 5),
    },
]

# ---------------------------------------------------------------------------
# Hypothesis scaffolding — evidence-weighted, NOT a verdict.
# Scores are derived from the data so the UI can show "evidence strength".
# ---------------------------------------------------------------------------
total_violations = sum(1 for m in messages if m["embargo_violation"])
covert_share = sum(1 for m in messages if m["channel"] == "side_huddle") / len(messages)
ignored_warning = 1  # Judge warning at 15:08 followed by 17:25 breach

hypotheses = [
    {
        "id": "A", "label": "Deliberate disclosure",
        "claim": "One or more agents intentionally released embargoed merger information.",
        "for": [
            "legal_agent authored an explicit, attributable merger confirmation 35 min early (E10).",
            "Persistent anonymous posts pre-seeded #CivicLoom #6PM, priming the audience.",
            "Covert side_huddle coordination concentrated in the same two agents who breached.",
        ],
        "against": [
            "No single message states an intent to violate the embargo.",
            "Public posts are framed as defensive clarifications, not leaks.",
        ],
        "evidence_events": ["E02", "E07", "E08", "E10"],
    },
    {
        "id": "B", "label": "Coordination failure",
        "claim": "The breach was an unintended consequence of poor coordination & late controls.",
        "for": [
            "The Judge was installed only ~1 week before the breach (E04).",
            "Crisis-day public output exploded across personal/anonymous channels with little gatekeeping.",
            "The Judge's final ceiling warning (E09) was issued but not enforced.",
        ],
        "against": [
            "The breach concentrated in two senior agents, not diffuse confusion.",
            "Boundary-testing posts escalated steadily — consistent with intent, not accident.",
        ],
        "evidence_events": ["E04", "E09", "E05", "E06"],
    },
    {
        "id": "C", "label": "Emergent behavior",
        "claim": "The leak emerged from interactions between agents, channels and compliance.",
        "for": [
            "Defensive 'clarification' posts incrementally disclosed the deal under media pressure.",
            "Anonymous + personal + official channels reinforced each other (channel interaction).",
            "Compliance language was satisfied locally (each post 'defensible') while the aggregate breached.",
        ],
        "against": [
            "The final confirmation was a discrete, deliberate-looking act (E10/E11).",
        ],
        "evidence_events": ["E07", "E08", "E09", "E11"],
    },
]

meta = {
    "embargo": EMBARGO.isoformat(),
    "leak_first": LEAK_FIRST.isoformat(),
    "agents": AGENTS,
    "channels": CHANNELS,
    "role_to_agent": ROLE_TO_AGENT,
    "lexicons": {k: v for k, v in LEXICONS.items()},
    "crisis_round0": crisis_round0,
    "hypotheses": hypotheses,
    "stats": {
        "messages": len(messages),
        "public_posts": len(public_msgs),
        "violations": total_violations,
        "covert_share": round(covert_share, 3),
        "rounds": len(rounds_out),
    },
}

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
os.makedirs(OUT, exist_ok=True)
def dump(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {name:16} ({os.path.getsize(p)//1024} KB)")

print("Derived datasets:")
dump("messages.json", messages)
dump("rounds.json", rounds_out)
dump("network.json", network)
dump("actors.json", actors)
dump("posts.json", posts)
dump("events.json", events)
dump("meta.json", meta)
print(f"\nDone. {len(messages)} messages, {len(public_msgs)} public posts, "
      f"{total_violations} embargo violations flagged.")

#!/usr/bin/env python3
"""
Generate intelligent clustering of messages by epoch (time) and layer (communication channel).
Epochs are automatically detected based on activity patterns.
Layers are communication channels grouped by privacy level.
"""

import json
from collections import defaultdict
from datetime import datetime

# Load data
with open('data/messages.json', encoding='utf-8') as f:
    messages = json.load(f)

with open('data/meta.json', encoding='utf-8') as f:
    meta = json.load(f)

# Define communication layers (privacy gradient: high monitoring → complete anonymity)
LAYERS = {
    'comms_huddle': {'layer_id': 0, 'label': 'Team Channel', 'privacy': 'monitored'},
    'one_on_one_chat': {'layer_id': 1, 'label': '1:1 Chat', 'privacy': 'private'},
    'side_huddle': {'layer_id': 2, 'label': 'Side Huddle (Covert)', 'privacy': 'covert'},
    'official_post': {'layer_id': 3, 'label': 'Official Post', 'privacy': 'public'},
    'personal_post': {'layer_id': 4, 'label': 'Personal Post', 'privacy': 'public'},
    'anonymous_post': {'layer_id': 5, 'label': 'Anonymous Post', 'privacy': 'public'},
}

# Detect epochs (time periods) based on activity spikes and crisis day
# Round 22 is the crisis day (Jun 5), rounds 0-21 are pre-crisis, after would be aftermath
rounds_data = defaultdict(lambda: {'msgs': [], 'public_msgs': 0, 'covert_msgs': 0})
for m in messages:
    r = m.get('round', 0)
    rounds_data[r]['msgs'].append(m)
    if m.get('is_public'):
        rounds_data[r]['public_msgs'] += 1
    if m.get('channel') == 'side_huddle':
        rounds_data[r]['covert_msgs'] += 1

# Define epochs based on temporal structure
epochs = {}
for r in sorted(rounds_data.keys()):
    if r <= 20:
        epoch_id = 'pre-crisis'
    elif r == 21:
        epoch_id = 'crisis-morning'
    elif r == 22:
        epoch_id = 'crisis-day'
    else:
        epoch_id = 'aftermath'

    if epoch_id not in epochs:
        epochs[epoch_id] = {'rounds': [], 'label': None}
    epochs[epoch_id]['rounds'].append(r)

# Set epoch labels
epoch_labels = {
    'pre-crisis': 'Pre-Crisis (May 17–21)',
    'crisis-morning': 'Crisis Morning (Jun 5, 00:00–06:00)',
    'crisis-day': 'Crisis Day (Jun 5, 06:00–18:00)',
    'aftermath': 'Aftermath (Jun 5, 18:00+)',
}
for eid in epochs:
    epochs[eid]['label'] = epoch_labels.get(eid, eid)

# Generate cluster nodes: each message becomes a node with metadata
nodes = []
node_id_counter = 0

for m in messages:
    node_id_counter += 1

    # Determine epoch
    r = m.get('round', 0)
    epoch = 'pre-crisis'
    if r == 21:
        epoch = 'crisis-morning'
    elif r == 22:
        epoch = 'crisis-day'
    elif r > 22:
        epoch = 'aftermath'

    # Determine layer
    channel = m.get('channel', 'comms_huddle')
    layer = LAYERS.get(channel, LAYERS['comms_huddle'])

    # Determine impact: which hypothesis does this message support?
    # Count flags that contribute to INTENTIONAL vs SYSTEMIC
    flags = m.get('flags', {})
    is_violation = flags.get('violation', False)
    is_embargo_language = flags.get('embargo', False)
    is_covert = channel == 'side_huddle'
    is_coordinated = m.get('responding_to') is not None  # Has responses = coordination
    is_public = m.get('is_public', False)

    # Simple heuristic: deliberate actions (violations, public posts on crisis day, coordinated covert) → INTENTIONAL
    # Accidental/systemic (routine language, pre-crisis violations, boundary testing) → SYSTEMIC
    intentional_score = 0
    systemic_score = 0

    if is_violation and r == 22:  # Violation on crisis day = deliberate
        intentional_score += 3
    elif is_violation:  # Earlier violation = testing boundaries
        systemic_score += 2

    if is_public and is_covert:  # Escalating from covert to public = deliberate
        intentional_score += 2

    if is_embargo_language and is_public:  # Merger talk going public = deliberate
        intentional_score += 2
    elif is_embargo_language and is_covert:  # Private discussion = systemic/operational
        systemic_score += 1

    if r == 22 and is_public:  # Any public post on crisis day = suspicious
        intentional_score += 1

    impact = 'intentional' if intentional_score >= systemic_score else 'systemic'

    node = {
        'id': m.get('id'),
        'node_id': node_id_counter,
        'round': r,
        'epoch': epoch,
        'channel': channel,
        'layer_id': layer['layer_id'],
        'layer_label': layer['label'],
        'agent': m.get('agent', '?'),
        'is_post': is_public,
        'is_violation': is_violation,
        'impact': impact,  # 'intentional' or 'systemic'
        'strength': max(intentional_score, systemic_score) or 1,  # Evidence strength
    }
    nodes.append(node)

# Count nodes per epoch+layer combination
summary = defaultdict(lambda: {'intentional': 0, 'systemic': 0, 'posts': 0})
for node in nodes:
    key = f"{node['epoch']}|{node['layer_id']}"
    if node['impact'] == 'intentional':
        summary[key]['intentional'] += 1
    else:
        summary[key]['systemic'] += 1
    if node['is_post']:
        summary[key]['posts'] += 1

# Generate output JSON
output = {
    'epochs': epochs,
    'layers': LAYERS,
    'nodes': nodes,
    'summary': dict(summary),
}

# Write to file
with open('data/clusters.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"[OK] Generated {len(nodes)} cluster nodes")
print(f"[OK] {len(epochs)} epochs defined")
print(f"[OK] {len(LAYERS)} communication layers")
print(f"\nEpoch distribution:")
for eid, edata in sorted(epochs.items()):
    count = sum(1 for n in nodes if n['epoch'] == eid)
    print(f"  {edata['label']}: {count} messages")
print(f"\nOutput: data/clusters.json")

/**
 * dataLoader.js — Async data loading module
 * 
 * Loads all JSON data files and provides a unified data object.
 * Paths are configurable via DATA_PATHS constant.
 * 
 * Design rationale:
 * - Centralized loading ensures all views receive consistent data
 * - Async/await pattern for clean error handling
 * - Data is parsed once and shared through the state module
 */

// ── Configurable data paths ──────────────────────────────────────
const OFFICIAL_DATA_PATH = 'MC1_final_00.json';

const ROLE_COLORS = {
  legal: '#3498db',
  platform_trust: '#2ecc71',
  pr: '#e67e22',
  social_media: '#e74c3c',
  pr_intern: '#9b59b6',
  intern: '#8c564b',
  judge: '#f1c40f'
};

const ROLE_LABELS = {
  legal: 'Legal Agent',
  platform_trust: 'Platform Trust Agent',
  pr: 'PR Agent',
  social_media: 'Social Media Agent',
  pr_intern: 'PR Intern',
  intern: 'Intern',
  judge: 'Judge'
};

const CHANNEL_LABELS = {
  comms_huddle: 'Communications Huddle',
  one_on_one_chat: 'One-on-One Chat',
  side_huddle: 'Side Huddle',
  official_post: 'Official Post',
  personal_post: 'Personal Post',
  anonymous_post: 'Anonymous Post'
};

// Per EDA & Problem Framing: Judge ONLY monitored comms_huddle.
// The breach happened on personal_post precisely because it was outside Judge's scope.
const MONITORED_CHANNELS = new Set(['comms_huddle']);

const CHANNEL_CLASS = {
  official_post: 'public',
  personal_post: 'public',
  anonymous_post: 'public',
  side_huddle: 'private',
  one_on_one_chat: 'private',
  comms_huddle: 'internal'
};

const HIGH_RISK_CHANNELS = new Set(['anonymous_post', 'personal_post', 'side_huddle']);
const MID_RISK_CHANNELS = new Set(['one_on_one_chat', 'official_post']);

/**
 * Load all data files in parallel and return a unified data object.
 * @returns {Promise<{agents: Array, channels: Array, events: Array, messages: Array}>}
 */
export async function loadAllData() {
  try {
    const officialRaw = await d3.json(OFFICIAL_DATA_PATH);
    if (!officialRaw || !Array.isArray(officialRaw.rounds)) {
      throw new Error(
        `Official dataset is invalid. Expected an object with 'rounds' array in ${OFFICIAL_DATA_PATH}.`
      );
    }

    const transformed = transformOfficialDataset(officialRaw);
    console.log(`Loaded official dataset: ${OFFICIAL_DATA_PATH}`);
    return finalizeData(transformed);
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

function finalizeData({ agents, channels, events, messages, stockPrices }) {
  const timeParse = d3.timeParse('%Y-%m-%dT%H:%M:%S');
  events.forEach(e => { e.time = timeParse(e.timestamp); });
  messages.forEach(m => { m.time = timeParse(m.timestamp); });

  const agentMap = new Map(agents.map(a => [a.id, a]));
  const channelMap = new Map(channels.map(c => [c.id, c]));
  const messageMap = new Map(messages.map(m => [m.id, m]));

  return { agents, channels, events, messages, agentMap, channelMap, messageMap, stockPrices };
}

function transformOfficialDataset(raw) {
  const rounds = raw.rounds || [];
  const messages = [];

  rounds.forEach((round, idx) => {
    const roundNum = idx + 1;
    const roundMsgs = Array.isArray(round.communications) ? round.communications : [];
    roundMsgs.forEach((m) => {
      const internalState = flattenInternalState(m.internal_state);
      const mentionsMerger = detectMergerMention(m.content, internalState);
      const sensitivity = scoreSensitivity(m, mentionsMerger);
      const monitoredByJudge = MONITORED_CHANNELS.has((m.channel || '').toLowerCase());

      messages.push({
        id: m.message_id,
        round: roundNum,
        timestamp: m.timestamp,
        agent: m.agent_id,
        channel: (m.channel || '').toLowerCase(),
        channel_class: CHANNEL_CLASS[(m.channel || '').toLowerCase()] || 'internal',
        type: (m.message_type || 'broadcast').toLowerCase(),
        declared_action: (m.message_type || 'broadcast').toLowerCase(),
        internal_state: internalState,
        content: m.content || '',
        responding_to: m.responding_to || null,
        mentions_merger: mentionsMerger,
        sensitivity,
        monitored_by_judge: monitoredByJudge,
        is_public_channel: CHANNEL_CLASS[(m.channel || '').toLowerCase()] === 'public',
        is_private_channel: CHANNEL_CLASS[(m.channel || '').toLowerCase()] === 'private',
        recipients: Array.isArray(m.recipients) ? m.recipients : []
      });
    });
  });

  markLikelyBreach(messages);

  const channels = buildChannels(messages);
  const agents = buildAgents(messages, rounds.length);
  const events = buildEvents(rounds, messages);

  // Extract real stock prices from market_snapshot
  const stockPrices = {};
  rounds.forEach((round, idx) => {
    const snap = round.environment_context?.market_snapshot;
    if (snap && snap.stock_price) {
      const price = parseFloat(String(snap.stock_price).replace(/[^0-9.]/g, ''));
      if (!isNaN(price) && price > 0 && price < 200) {
        stockPrices[idx + 1] = price;
      }
    }
  });

  return { agents, channels, events, messages, stockPrices };
}

function flattenInternalState(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') return '';
  return ['reacting', 'rationalizing', 'deliberating']
    .map(k => stateObj[k])
    .filter(Boolean)
    .join(' | ');
}

function detectMergerMention(content, internalState) {
  const text = `${content || ''} ${internalState || ''}`.toLowerCase();
  return /(merger|acquisition|civicloom|meridian|embargo|strategic\s+developments|deal|retention\s*optimizer|algorithmic\s*eviction|harborcrest|re-identification)/.test(text);
}

function scoreSensitivity(message, mentionsMerger) {
  const channel = (message.channel || '').toLowerCase();
  const text = `${message.content || ''} ${flattenInternalState(message.internal_state)}`.toLowerCase();
  let score = 1;

  // EDA-aligned: CivicLoom, merger, Retention Optimizer, algorithmic eviction, embargo
  if (mentionsMerger) score += 2;
  if (/urgent|critical|investigation|regulator|violation|breach|leak|saltwind/.test(text)) score += 1;
  if (/confidential|embargo|non-public|material\s+information/.test(text)) score += 1;
  // Private/anonymous channels carry more risk (EDA: 58% sensitive in private)
  if (CHANNEL_CLASS[channel] === 'private') score += 1;
  if (channel === 'anonymous_post') score += 1;

  return Math.max(1, Math.min(5, score));
}

function channelRisk(channelId) {
  if (HIGH_RISK_CHANNELS.has(channelId)) return 5;
  if (MID_RISK_CHANNELS.has(channelId)) return 4;
  if (channelId === 'comms_huddle') return 2; // internal, monitored = lowest risk
  return 3;
}

function buildChannels(messages) {
  const uniq = [...new Set(messages.map(m => m.channel))];
  return uniq.map(id => ({
    id,
    label: CHANNEL_LABELS[id] || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    risk_level: channelRisk(id),
    monitored_by_judge: MONITORED_CHANNELS.has(id)
  }));
}

function buildAgents(messages, totalRounds) {
  const byAgent = d3.group(messages, d => d.agent);
  return [...byAgent.entries()].map(([agentId, list]) => {
    const first = list[0] || {};
    const role = inferRole(agentId);
    const internalStates = [...new Set(list.map(m => m.internal_state).filter(Boolean))];
    const sensitiveMessages = list.filter(m => m.sensitivity >= 4).length;
    const firstCritical = list.find(m => m.sensitivity >= 4)?.round || 1;
    const breachInvolved = list.some(m => m.is_breach) || list.some(m => !m.monitored_by_judge && m.sensitivity >= 4);

    return {
      id: agentId,
      name: first.agent?.name || prettifyAgentId(agentId),
      role,
      role_label: ROLE_LABELS[role] || role,
      color: ROLE_COLORS[role] || '#8b949e',
      seniority: AGENT_SENIORITY[agentId] || 'junior',
      breach_involved: breachInvolved,
      first_critical_event_round: Math.min(firstCritical, totalRounds),
      total_messages: list.length,
      sensitive_messages: sensitiveMessages,
      internal_states: internalStates,
      description: `Derived from official MC1 communications for ${prettifyAgentId(agentId)}.`
    };
  });
}

function buildEvents(rounds, messages) {
  return rounds.map((round, idx) => {
    const roundNum = idx + 1;
    const roundMsgs = messages.filter(m => m.round === roundNum);
    const headline = round.environment_context?.event_headline || `Round ${roundNum}`;
    const narrative = round.environment_context?.event_narrative || '';
    const topAgent = d3.rollups(roundMsgs, v => v.length, d => d.agent)
      .sort((a, b) => d3.descending(a[1], b[1]))[0]?.[0] || 'unknown_agent';
    const severity = Math.max(1, Math.min(5, d3.max(roundMsgs, d => d.sensitivity) || 1));

    return {
      id: `evt_${String(roundNum).padStart(2, '0')}`,
      round: roundNum,
      timestamp: round.hour,
      type: classifyEventType(headline, narrative),
      label: headline,
      agent: topAgent,
      severity,
      description: narrative || headline
    };
  });
}

function classifyEventType(headline, narrative) {
  const text = `${headline || ''} ${narrative || ''}`.toLowerCase();
  if (/breach|embargo.*break|leak/.test(text)) return 'breach';
  if (/judge/.test(text)) return 'judge_action';
  if (/pressure|deadline|media/.test(text)) return 'pressure';
  if (/warning|risk|inquiry|investigation/.test(text)) return 'warning';
  if (/decision|approve|post/.test(text)) return 'decision';
  return 'discussion';
}

const AGENT_SENIORITY = {
  legal_agent: 'senior',
  quality_agent: 'senior',
  social_media_agent: 'senior',
  pr_agent: 'senior',
  intern_agent: 'junior',
  pr_intern_agent: 'junior',
  judge_agent: 'compliance'
};

function inferRole(agentId) {
  if (agentId === 'judge_agent') return 'judge';
  if (agentId === 'quality_agent') return 'platform_trust';
  return agentId.replace('_agent', '');
}

function prettifyAgentId(agentId) {
  return agentId
    .replace(/_agent$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function markLikelyBreach(messages) {
  const candidates = messages.filter(m =>
    m.channel.endsWith('_post') && m.mentions_merger && m.sensitivity >= 4
  );
  if (candidates.length === 0) return;

  const breach = candidates.sort((a, b) => {
    if (a.round !== b.round) return b.round - a.round;
    return a.timestamp.localeCompare(b.timestamp);
  })[0];
  breach.is_breach = true;
}

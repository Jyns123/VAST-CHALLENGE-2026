/**
 * state.js — Global application state & event dispatch
 * 
 * Uses D3 dispatch to coordinate events across all views.
 * Any view can emit or listen to state changes, ensuring
 * linked views stay synchronized.
 * 
 * Design rationale:
 * - D3 dispatch is lightweight and avoids framework dependencies
 * - Centralized state prevents inconsistencies between views
 * - Filter state is an object that any view can query
 */

// ── D3 Dispatch for inter-view coordination ─────────────────────
// Events:
//   filterChange  — global filters updated
//   agentSelect   — user selected an agent
//   eventSelect   — user selected an event
//   messageSelect — user selected a message
//   timebrush     — user brushed a time range
//   roundChange   — pressure replay round changed
export const dispatch = d3.dispatch(
  'filterChange',
  'agentSelect',
  'eventSelect',
  'messageSelect',
  'timebrush',
  'roundChange'
);

// ── Application state ────────────────────────────────────────────
export const state = {
  // Raw data (populated by dataLoader)
  data: null,

  // Current filter values
  filters: {
    search: '',
    agents: [],        // empty = all selected
    roles: [],
    channels: [],
    phase: 'all',
    msgTypes: [],
    sensitiveOnly: false,
    mergerOnly: false,
    minCriticality: 1,
    timeRange: null     // [Date, Date] or null for full range
  },

  // Current selections
  selectedAgent: null,
  selectedEvent: null,
  selectedMessage: null,
  currentRound: 1,

  // Derived/computed
  filteredMessages: [],
  filteredEvents: []
};

/**
 * Apply current filters to messages and events, updating state.
 * Then emit filterChange so all views can re-render.
 */
export function applyFilters() {
  if (!state.data) return;

  const f = state.filters;
  const { messages, events, agentMap } = state.data;

  state.filteredMessages = messages.filter(m => {
    // Text search
    if (f.search) {
      const q = f.search.toLowerCase();
      const agent = agentMap.get(m.agent);
      const haystack = [
        m.content, m.agent, m.channel, m.type, m.declared_action,
        m.internal_state, agent?.name || ''
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // Agent filter
    if (f.agents.length > 0 && !f.agents.includes(m.agent)) return false;

    // Role filter
    if (f.roles.length > 0) {
      const agent = agentMap.get(m.agent);
      if (!agent || !f.roles.includes(agent.role)) return false;
    }

    // Channel filter
    if (f.channels.length > 0 && !f.channels.includes(m.channel)) return false;

    // Phase filter — based on rounds, aligned with EDA phases
    if (f.phase !== 'all') {
      if (f.phase === 'pre') {
        // Pre-crisis: rounds 1–8 (before Judge arrival, May 17–29)
        if (m.round > 8) return false;
      } else if (f.phase === 'judge') {
        // Judge supervision: rounds 9–13 (May 30 – Jun 4)
        if (m.round < 9 || m.round > 13) return false;
      } else if (f.phase === 'crisis') {
        // Crisis day: rounds 14–22 (Jun 5, 9AM–5PM)
        if (m.round < 14 || m.round > 22) return false;
      } else if (f.phase === 'post') {
        // Post-breach: round 23 (Jun 5, 6PM)
        if (m.round < 23) return false;
      }
    }

    // Message type
    if (f.msgTypes.length > 0 && !f.msgTypes.includes(m.type)) return false;

    // Semantic filters
    if (f.sensitiveOnly && m.sensitivity < 4) return false;
    if (f.mergerOnly && !m.mentions_merger) return false;

    // Criticality
    if (m.sensitivity < f.minCriticality) return false;

    // Time range (from brush)
    if (f.timeRange && m.time) {
      if (m.time < f.timeRange[0] || m.time > f.timeRange[1]) return false;
    }

    return true;
  });

  state.filteredEvents = events.filter(e => {
    if (f.agents.length > 0 && !f.agents.includes(e.agent)) return false;
    if (f.timeRange && e.time) {
      if (e.time < f.timeRange[0] || e.time > f.timeRange[1]) return false;
    }
    if (f.minCriticality > 1 && e.severity < f.minCriticality) return false;
    return true;
  });

  dispatch.call('filterChange');
}

/**
 * Select an agent and notify all views.
 */
export function selectAgent(agentId) {
  state.selectedAgent = agentId;
  state.selectedMessage = null;
  dispatch.call('agentSelect', null, agentId);
}

/**
 * Select a message and notify all views.
 */
export function selectMessage(messageId) {
  state.selectedMessage = messageId;
  dispatch.call('messageSelect', null, messageId);
}

/**
 * Select an event and notify all views.
 */
export function selectEvent(eventId) {
  state.selectedEvent = eventId;
  dispatch.call('eventSelect', null, eventId);
}

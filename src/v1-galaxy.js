/**
 * v1-galaxy.js — V1: Agent Causal Galaxy (Radial Visualization)
 * 
 * Visual encoding rationale:
 * - ANGLE (position): encodes the moment of first critical event for each agent.
 *   Time is naturally cyclical, and radial position maps intuitively to "when" 
 *   in the day an agent first became involved.
 * - RADIUS: encodes criticality (number of sensitive messages). Agents closer to 
 *   the center are less critical; those further out are more involved in sensitive comms.
 * - NODE SIZE: encodes total message volume — larger nodes = more active agents.
 * - COLOR: encodes agent role/type for categorical distinction.
 * - RED HALO: marks agents directly involved in the breach — this is the most 
 *   important signal and uses a pulsing red ring for immediate visual salience.
 * - CONCENTRIC RINGS: represent role categories (legal, social media, oversight, etc.)
 * 
 * Interaction:
 * - Hover: tooltip with agent stats
 * - Click: selects agent, updates all linked views
 * - Responds to global filters by dimming non-matching agents
 */

import { state, dispatch, selectAgent } from './state.js?v=2';
import { showTooltip, hideTooltip } from './narrative.js?v=2';

let svg, g, width, height, centerX, centerY;

// Role ring assignments (inner to outer) — maps actual data roles
const ROLE_RINGS = {
  judge:          1,   // Compliance (oversight)
  platform_trust: 2,   // Platform Trust & Safety
  legal:          3,   // Legal counsel
  pr:             4,   // Head of Communications
  social_media:   4,   // Social media manager
  pr_intern:      5,   // PR intern (junior)
  intern:         5    // General intern (junior)
};

export function initGalaxy() {
  const container = d3.select('#viz-galaxy');
  width = 500;
  height = 380;
  centerX = width / 2;
  centerY = height / 2;

  svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%');

  g = svg.append('g').attr('transform', `translate(${centerX},${centerY})`);

  // Listen for state changes
  dispatch.on('filterChange.galaxy', renderGalaxy);
  dispatch.on('agentSelect.galaxy', highlightAgent);

  renderGalaxy();
}

function renderGalaxy() {
  if (!state.data) return;

  const { agents, messages, agentMap } = state.data;
  const maxRadius = Math.min(centerX, centerY) - 30;

  // ── Draw concentric role rings ──────────────────────────────
  const ringData = [1, 2, 3, 4, 5];
  const ringScale = d3.scaleLinear().domain([0, 6]).range([0, maxRadius]);

  g.selectAll('.galaxy-ring').data(ringData, d => d)
    .join('circle')
    .attr('class', 'galaxy-ring')
    .attr('cx', 0).attr('cy', 0)
    .attr('r', d => ringScale(d));

  // Role labels on rings
  const roleLabels = [
    { ring: 1, label: 'Compliance' },
    { ring: 2, label: 'Platform Trust' },
    { ring: 3, label: 'Legal' },
    { ring: 4, label: 'Senior Comms' },
    { ring: 5, label: 'Junior' }
  ];
  g.selectAll('.ring-label').data(roleLabels, d => d.ring)
    .join('text')
    .attr('class', 'ring-label')
    .attr('x', 0)
    .attr('y', d => -ringScale(d.ring) - 3)
    .attr('text-anchor', 'middle')
    .attr('fill', '#30363d')
    .attr('font-size', '8px')
    .text(d => d.label);

  // ── Prepare agent data ──────────────────────────────────────
  // Angle: based on first critical event round (1–23 mapped to 0–2π)
  const angleScale = d3.scaleLinear().domain([1, 23]).range([0, 2 * Math.PI - 0.3]);
  
  // Size: based on total messages
  const maxMsgs = d3.max(agents, a => a.total_messages) || 1;
  const sizeScale = d3.scaleSqrt().domain([0, maxMsgs]).range([6, 22]);

  // Determine which agents pass current filters
  const filteredAgentIds = new Set(state.filteredMessages.map(m => m.agent));

  // ── Draw agent nodes ────────────────────────────────────────
  const agentGroups = g.selectAll('.galaxy-node').data(agents, d => d.id)
    .join('g')
    .attr('class', d => `galaxy-node ${d.breach_involved ? 'breach' : ''}`)
    .attr('transform', d => {
      const angle = angleScale(d.first_critical_event_round) - Math.PI / 2;
      const ring = ROLE_RINGS[d.role] || 3;
      const r = ringScale(ring);
      return `translate(${r * Math.cos(angle)}, ${r * Math.sin(angle)})`;
    })
    .classed('dimmed', d => {
      if (state.filters.agents.length > 0) return !state.filters.agents.includes(d.id);
      if (state.filters.roles.length > 0) return !state.filters.roles.includes(d.role);
      return !filteredAgentIds.has(d.id) && state.filteredMessages.length < state.data.messages.length;
    });

  // Halo (red pulsing ring for breach-involved agents)
  agentGroups.selectAll('circle.halo').data(d => [d])
    .join('circle')
    .attr('class', 'halo')
    .attr('r', d => sizeScale(d.total_messages) + 6);

  // Main node circle
  agentGroups.selectAll('circle.node-circle').data(d => [d])
    .join('circle')
    .attr('class', 'node-circle')
    .attr('r', d => sizeScale(d.total_messages))
    .attr('fill', d => d.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.9);

  // Agent name labels
  agentGroups.selectAll('text.galaxy-label').data(d => [d])
    .join('text')
    .attr('class', 'galaxy-label')
    .attr('dy', d => sizeScale(d.total_messages) + 12)
    .text(d => d.name.split(' ')[0]);

  // ── Interactions ────────────────────────────────────────────
  agentGroups
    .on('mouseover', function(event, d) {
      const agentMsgs = state.data.messages.filter(m => m.agent === d.id);
      const sensitiveMsgs = agentMsgs.filter(m => m.sensitivity >= 4);
      showTooltip(event, `
        <strong>${d.name}</strong><br>
        <span class="tt-label">Role:</span> ${d.role_label}<br>
        <span class="tt-label">Messages:</span> ${agentMsgs.length}<br>
        <span class="tt-label">Sensitive:</span> ${sensitiveMsgs.length}<br>
        <span class="tt-label">First critical round:</span> ${d.first_critical_event_round}<br>
        <span class="tt-label">Breach involved:</span> ${d.breach_involved ? '⚠️ YES' : 'No'}
      `);
    })
    .on('mousemove', (event) => showTooltip(event))
    .on('mouseout', hideTooltip)
    .on('click', function(event, d) {
      selectAgent(d.id);
    });
}

function highlightAgent(agentId) {
  g.selectAll('.galaxy-node')
    .classed('dimmed', d => agentId && d.id !== agentId)
    .classed('highlighted', d => d.id === agentId)
    .select('circle.node-circle')
    .classed('selected-ring', d => d.id === agentId);
}

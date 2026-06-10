/**
 * filters.js — Global filter panel logic
 * 
 * Dynamically populates filter controls from loaded data and wires up
 * event listeners. Every filter change triggers state.applyFilters()
 * which notifies all views via D3 dispatch.
 */

import { state, applyFilters } from './state.js?v=2';

export function initFilters() {
  if (!state.data) return;

  const { agents, channels, messages } = state.data;

  // ── Agent checkboxes ────────────────────────────────────────
  const agentContainer = d3.select('#filter-agents');
  agents.forEach(agent => {
    const label = agentContainer.append('label').attr('class', 'cb-label');
    label.append('input')
      .attr('type', 'checkbox')
      .attr('value', agent.id)
      .attr('checked', true)
      .on('change', updateAgentFilter);
    label.append('span')
      .style('color', agent.color)
      .text(agent.name);
  });

  // ── Role checkboxes ─────────────────────────────────────────
  const roles = [...new Set(agents.map(a => a.role))];
  const roleContainer = d3.select('#filter-roles');
  roles.forEach(role => {
    const label = roleContainer.append('label').attr('class', 'cb-label');
    label.append('input')
      .attr('type', 'checkbox')
      .attr('value', role)
      .attr('checked', true)
      .on('change', updateRoleFilter);
    label.append('span').text(role.replace(/_/g, ' '));
  });

  // ── Channel checkboxes ──────────────────────────────────────
  const channelContainer = d3.select('#filter-channels');
  channels.forEach(ch => {
    const label = channelContainer.append('label').attr('class', 'cb-label');
    label.append('input')
      .attr('type', 'checkbox')
      .attr('value', ch.id)
      .attr('checked', true)
      .on('change', updateChannelFilter);
    label.append('span').text(ch.label);
  });

  // ── Message type checkboxes ─────────────────────────────────
  const msgTypes = [...new Set(messages.map(m => m.type))];
  const typeContainer = d3.select('#filter-msg-types');
  msgTypes.forEach(type => {
    const label = typeContainer.append('label').attr('class', 'cb-label');
    label.append('input')
      .attr('type', 'checkbox')
      .attr('value', type)
      .attr('checked', true)
      .on('change', updateMsgTypeFilter);
    label.append('span').text(type.replace(/_/g, ' '));
  });

  // ── Text search ─────────────────────────────────────────────
  d3.select('#search-input').on('input', function() {
    state.filters.search = this.value;
    applyFilters();
  });

  // ── Phase filter ────────────────────────────────────────────
  d3.select('#filter-phase').on('change', function() {
    state.filters.phase = this.value;
    applyFilters();
  });

  // ── Semantic toggles ────────────────────────────────────────
  d3.select('#filter-sensitive').on('change', function() {
    state.filters.sensitiveOnly = this.checked;
    applyFilters();
  });

  d3.select('#filter-merger').on('change', function() {
    state.filters.mergerOnly = this.checked;
    applyFilters();
  });

  // ── Criticality slider ──────────────────────────────────────
  d3.select('#filter-criticality').on('input', function() {
    state.filters.minCriticality = +this.value;
    d3.select('#criticality-val').text(this.value);
    applyFilters();
  });

  // ── Reset button ────────────────────────────────────────────
  d3.select('#btn-reset-filters').on('click', resetAllFilters);
}

function updateAgentFilter() {
  const checked = [];
  d3.selectAll('#filter-agents input:checked').each(function() {
    checked.push(this.value);
  });
  // If all are checked, treat as "no filter" (empty array)
  const allAgents = state.data.agents.length;
  state.filters.agents = checked.length === allAgents ? [] : checked;
  applyFilters();
}

function updateRoleFilter() {
  const checked = [];
  d3.selectAll('#filter-roles input:checked').each(function() {
    checked.push(this.value);
  });
  const allRoles = [...new Set(state.data.agents.map(a => a.role))].length;
  state.filters.roles = checked.length === allRoles ? [] : checked;
  applyFilters();
}

function updateChannelFilter() {
  const checked = [];
  d3.selectAll('#filter-channels input:checked').each(function() {
    checked.push(this.value);
  });
  const allChannels = state.data.channels.length;
  state.filters.channels = checked.length === allChannels ? [] : checked;
  applyFilters();
}

function updateMsgTypeFilter() {
  const checked = [];
  d3.selectAll('#filter-msg-types input:checked').each(function() {
    checked.push(this.value);
  });
  const allTypes = [...new Set(state.data.messages.map(m => m.type))].length;
  state.filters.msgTypes = checked.length === allTypes ? [] : checked;
  applyFilters();
}

function resetAllFilters() {
  state.filters = {
    search: '',
    agents: [],
    roles: [],
    channels: [],
    phase: 'all',
    msgTypes: [],
    sensitiveOnly: false,
    mergerOnly: false,
    minCriticality: 1,
    timeRange: null
  };

  // Reset UI controls
  d3.select('#search-input').property('value', '');
  d3.select('#filter-phase').property('value', 'all');
  d3.select('#filter-sensitive').property('checked', false);
  d3.select('#filter-merger').property('checked', false);
  d3.select('#filter-criticality').property('value', 1);
  d3.select('#criticality-val').text('1');

  // Re-check all checkboxes
  d3.selectAll('#filter-agents input, #filter-roles input, #filter-channels input, #filter-msg-types input')
    .property('checked', true);

  applyFilters();
}

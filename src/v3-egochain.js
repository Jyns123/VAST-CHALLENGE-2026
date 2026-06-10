/**
 * v3-egochain.js — V3: Information Flow & Channel Migration
 *
 * Inspired by Melody Way (VAST 2025): every encoding maps to a real
 * data attribute. The MC1 dataset has 749/912 messages with responding_to
 * links, but breach messages on personal_post are root messages.
 *
 * This viz shows the REAL story: how information migrates between channels
 * across rounds, revealing the path from internal discussion to public leak.
 *
 * Visual encodings (all grounded in actual data fields):
 * - Y axis: channels ordered by privacy level (internal → private → public)
 * - X axis: round number (temporal progression)
 * - Circle size: message count in that (channel, round) cell
 * - Circle color: average sensitivity score
 * - Arcs: responding_to links that CROSS channels — the critical migration events
 * - Arc thickness: number of cross-channel responses
 * - Arc color: red if sensitive content crosses to less-monitored channel
 * - Gold border: merger mentions present in that cell
 */

import { state, dispatch, selectMessage } from './state.js?v=2';
import { showTooltip, hideTooltip } from './narrative.js?v=2';

let svg, g, width, height;
const margin = { top: 24, right: 16, bottom: 42, left: 110 };

const CHANNEL_ORDER = [
  'comms_huddle',
  'one_on_one_chat',
  'side_huddle',
  'official_post',
  'personal_post',
  'anonymous_post'
];

const CHANNEL_LABELS = {
  comms_huddle: 'Comms Huddle',
  one_on_one_chat: 'One-on-One',
  side_huddle: 'Side Huddle',
  official_post: 'Official Post',
  personal_post: 'Personal Post',
  anonymous_post: 'Anonymous Post'
};

const PRIVACY_CLASS = {
  comms_huddle: 'internal',
  one_on_one_chat: 'private',
  side_huddle: 'private',
  official_post: 'public',
  personal_post: 'public',
  anonymous_post: 'public'
};

export function initEgoChain() {
  const container = d3.select('#viz-egochain');
  const totalW = 550;
  const totalH = 380;
  width = totalW - margin.left - margin.right;
  height = totalH - margin.top - margin.bottom;

  svg = container.append('svg')
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%');

  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'flow-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 5).attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#8b949e');

  g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  dispatch.on('filterChange.egochain', renderFlow);
  dispatch.on('messageSelect.egochain', () => {});

  renderFlow();
}

function renderFlow() {
  if (!state.data) return;
  g.selectAll('*').remove();

  const { messages, messageMap } = state.data;
  const msgs = state.filteredMessages.length > 0 ? state.filteredMessages : messages;

  // Build (channel, round) aggregates
  const cellMap = new Map();
  msgs.forEach(m => {
    const key = `${m.channel}__${m.round}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { channel: m.channel, round: m.round, count: 0, sensSum: 0, mergerCount: 0, msgs: [] });
    }
    const cell = cellMap.get(key);
    cell.count++;
    cell.sensSum += m.sensitivity;
    if (m.mentions_merger) cell.mergerCount++;
    cell.msgs.push(m);
  });

  const cells = [...cellMap.values()];

  // Build cross-channel arcs from responding_to
  const arcMap = new Map();
  msgs.forEach(m => {
    if (!m.responding_to) return;
    const parent = messageMap.get(m.responding_to);
    if (!parent) return;
    if (parent.channel === m.channel) return;

    const key = `${parent.channel}__${parent.round}__${m.channel}__${m.round}`;
    if (!arcMap.has(key)) {
      arcMap.set(key, {
        srcChannel: parent.channel, srcRound: parent.round,
        tgtChannel: m.channel, tgtRound: m.round,
        count: 0, sensitiveCount: 0
      });
    }
    const arc = arcMap.get(key);
    arc.count++;
    if (m.sensitivity >= 4 || parent.sensitivity >= 4) arc.sensitiveCount++;
  });

  const arcs = [...arcMap.values()].filter(a => a.count > 0);

  // Scales
  const rounds = [...new Set(msgs.map(m => m.round))].sort((a, b) => a - b);
  const channels = CHANNEL_ORDER.filter(c => cells.some(d => d.channel === c));

  const xScale = d3.scaleBand()
    .domain(rounds)
    .range([0, width])
    .padding(0.15);

  const yScale = d3.scaleBand()
    .domain(channels)
    .range([0, height])
    .padding(0.25);

  const maxCount = d3.max(cells, d => d.count) || 1;
  const rScale = d3.scaleSqrt().domain([0, maxCount]).range([2, 14]);

  const sensColorScale = d3.scaleSequential(d3.interpolateYlOrRd)
    .domain([1, 4.5]);

  // Privacy band backgrounds
  const privacyBands = [
    { label: 'Internal', channels: channels.filter(c => PRIVACY_CLASS[c] === 'internal'), color: 'rgba(34,197,94,.06)' },
    { label: 'Private', channels: channels.filter(c => PRIVACY_CLASS[c] === 'private'), color: 'rgba(245,158,11,.06)' },
    { label: 'Public', channels: channels.filter(c => PRIVACY_CLASS[c] === 'public'), color: 'rgba(239,68,68,.06)' }
  ];

  privacyBands.forEach(band => {
    if (band.channels.length === 0) return;
    const y0 = yScale(band.channels[0]);
    const yEnd = yScale(band.channels[band.channels.length - 1]) + yScale.bandwidth();
    g.append('rect')
      .attr('x', -4).attr('y', y0 - 4)
      .attr('width', width + 8).attr('height', yEnd - y0 + 8)
      .attr('rx', 5)
      .attr('fill', band.color)
      .attr('stroke', 'none');
  });

  // Draw arcs (cross-channel responding_to)
  arcs.forEach(arc => {
    const sx = xScale(arc.srcRound) + xScale.bandwidth() / 2;
    const sy = yScale(arc.srcChannel) + yScale.bandwidth() / 2;
    const tx = xScale(arc.tgtRound) + xScale.bandwidth() / 2;
    const ty = yScale(arc.tgtChannel) + yScale.bandwidth() / 2;

    const srcIdx = channels.indexOf(arc.srcChannel);
    const tgtIdx = channels.indexOf(arc.tgtChannel);
    const goesPublic = tgtIdx > srcIdx;

    const midX = (sx + tx) / 2;
    const curve = goesPublic ? 12 : -12;

    g.append('path')
      .attr('d', `M${sx},${sy} Q${midX},${(sy + ty) / 2 + curve} ${tx},${ty}`)
      .attr('fill', 'none')
      .attr('stroke', arc.sensitiveCount > 0 ? '#ef4444' : '#4a5568')
      .attr('stroke-width', Math.min(4, 0.8 + arc.count * 0.6))
      .attr('stroke-dasharray', goesPublic ? 'none' : '3 2')
      .attr('opacity', 0.45)
      .attr('marker-end', 'url(#flow-arrow)');
  });

  // Draw cells
  const cellGroups = g.selectAll('.flow-cell').data(cells)
    .join('g')
    .attr('class', 'flow-cell')
    .attr('transform', d => `translate(${xScale(d.round) + xScale.bandwidth() / 2}, ${yScale(d.channel) + yScale.bandwidth() / 2})`);

  cellGroups.append('circle')
    .attr('r', d => rScale(d.count))
    .attr('fill', d => sensColorScale(d.sensSum / d.count))
    .attr('stroke', d => d.mergerCount > 0 ? '#f59e0b' : '#1e293b')
    .attr('stroke-width', d => d.mergerCount > 0 ? 1.8 : 0.8)
    .attr('opacity', 0.92)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('stroke', '#0d9488').attr('stroke-width', 2.5);
      const avgSens = (d.sensSum / d.count).toFixed(1);
      showTooltip(event, `
        <strong>${CHANNEL_LABELS[d.channel]}</strong> · Round ${d.round}<br>
        <span class="tt-label">Messages:</span> ${d.count}<br>
        <span class="tt-label">Avg sensitivity:</span> ${avgSens}<br>
        <span class="tt-label">Merger mentions:</span> ${d.mergerCount}<br>
        <span class="tt-label">Agents:</span> ${[...new Set(d.msgs.map(m => m.agent))].join(', ')}
      `);
    })
    .on('mousemove', event => showTooltip(event))
    .on('mouseout', function () {
      const d = d3.select(this).datum();
      d3.select(this)
        .attr('stroke', d.mergerCount > 0 ? '#f59e0b' : '#1e293b')
        .attr('stroke-width', d.mergerCount > 0 ? 1.8 : 0.8);
      hideTooltip();
    })
    .on('click', (event, d) => {
      if (d.msgs.length > 0) selectMessage(d.msgs[0].id);
    });

  // Y axis (channels)
  g.selectAll('.ch-label').data(channels)
    .join('text')
    .attr('class', 'ch-label')
    .attr('x', -8)
    .attr('y', d => yScale(d) + yScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('fill', d => PRIVACY_CLASS[d] === 'internal' ? '#3fb950' : (PRIVACY_CLASS[d] === 'private' ? '#f59e0b' : '#94a3b8'))
    .attr('font-size', '9px')
    .text(d => CHANNEL_LABELS[d]);

  // X axis (rounds)
  const tickRounds = rounds.filter(r => r % 2 === 0 || rounds.length <= 12);
  g.selectAll('.round-label').data(tickRounds)
    .join('text')
    .attr('class', 'round-label')
    .attr('x', d => xScale(d) + xScale.bandwidth() / 2)
    .attr('y', height + 16)
    .attr('text-anchor', 'middle')
    .attr('fill', '#8b949e')
    .attr('font-size', '8px')
    .text(d => `R${d}`);

  // Legend
  const legend = g.append('g').attr('transform', `translate(0, ${height + 28})`);
  legend.append('text')
    .attr('x', 0).attr('y', 0)
    .attr('fill', '#8b949e').attr('font-size', '8px')
    .text('Circle: msg count & avg sensitivity | Gold border: merger | Red arc: sensitive cross-channel flow');
}

/**
 * v4-judgemap.js — V4: Multidimensional Oversight Matrix
 *
 * Matrix dimensions:
 * - X: phase (pre, judge, crisis, post)
 * - Y: channel
 *
 * Visual encodings per cell:
 * - Fill color: oversight status and blind-spot severity
 * - Cell size: message volume
 * - Center dot: sensitive-message rate
 * - Border style: merger-mention density
 */

import { state, dispatch, selectAgent } from './state.js?v=2';
import { showTooltip, hideTooltip } from './narrative.js?v=2';

let svg, g, width, height;
const margin = { top: 48, right: 16, bottom: 70, left: 130 };

const PHASES = [
  { id: 'pre', label: 'Pre (R1-R8)', inPhase: r => r <= 8 },
  { id: 'judge', label: 'Judge (R9-R13)', inPhase: r => r >= 9 && r <= 13 },
  { id: 'crisis', label: 'Crisis (R14-R22)', inPhase: r => r >= 14 && r <= 22 },
  { id: 'post', label: 'Post (R23)', inPhase: r => r >= 23 }
];

export function initJudgeMap() {
  const container = d3.select('#viz-judgemap');
  const totalW = 550;
  const totalH = 380;
  width = totalW - margin.left - margin.right;
  height = totalH - margin.top - margin.bottom;

  svg = container.append('svg')
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%');

  g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  dispatch.on('filterChange.judgemap', renderJudgeMap);
  dispatch.on('agentSelect.judgemap', highlightAgentPresence);

  renderJudgeMap();
}

function renderJudgeMap() {
  if (!state.data) return;
  g.selectAll('*').remove();

  const { channels, messages, agentMap } = state.data;
  const msgs = state.filteredMessages.length > 0 ? state.filteredMessages : messages;

  const matrixData = channels.flatMap(channel => {
    return PHASES.map(phase => {
      const cellMsgs = msgs.filter(m => m.channel === channel.id && phase.inPhase(m.round));
      const count = cellMsgs.length;
      const sensitiveCount = cellMsgs.filter(m => m.sensitivity >= 4).length;
      const mergerCount = cellMsgs.filter(m => m.mentions_merger).length;
      const monitoredCount = cellMsgs.filter(m => m.monitored_by_judge).length;
      const blindSpotCount = cellMsgs.filter(m => !m.monitored_by_judge && m.sensitivity >= 4).length;
      const agentCounts = d3.rollups(cellMsgs, v => v.length, d => d.agent)
        .sort((a, b) => d3.descending(a[1], b[1]));
      const topAgentId = agentCounts[0]?.[0] || null;
      const agentSet = new Set(cellMsgs.map(m => m.agent));

      return {
        channelId: channel.id,
        channelLabel: channel.label,
        phaseId: phase.id,
        phaseLabel: phase.label,
        count,
        sensitiveCount,
        mergerCount,
        monitoredCount,
        blindSpotCount,
        sensitiveRate: count ? sensitiveCount / count : 0,
        mergerRate: count ? mergerCount / count : 0,
        monitoredRate: count ? monitoredCount / count : 0,
        blindSpotRate: count ? blindSpotCount / count : 0,
        topAgentId,
        topAgentName: topAgentId ? (agentMap.get(topAgentId)?.name || topAgentId) : 'None',
        agentSet
      };
    });
  });

  const xScale = d3.scaleBand()
    .domain(PHASES.map(p => p.id))
    .range([0, width])
    .padding(0.12);

  const yScale = d3.scaleBand()
    .domain(channels.map(c => c.id))
    .range([0, height])
    .padding(0.12);

  const maxCount = d3.max(matrixData, d => d.count) || 1;
  const sizeScale = d3.scaleSqrt().domain([0, maxCount]).range([0.32, 0.96]);

  g.selectAll('.md-bg-cell').data(matrixData)
    .join('rect')
    .attr('class', 'md-bg-cell')
    .attr('x', d => xScale(d.phaseId))
    .attr('y', d => yScale(d.channelId))
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('rx', 5)
    .attr('fill', '#10161f')
    .attr('stroke', '#1f2b3a')
    .attr('stroke-width', 1);

  const cellGroup = g.selectAll('.md-cell').data(matrixData)
    .join('g')
    .attr('class', 'md-cell')
    .attr('transform', d => `translate(${xScale(d.phaseId)}, ${yScale(d.channelId)})`);

  cellGroup.append('rect')
    .attr('class', 'md-cell-body')
    .attr('x', d => (xScale.bandwidth() * (1 - sizeScale(d.count))) / 2)
    .attr('y', d => (yScale.bandwidth() * (1 - sizeScale(d.count))) / 2)
    .attr('width', d => xScale.bandwidth() * sizeScale(d.count))
    .attr('height', d => yScale.bandwidth() * sizeScale(d.count))
    .attr('rx', 4)
    .attr('fill', d => fillColor(d))
    .attr('stroke', d => d.mergerRate > 0.28 ? '#f59e0b' : '#0b111a')
    .attr('stroke-width', d => d.count > 0 ? 1.2 : 0.8)
    .attr('stroke-dasharray', d => d.mergerRate > 0.28 ? '4 2' : null)
    .style('cursor', d => d.topAgentId ? 'pointer' : 'default')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('stroke', '#0d9488').attr('stroke-width', 2.5);
      showTooltip(event, `
        <strong>${d.channelLabel}</strong> | ${d.phaseLabel}<br>
        <span class="tt-label">Messages:</span> ${d.count}<br>
        <span class="tt-label">Sensitive:</span> ${d.sensitiveCount} (${(d.sensitiveRate * 100).toFixed(1)}%)<br>
        <span class="tt-label">Merger mentions:</span> ${d.mergerCount} (${(d.mergerRate * 100).toFixed(1)}%)<br>
        <span class="tt-label">Judge coverage:</span> ${(d.monitoredRate * 100).toFixed(1)}%<br>
        <span class="tt-label">Blind spots:</span> ${d.blindSpotCount}<br>
        <span class="tt-label">Top agent:</span> ${d.topAgentName}
      `);
    })
    .on('mousemove', event => showTooltip(event))
    .on('mouseout', function(event, d) {
      d3.select(this)
        .attr('stroke', d.mergerRate > 0.28 ? '#f59e0b' : '#0b111a')
        .attr('stroke-width', d.count > 0 ? 1.2 : 0.8);
      hideTooltip();
    })
    .on('click', (event, d) => {
      if (d.topAgentId) selectAgent(d.topAgentId);
    });

  cellGroup.append('circle')
    .attr('class', 'md-cell-dot')
    .attr('cx', xScale.bandwidth() / 2)
    .attr('cy', yScale.bandwidth() / 2)
    .attr('r', d => d.count === 0 ? 0 : 2 + d.sensitiveRate * 8)
    .attr('fill', d => d.blindSpotCount > 0 ? '#fecaca' : '#fda4af')
    .attr('opacity', d => d.count === 0 ? 0 : 0.9)
    .attr('pointer-events', 'none');

  cellGroup.append('text')
    .attr('class', 'md-cell-text')
    .attr('x', xScale.bandwidth() / 2)
    .attr('y', yScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e6edf3')
    .attr('font-size', '10px')
    .attr('font-weight', 700)
    .attr('pointer-events', 'none')
    .text(d => d.count > 0 ? d.count : '');

  g.selectAll('.md-y-label').data(channels)
    .join('text')
    .attr('class', 'judgemap-label md-y-label')
    .attr('x', -8)
    .attr('y', d => yScale(d.id) + yScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('fill', d => d.monitored_by_judge ? '#3fb950' : '#8b949e')
    .attr('font-size', '10px')
    .text(d => d.label.length > 20 ? `${d.label.slice(0, 18)}...` : d.label);

  g.selectAll('.md-x-label').data(PHASES)
    .join('text')
    .attr('class', 'judgemap-label md-x-label')
    .attr('x', d => xScale(d.id) + xScale.bandwidth() / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#9fb4cc')
    .attr('font-size', '10px')
    .attr('font-weight', 700)
    .text(d => d.label);

  const legend = g.append('g').attr('transform', `translate(0, ${height + 10})`);
  legend.append('text')
    .attr('x', 0)
    .attr('y', -2)
    .attr('fill', '#8b949e')
    .attr('font-size', '9px')
    .text('Fill: oversight/blind-spot severity | Dot size: sensitive rate | Border dash: merger-dense | Cell size: volume');

  const summary = g.append('g').attr('transform', `translate(${width - 145}, ${height + 22})`);
  summary.append('rect').attr('width', 145).attr('height', 34).attr('rx', 5).attr('fill', '#0f1622').attr('stroke', '#253242');
  summary.append('text')
    .attr('x', 8).attr('y', 14)
    .attr('fill', '#8b949e').attr('font-size', '9px')
    .text(`Blind spots: ${d3.sum(matrixData, d => d.blindSpotCount)}`);
  summary.append('text')
    .attr('x', 8).attr('y', 26)
    .attr('fill', '#8b949e').attr('font-size', '9px')
    .text(`Sensitive msgs: ${d3.sum(matrixData, d => d.sensitiveCount)}`);
}

function fillColor(d) {
  if (d.count === 0) return '#17202d';
  if (d.blindSpotCount > 0) {
    const t = Math.min(1, d.blindSpotRate * 2.2);
    return d3.interpolateRgb('#3b1f24', '#f85149')(t);
  }
  if (d.monitoredRate > 0) {
    const t = Math.max(0.2, d.monitoredRate);
    return d3.interpolateRgb('#1a2d24', '#3fb950')(t);
  }
  return '#2d3544';
}

function highlightAgentPresence(agentId) {
  const cells = g.selectAll('.md-cell');
  if (!agentId) {
    cells.classed('dimmed', false).classed('highlighted', false);
    return;
  }

  cells
    .classed('dimmed', d => !d.agentSet.has(agentId))
    .classed('highlighted', d => d.agentSet.has(agentId));
}

/**
 * v2-timeline.js — V2: Causal Timeline
 * 
 * Visual encoding rationale:
 * - HORIZONTAL POSITION (x-axis): time — the most natural mapping for temporal data.
 *   Uses an arc layout where events are placed along time.
 * - VERTICAL POSITION (y-axis): severity/importance of the event (1–5 scale).
 * - SHAPE: star symbols for key events — metaphorical ("stars" in the causal sky).
 * - COLOR: encodes event type (system, pressure, judge_action, breach, etc.)
 * - LINE STYLE: 
 *     Solid = responding_to relationship
 *     Dotted = thematic connection
 *     Red = causal link to the breach
 *     Gold = Judge interventions
 * - BRUSH: allows selecting a time range to filter all other views (linked views).
 * - MARKERS: vertical lines at 17:00 (breach) and stock crash for reference.
 * 
 * Interaction:
 * - Hover: tooltip with event details
 * - Click: select event, update narrative panel
 * - Brush: filter all views by time range
 */

import { state, dispatch, selectEvent } from './state.js?v=2';
import { showTooltip, hideTooltip } from './narrative.js?v=2';

let svg, g, xScale, yScale, brush, width, height;
const margin = { top: 20, right: 20, bottom: 40, left: 40 };

// Event type colors
const EVENT_COLORS = {
  system:       '#58a6ff',
  discussion:   '#8b949e',
  warning:      '#d29922',
  pressure:     '#e67e22',
  anomaly:      '#bc8cff',
  faux_pas:     '#f85149',
  judge_action: '#d29922',
  judge_gap:    '#ff6b6b',
  coordination: '#e74c3c',
  escalation:   '#ff4444',
  decision:     '#f85149',
  breach:       '#ff0000',
  consequence:  '#ff4444'
};

export function initTimeline() {
  const container = d3.select('#viz-timeline');
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

  // Listen for state changes
  dispatch.on('filterChange.timeline', renderTimeline);
  dispatch.on('eventSelect.timeline', highlightEvent);

  renderTimeline();
}

function renderTimeline() {
  if (!state.data) return;
  g.selectAll('*').remove();

  const events = state.filteredEvents.length > 0 ? state.filteredEvents : state.data.events;
  const allEvents = state.data.events;

  // ── Scales ──────────────────────────────────────────────────
  const timeExtent = d3.extent(allEvents, d => d.time);
  xScale = d3.scaleTime()
    .domain([
      d3.timeHour.offset(timeExtent[0], -0.5),
      d3.timeHour.offset(timeExtent[1], 0.5)
    ])
    .range([0, width]);

  yScale = d3.scaleLinear().domain([0, 6]).range([height, 0]);

  // ── Axes ────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => {
      // Show date for multi-day range, time for single-day
      const fmt = d3.timeFormat('%b %d %H:%M');
      return fmt(d);
    }));

  g.append('g')
    .attr('class', 'timeline-axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `Sev ${d}`));

  // ── Reference lines ─────────────────────────────────────────
  // Breach time: 17:00
  const breachTime = new Date('2046-06-05T17:00:00');
  if (xScale(breachTime) >= 0 && xScale(breachTime) <= width) {
    g.append('line')
      .attr('class', 'breach-line')
      .attr('x1', xScale(breachTime)).attr('x2', xScale(breachTime))
      .attr('y1', 0).attr('y2', height);

    g.append('text')
      .attr('x', xScale(breachTime) + 4)
      .attr('y', 12)
      .attr('fill', '#ff4444')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text('17:00 BREACH');
  }

  // Stock crash: 17:15
  const crashTime = new Date('2046-06-05T17:15:00');
  if (xScale(crashTime) >= 0 && xScale(crashTime) <= width) {
    g.append('line')
      .attr('x1', xScale(crashTime)).attr('x2', xScale(crashTime))
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', '#d29922').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');

    g.append('text')
      .attr('x', xScale(crashTime) + 4)
      .attr('y', 24)
      .attr('fill', '#d29922')
      .attr('font-size', '9px')
      .text('STOCK CRASH');
  }

  // ── Connection lines between events ─────────────────────────
  // Draw causal connections: connect sequential events with severity >= 3
  const highEvents = events.filter(e => e.severity >= 3).sort((a, b) => a.time - b.time);
  for (let i = 1; i < highEvents.length; i++) {
    const prev = highEvents[i - 1];
    const curr = highEvents[i];
    
    let strokeColor = '#30363d';
    let dashArray = 'none';
    let strokeWidth = 1;

    // Causal links to breach
    if (curr.type === 'breach' || prev.type === 'breach') {
      strokeColor = '#ff4444';
      strokeWidth = 2;
    } else if (curr.type === 'judge_action' || prev.type === 'judge_action') {
      strokeColor = '#d29922';
      dashArray = '4 2';
    } else if (curr.agent === prev.agent) {
      strokeColor = '#0d948833';
    } else {
      dashArray = '2 3';
      strokeColor = '#30363d';
    }

    g.append('line')
      .attr('x1', xScale(prev.time)).attr('y1', yScale(prev.severity))
      .attr('x2', xScale(curr.time)).attr('y2', yScale(curr.severity))
      .attr('stroke', strokeColor)
      .attr('stroke-width', strokeWidth)
      .attr('stroke-dasharray', dashArray)
      .attr('opacity', 0.6);
  }

  // ── Event stars ─────────────────────────────────────────────
  const starSymbol = d3.symbol().type(d3.symbolStar);
  const sizeScale = d3.scaleSqrt().domain([1, 5]).range([30, 200]);

  const eventNodes = g.selectAll('.event-star').data(events, d => d.id)
    .join('g')
    .attr('class', 'event-star')
    .attr('transform', d => `translate(${xScale(d.time)},${yScale(d.severity)})`);

  eventNodes.selectAll('path').data(d => [d])
    .join('path')
    .attr('d', d => starSymbol.size(sizeScale(d.severity))())
    .attr('fill', d => EVENT_COLORS[d.type] || '#8b949e')
    .attr('stroke', d => d.type === 'breach' ? '#fff' : 'none')
    .attr('stroke-width', d => d.type === 'breach' ? 2 : 0)
    .attr('opacity', 0.85);

  // Small label for each event
  eventNodes.selectAll('text').data(d => [d])
    .join('text')
    .attr('dy', -12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#8b949e')
    .attr('font-size', '7px')
    .text(d => d.label.length > 20 ? d.label.substring(0, 20) + '…' : d.label);

  // ── Interactions ────────────────────────────────────────────
  eventNodes
    .on('mouseover', function(event, d) {
      const agent = state.data.agentMap.get(d.agent);
      showTooltip(event, `
        <strong>${d.label}</strong><br>
        <span class="tt-label">Time:</span> ${d3.timeFormat('%H:%M')(d.time)}<br>
        <span class="tt-label">Agent:</span> ${agent?.name || d.agent}<br>
        <span class="tt-label">Severity:</span> ${'★'.repeat(d.severity)}${'☆'.repeat(5 - d.severity)}<br>
        <span class="tt-label">Type:</span> ${d.type}<br>
        <span class="tt-label">${d.description}</span>
      `);
    })
    .on('mousemove', event => showTooltip(event))
    .on('mouseout', hideTooltip)
    .on('click', (event, d) => selectEvent(d.id));

  // ── Brush for time range selection ──────────────────────────
  brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on('end', brushed);

  g.append('g').attr('class', 'brush').call(brush);
}

function brushed(event) {
  if (!event.selection) {
    state.filters.timeRange = null;
  } else {
    const [x0, x1] = event.selection;
    state.filters.timeRange = [xScale.invert(x0), xScale.invert(x1)];
  }
  // Import dynamically to avoid circular deps
  import('./state.js?v=2').then(({ applyFilters }) => applyFilters());
}

function highlightEvent(eventId) {
  g.selectAll('.event-star')
    .classed('dimmed', d => eventId && d.id !== eventId)
    .classed('highlighted', d => d.id === eventId);
}

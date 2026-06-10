/**
 * v5-pressure.js — V5: Systemic Pressure Replay
 * 
 * Visual encoding rationale:
 * - HORIZONTAL BARS: each component of pressure_score is a stacked segment,
 *   allowing users to see which factors contribute most at each round.
 * - COLOR: each pressure component uses a distinct color for decomposition:
 *     External pressure  = orange
 *     Channel risk       = purple
 *     Semantic risk      = red
 *     Judge gap          = yellow
 *     Coordination score = cyan
 *     Embargo proximity  = magenta
 * - AREA CHART: total pressure_score over rounds as an area fill — shows
 *   the escalation curve leading to the breach.
 * - PLAY BUTTON: temporal replay animates the slider through rounds,
 *   updating all views in real-time. This lets analysts "watch" the 
 *   pressure build up, supporting the systemic pressure hypothesis.
 * - VERTICAL LINE: marks current round during replay.
 * 
 * Formula:
 *   pressure_score = external_pressure + channel_risk + semantic_risk
 *                  + judge_gap + coordination_score + embargo_proximity
 * 
 * Interaction:
 * - Slider: manually select round
 * - Play/Pause/Reset: animate through rounds
 * - Hover on area: see component breakdown
 */

import { state, dispatch } from './state.js?v=2';
import { showTooltip, hideTooltip } from './narrative.js?v=2';

let svg, g, width, height;
let playTimer = null;
const margin = { top: 10, right: 20, bottom: 30, left: 50 };

// Pressure components with colors
const COMPONENTS = [
  { key: 'external_pressure',  label: 'External Pressure',  color: '#e67e22' },
  { key: 'channel_risk',       label: 'Channel Risk',       color: '#bc8cff' },
  { key: 'semantic_risk',      label: 'Semantic Risk',      color: '#f85149' },
  { key: 'judge_gap',          label: 'Judge Gap',          color: '#d29922' },
  { key: 'coordination_score', label: 'Coordination',       color: '#1abc9c' },
  { key: 'embargo_proximity',  label: 'Embargo Proximity',  color: '#e91e9c' }
];

export function initPressure() {
  const container = d3.select('#viz-pressure');
  const totalW = 900;
  const totalH = 220;
  width = totalW - margin.left - margin.right;
  height = totalH - margin.top - margin.bottom;

  svg = container.append('svg')
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%');

  g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Wire up controls
  const slider = d3.select('#pressure-slider');
  slider.on('input', function() {
    state.currentRound = +this.value;
    d3.select('#pressure-round-label').text(`Round ${state.currentRound}`);
    dispatch.call('roundChange', null, state.currentRound);
    updateRoundIndicator();
  });

  d3.select('#btn-play').on('click', startPlay);
  d3.select('#btn-pause').on('click', stopPlay);
  d3.select('#btn-reset').on('click', resetPlay);

  dispatch.on('filterChange.pressure', renderPressure);

  renderPressure();
}

/**
 * Compute pressure scores for each round based on messages in that round.
 */
function computePressureData() {
  if (!state.data) return [];

  const { messages, channelMap, agentMap } = state.data;
  const rounds = d3.range(1, 24); // rounds 1–23
  const breachRound = 22;

  return rounds.map(round => {
    const roundMsgs = messages.filter(m => m.round === round);

    // External pressure: count of messages from external-facing roles or pressure-like content
    const external_pressure = roundMsgs.filter(m => 
      agentMap.get(m.agent)?.role === 'external' ||
      /pressure|deadline|media|urgent/.test(`${m.type} ${m.content}`.toLowerCase())
    ).length * 2;

    // Channel risk: sum of channel risk levels for messages in this round
    const channel_risk = roundMsgs.reduce((sum, m) => {
      const ch = channelMap.get(m.channel);
      return sum + (ch ? ch.risk_level : 0);
    }, 0) / Math.max(roundMsgs.length, 1);

    // Semantic risk: count of merger mentions + high sensitivity messages
    const semantic_risk = roundMsgs.filter(m => m.mentions_merger).length +
                          roundMsgs.filter(m => m.sensitivity >= 4).length;

    // Judge gap: count of unmonitored sensitive messages
    const judge_gap = roundMsgs.filter(m => !m.monitored_by_judge && m.sensitivity >= 3).length * 2;

    // Coordination score: messages in one_on_one_chat between breach agents
    const coordination_score = roundMsgs.filter(m =>
      m.channel === 'one_on_one_chat' && m.mentions_merger
    ).length * 3;

    // Embargo proximity: increases as we approach round 22 (breach)
    const embargo_proximity = Math.max(0, (1 - Math.abs(round - breachRound) / breachRound)) * 5;

    const total = external_pressure + channel_risk + semantic_risk +
                  judge_gap + coordination_score + embargo_proximity;

    return {
      round,
      external_pressure,
      channel_risk: +channel_risk.toFixed(1),
      semantic_risk,
      judge_gap,
      coordination_score,
      embargo_proximity: +embargo_proximity.toFixed(1),
      total: +total.toFixed(1),
      stockPrice: state.data.stockPrices ? state.data.stockPrices[round] : null
    };
  });
}

function renderPressure() {
  if (!state.data) return;
  g.selectAll('*').remove();

  const pressureData = computePressureData();

  // ── Scales ──────────────────────────────────────────────────
  const xScale = d3.scaleLinear().domain([1, 23]).range([0, width]);
  const maxTotal = d3.max(pressureData, d => d.total) || 1;
  const yScale = d3.scaleLinear().domain([0, maxTotal * 1.1]).range([height, 0]);

  // ── Axes ────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(12).tickFormat(d => `R${d}`));

  g.append('g')
    .attr('class', 'timeline-axis')
    .call(d3.axisLeft(yScale).ticks(5));

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -38)
    .attr('text-anchor', 'middle')
    .attr('fill', '#8b949e').attr('font-size', '9px')
    .text('Pressure Score');

  // ── Stacked area chart ──────────────────────────────────────
  const stack = d3.stack()
    .keys(COMPONENTS.map(c => c.key))
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(pressureData);

  const area = d3.area()
    .x(d => xScale(d.data.round))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  const colorMap = new Map(COMPONENTS.map(c => [c.key, c.color]));

  g.selectAll('.pressure-area').data(series)
    .join('path')
    .attr('class', 'pressure-area')
    .attr('d', area)
    .attr('fill', d => colorMap.get(d.key))
    .attr('opacity', 0.6)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.9);
      const comp = COMPONENTS.find(c => c.key === d.key);
      showTooltip(event, `<strong>${comp?.label || d.key}</strong>`);
    })
    .on('mousemove', event => showTooltip(event))
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.6);
      hideTooltip();
    });

  // Total line on top
  const line = d3.line()
    .x(d => xScale(d.round))
    .y(d => yScale(d.total))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(pressureData)
    .attr('fill', 'none')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('d', line);

  // ── Stock price overlay (real data from market_snapshot) ────
  const stockData = pressureData
    .filter(d => d.stockPrice != null && !isNaN(d.stockPrice));

  if (stockData.length > 1) {
    const stockYScale = d3.scaleLinear()
      .domain([d3.min(stockData, d => d.stockPrice) * 0.9, d3.max(stockData, d => d.stockPrice) * 1.1])
      .range([height, 0]);

    const stockLine = d3.line()
      .x(d => xScale(d.round))
      .y(d => stockYScale(d.stockPrice))
      .defined(d => d.stockPrice != null)
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(stockData)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '6 3')
      .attr('d', stockLine);

    // Stock price axis on right
    g.append('g')
      .attr('class', 'timeline-axis')
      .attr('transform', `translate(${width}, 0)`)
      .call(d3.axisRight(stockYScale).ticks(4).tickFormat(d => `$${d}`))
      .selectAll('text').attr('fill', '#60a5fa');

    g.append('text')
      .attr('x', width + 14).attr('y', -4)
      .attr('fill', '#60a5fa').attr('font-size', '7px')
      .text('$TTHR');
  }

  // ── Breach line ─────────────────────────────────────────────
  g.append('line')
    .attr('x1', xScale(22)).attr('x2', xScale(22))
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', '#ff4444').attr('stroke-width', 2)
    .attr('stroke-dasharray', '6 3');

  g.append('text')
    .attr('x', xScale(22) + 4).attr('y', 12)
    .attr('fill', '#ff4444').attr('font-size', '9px')
    .attr('font-weight', 'bold')
    .text('BREACH');

  // ── Round indicator line ────────────────────────────────────
  g.append('line')
    .attr('class', 'round-indicator')
    .attr('x1', xScale(state.currentRound))
    .attr('x2', xScale(state.currentRound))
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', '#0d9488')
    .attr('stroke-width', 2)
    .attr('opacity', 0.8);

  // ── Legend ──────────────────────────────────────────────────
  const legend = g.append('g').attr('transform', `translate(${width - 280}, 0)`);
  COMPONENTS.forEach((comp, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = col * 95;
    const y = row * 14;
    legend.append('rect')
      .attr('x', x).attr('y', y).attr('width', 8).attr('height', 8)
      .attr('rx', 1).attr('fill', comp.color);
    legend.append('text')
      .attr('x', x + 12).attr('y', y + 8)
      .attr('fill', '#8b949e').attr('font-size', '7px')
      .text(comp.label);
  });

  // Store scales for updates
  g._xScale = xScale;
}

function updateRoundIndicator() {
  if (!g._xScale) return;
  g.select('.round-indicator')
    .attr('x1', g._xScale(state.currentRound))
    .attr('x2', g._xScale(state.currentRound));
}

function startPlay() {
  stopPlay();
  playTimer = d3.interval(() => {
    state.currentRound++;
    if (state.currentRound > 23) {
      state.currentRound = 23;
      stopPlay();
      return;
    }
    d3.select('#pressure-slider').property('value', state.currentRound);
    d3.select('#pressure-round-label').text(`Round ${state.currentRound}`);
    updateRoundIndicator();
    dispatch.call('roundChange', null, state.currentRound);
  }, 800); // 800ms per round
}

function stopPlay() {
  if (playTimer) {
    playTimer.stop();
    playTimer = null;
  }
}

function resetPlay() {
  stopPlay();
  state.currentRound = 1;
  d3.select('#pressure-slider').property('value', 1);
  d3.select('#pressure-round-label').text('Round 1');
  updateRoundIndicator();
  dispatch.call('roundChange', null, 1);
}

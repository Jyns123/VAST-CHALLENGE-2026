/**
 * narrative.js — Narrative Evidence Panel & Tooltip
 * 
 * Provides:
 * 1. Evidence cards: detailed view of selected agent, event, or message
 * 2. Shared tooltip: HTML tooltip that follows cursor across all views
 * 3. Copy/Export: allows legal team to extract evidence for reports
 * 
 * Design rationale:
 * - Right panel provides contextual detail without cluttering the visualizations
 * - Evidence cards include ALL forensically relevant fields: timestamps, agent,
 *   channel, declared_action, internal_state, monitoring status, content
 * - Export function produces clean text suitable for legal documentation
 */

import { state, dispatch } from './state.js?v=2';

const tooltipEl = () => d3.select('#tooltip');

// ── Tooltip functions (shared by all views) ───────────────────

export function showTooltip(event, html) {
  const tt = tooltipEl();
  if (html) tt.html(html);
  tt.classed('visible', true)
    .style('left', (event.clientX + 12) + 'px')
    .style('top', (event.clientY - 10) + 'px');
}

export function hideTooltip() {
  tooltipEl().classed('visible', false);
}

// ── Narrative Panel ───────────────────────────────────────────

export function initNarrative() {
  dispatch.on('filterChange.narrativeLens', renderHypothesisLens);
  dispatch.on('agentSelect.narrative', showAgentNarrative);
  dispatch.on('eventSelect.narrative', showEventNarrative);
  dispatch.on('messageSelect.narrative', showMessageNarrative);

  // Copy button
  d3.select('#btn-copy-evidence').on('click', copyEvidence);
  d3.select('#btn-export-evidence').on('click', exportEvidence);

  renderHypothesisLens();
}

function renderHypothesisLens() {
  if (!state.data) return;

  const container = d3.select('#hypothesis-scoreboard');
  if (container.empty()) return;

  const msgs = state.filteredMessages.length > 0 ? state.filteredMessages : state.data.messages;
  const total = msgs.length;

  if (total === 0) {
    container.html('<div class="lens-card"><h4>MC1 Causal Lens</h4><p class="lens-empty">No messages for current filters.</p></div>');
    return;
  }

  const sensitive = msgs.filter(m => m.sensitivity >= 4);
  const merger = msgs.filter(m => m.mentions_merger);
  const unmonitoredSensitive = sensitive.filter(m => !m.monitored_by_judge);
  const privateMsgs = msgs.filter(m => m.is_private_channel);
  const publicMsgs = msgs.filter(m => m.is_public_channel);
  const privateSensitive = privateMsgs.filter(m => m.sensitivity >= 4);
  const publicSensitive = publicMsgs.filter(m => m.sensitivity >= 4);
  const crisisMsgs = msgs.filter(m => m.round >= 14 && m.round <= 22);
  const preMsgs = msgs.filter(m => m.round <= 8);
  const crisisAvgSensitivity = d3.mean(crisisMsgs, d => d.sensitivity) || 0;
  const preAvgSensitivity = d3.mean(preMsgs, d => d.sensitivity) || 0;
  const escalationDelta = Math.max(0, (crisisAvgSensitivity - preAvgSensitivity) / 4);
  const leakageMsgs = sensitive.filter(m => m.channel === 'personal_post' || m.channel === 'anonymous_post');
  const earlyMerger = msgs.filter(m => m.round <= 13 && m.mentions_merger);
  const oneToOne = msgs.filter(m => m.channel === 'one_on_one_chat' || m.channel === 'side_huddle');

  const governanceGap = clamp01(ratio(unmonitoredSensitive.length, sensitive.length || total));
  const channelLeakage = clamp01(ratio(leakageMsgs.length, sensitive.length || total));
  const semanticRisk = clamp01(0.65 * ratio(sensitive.length, total) + 0.35 * ratio(merger.length, total));
  const temporalEscalation = clamp01(0.45 * ratio(crisisMsgs.length, total) + 0.55 * escalationDelta);
  const coordinationStrain = clamp01(0.55 * ratio(oneToOne.length, total) + 0.45 * Math.max(0, ratio(privateSensitive.length, privateMsgs.length || 1) - ratio(publicSensitive.length, publicMsgs.length || 1) + 0.2));

  const h1 = clamp01(0.45 * channelLeakage + 0.35 * semanticRisk + 0.20 * ratio(earlyMerger.length, total));
  const h2 = clamp01(0.40 * governanceGap + 0.35 * coordinationStrain + 0.25 * temporalEscalation);
  const h3 = clamp01(0.5 * (h1 + h2) + 0.2 * (1 - Math.abs(h1 - h2)));

  const dims = [
    { label: 'Governance Gap', value: governanceGap },
    { label: 'Channel Leakage', value: channelLeakage },
    { label: 'Semantic Risk', value: semanticRisk },
    { label: 'Temporal Escalation', value: temporalEscalation },
    { label: 'Coordination Strain', value: coordinationStrain }
  ];

  const hypotheses = [
    { id: 'h1', label: 'H1 Deliberada', value: h1 },
    { id: 'h2', label: 'H2 Sistemica', value: h2 },
    { id: 'h3', label: 'H3 Hibrida', value: h3 }
  ];
  const best = hypotheses.reduce((a, b) => (a.value >= b.value ? a : b));

  const phaseMetrics = [
    {
      id: 'pre',
      label: 'Pre',
      msgs: msgs.filter(m => m.round <= 8)
    },
    {
      id: 'judge',
      label: 'Judge',
      msgs: msgs.filter(m => m.round >= 9 && m.round <= 13)
    },
    {
      id: 'crisis',
      label: 'Crisis',
      msgs: msgs.filter(m => m.round >= 14 && m.round <= 22)
    },
    {
      id: 'post',
      label: 'Post',
      msgs: msgs.filter(m => m.round >= 23)
    }
  ].map(p => {
    const pTotal = p.msgs.length;
    const pSensitive = p.msgs.filter(m => m.sensitivity >= 4).length;
    const pBlind = p.msgs.filter(m => !m.monitored_by_judge && m.sensitivity >= 4).length;
    const pMerger = p.msgs.filter(m => m.mentions_merger).length;
    return {
      ...p,
      total: pTotal,
      intensity: clamp01(0.5 * ratio(pSensitive, pTotal || 1) + 0.3 * ratio(pBlind, pTotal || 1) + 0.2 * ratio(pMerger, pTotal || 1))
    };
  });

  const simplex = buildSimplexSvg({ h1, h2, h3 });

  container.html(`
    <div class="lens-card">
      <h4>MC1 Causal Lens</h4>
      <div class="lens-meta">${total} messages in current scope</div>

      <div class="lens-innovation-grid">
        <div class="lens-simplex-card">
          <div class="lens-subtitle">Scenario Simplex</div>
          ${simplex}
          <div class="lens-caption">Point position expresses weighted evidence across H1/H2/H3.</div>
        </div>
        <div class="lens-phase-card">
          <div class="lens-subtitle">Phase Fingerprint</div>
          <div class="phase-fingerprint">
            ${phaseMetrics.map(p => `
              <div class="phase-chip phase-${p.id}">
                <span>${p.label}</span>
                <div class="phase-meter"><i style="height:${(p.intensity * 100).toFixed(1)}%"></i></div>
                <small>${(p.intensity * 100).toFixed(0)}</small>
              </div>
            `).join('')}
          </div>
          <div class="lens-caption">Intensity blends sensitive rate, blind spots, and merger signal.</div>
        </div>
      </div>

      <div class="lens-dimensions">
        ${dims.map(d => `
          <div class="lens-row">
            <span>${d.label}</span>
            <div class="lens-bar"><i style="width:${(d.value * 100).toFixed(1)}%"></i></div>
            <strong>${(d.value * 100).toFixed(0)}</strong>
          </div>
        `).join('')}
      </div>
      <div class="lens-hypothesis">
        ${hypotheses.map(h => `
          <div class="hyp-score ${h.id === best.id ? 'winner' : ''}">
            <span>${h.label}</span>
            <strong>${(h.value * 100).toFixed(0)}%</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `);

  d3.select('.hyp-deliberada').classed('active', best.id === 'h1');
  d3.select('.hyp-sistemica').classed('active', best.id === 'h2');
  d3.select('.hyp-hibrida').classed('active', best.id === 'h3');
}

function buildSimplexSvg({ h1, h2, h3 }) {
  const w = 180;
  const h = 140;

  const vH1 = { x: 20, y: 118 };
  const vH2 = { x: 160, y: 118 };
  const vH3 = { x: 90, y: 18 };

  const sum = (h1 + h2 + h3) || 1;
  const pH1 = h1 / sum;
  const pH2 = h2 / sum;
  const pH3 = h3 / sum;

  const px = pH1 * vH1.x + pH2 * vH2.x + pH3 * vH3.x;
  const py = pH1 * vH1.y + pH2 * vH2.y + pH3 * vH3.y;

  return `
    <svg class="lens-simplex" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <polygon points="${vH1.x},${vH1.y} ${vH2.x},${vH2.y} ${vH3.x},${vH3.y}" class="simplex-tri"></polygon>
      <line x1="${vH3.x}" y1="${vH3.y}" x2="${(vH1.x + vH2.x) / 2}" y2="${(vH1.y + vH2.y) / 2}" class="simplex-grid"></line>
      <line x1="${vH1.x}" y1="${vH1.y}" x2="${(vH2.x + vH3.x) / 2}" y2="${(vH2.y + vH3.y) / 2}" class="simplex-grid"></line>
      <line x1="${vH2.x}" y1="${vH2.y}" x2="${(vH1.x + vH3.x) / 2}" y2="${(vH1.y + vH3.y) / 2}" class="simplex-grid"></line>

      <line x1="${vH1.x}" y1="${vH1.y}" x2="${px}" y2="${py}" class="simplex-link h1"></line>
      <line x1="${vH2.x}" y1="${vH2.y}" x2="${px}" y2="${py}" class="simplex-link h2"></line>
      <line x1="${vH3.x}" y1="${vH3.y}" x2="${px}" y2="${py}" class="simplex-link h3"></line>

      <circle cx="${px}" cy="${py}" r="7" class="simplex-point"></circle>
      <text x="${vH1.x - 8}" y="${vH1.y + 14}" class="simplex-label h1">H1</text>
      <text x="${vH2.x + 2}" y="${vH2.y + 14}" class="simplex-label h2">H2</text>
      <text x="${vH3.x - 8}" y="${vH3.y - 6}" class="simplex-label h3">H3</text>
    </svg>
  `;
}

function ratio(num, den) {
  if (!den) return 0;
  return num / den;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function showAgentNarrative(agentId) {
  if (!state.data || !agentId) return;

  const agent = state.data.agentMap.get(agentId);
  if (!agent) return;

  const agentMsgs = state.data.messages.filter(m => m.agent === agentId);
  const sensitiveMsgs = agentMsgs.filter(m => m.sensitivity >= 4);
  const mergerMsgs = agentMsgs.filter(m => m.mentions_merger);
  const unmonitoredSensitive = sensitiveMsgs.filter(m => !m.monitored_by_judge);

  const container = d3.select('#narrative-content');
  container.html('');

  // Agent summary card
  const card = container.append('div')
    .attr('class', `evidence-card ${agent.breach_involved ? 'breach' : ''}`);

  card.append('h4').text(`Agent: ${agent.name}`);
  card.append('div').attr('class', 'meta').html(`
    <span>Role: ${agent.role_label}</span><br>
    <span>First critical event: Round ${agent.first_critical_event_round}</span>
  `);

  card.append('div').attr('class', 'content-text').html(`
    Total messages: ${agentMsgs.length}<br>
    Sensitive messages: ${sensitiveMsgs.length}<br>
    Merger mentions: ${mergerMsgs.length}<br>
    Unmonitored + sensitive: ${unmonitoredSensitive.length}<br>
    Internal states: ${agent.internal_states.join(', ')}<br>
    Breach involved: ${agent.breach_involved ? '⚠️ YES' : 'No'}
  `);

  card.append('p').style('font-size', '0.8rem').style('color', '#8b949e')
    .text(agent.description);

  const tags = card.append('div').attr('class', 'tags');
  if (agent.breach_involved) tags.append('span').attr('class', 'tag tag-breach').text('BREACH');
  tags.append('span').attr('class', 'tag tag-monitored').text(agent.role);

  // Show recent messages from this agent
  container.append('h4').style('margin', '12px 0 6px').style('color', '#0d9488').style('font-size', '0.8rem')
    .text(`Recent messages (${Math.min(agentMsgs.length, 5)} of ${agentMsgs.length})`);

  agentMsgs.slice(-5).forEach(m => renderMessageCard(container, m));
}

function showEventNarrative(eventId) {
  if (!state.data || !eventId) return;

  const event = state.data.events.find(e => e.id === eventId);
  if (!event) return;

  const container = d3.select('#narrative-content');
  container.html('');

  const card = container.append('div')
    .attr('class', `evidence-card ${event.type === 'breach' ? 'breach' : ''}`);

  card.append('h4').text(event.label);
  card.append('div').attr('class', 'meta').html(`
    <span>🕐 ${d3.timeFormat('%H:%M:%S')(event.time)}</span>
    <span>Round ${event.round}</span>
    <span>Severity: ${'★'.repeat(event.severity)}${'☆'.repeat(5 - event.severity)}</span>
  `);

  const agent = state.data.agentMap.get(event.agent);
  card.append('div').attr('class', 'content-text').html(`
    Agent: ${agent?.name || event.agent}<br>
    Type: ${event.type}<br><br>
    ${event.description}
  `);

  const tags = card.append('div').attr('class', 'tags');
  tags.append('span').attr('class', `tag tag-${event.severity >= 4 ? 'sensitive' : 'monitored'}`).text(event.type);
  if (event.type === 'breach') tags.append('span').attr('class', 'tag tag-breach').text('BREACH');

  // Show related messages
  const relatedMsgs = state.data.messages.filter(m => 
    m.round === event.round && m.agent === event.agent
  );
  if (relatedMsgs.length > 0) {
    container.append('h4').style('margin', '12px 0 6px').style('color', '#0d9488').style('font-size', '0.8rem')
      .text('Related messages');
    relatedMsgs.forEach(m => renderMessageCard(container, m));
  }
}

function showMessageNarrative(messageId) {
  if (!state.data || !messageId) return;

  const msg = state.data.messageMap.get(messageId);
  if (!msg) return;

  const container = d3.select('#narrative-content');
  container.html('');

  renderMessageCard(container, msg, true);

  // Show the responding_to chain
  if (msg.responding_to) {
    container.append('h4').style('margin', '12px 0 6px').style('color', '#d29922').style('font-size', '0.8rem')
      .text('↩️ Responding to:');
    const parent = state.data.messageMap.get(msg.responding_to);
    if (parent) renderMessageCard(container, parent);
  }

  // Show messages responding to this one
  const responses = state.data.messages.filter(m => m.responding_to === messageId);
  if (responses.length > 0) {
    container.append('h4').style('margin', '12px 0 6px').style('color', '#0d9488').style('font-size', '0.8rem')
      .text(`↪️ Responses (${responses.length}):`);
    responses.forEach(m => renderMessageCard(container, m));
  }
}

function renderMessageCard(container, msg, expanded = false) {
  const agent = state.data.agentMap.get(msg.agent);
  const channel = state.data.channelMap.get(msg.channel);

  const card = container.append('div')
    .attr('class', `evidence-card ${msg.is_breach ? 'breach' : ''}`)
    .style('cursor', 'pointer')
    .on('click', () => {
      import('./state.js?v=2').then(({ selectMessage }) => selectMessage(msg.id));
    });

  card.append('h4').html(`
    <span style="color:${agent?.color || '#8b949e'}">${agent?.name || msg.agent}</span>
    → ${channel?.label || msg.channel}
  `);

  card.append('div').attr('class', 'meta').html(`
    <span>🕐 ${d3.timeFormat('%H:%M:%S')(msg.time)}</span>
    <span>R${msg.round}</span>
    <span>${msg.declared_action}</span>
  `);

  card.append('div').attr('class', 'content-text').text(
    expanded ? msg.content : (msg.content.length > 120 ? msg.content.substring(0, 120) + '…' : msg.content)
  );

  if (expanded) {
    card.append('div').attr('class', 'meta').html(`
      <span>Internal state: <strong>${msg.internal_state}</strong></span><br>
      <span>Sensitivity: ${'★'.repeat(msg.sensitivity)}${'☆'.repeat(5 - msg.sensitivity)}</span><br>
      <span>Monitored by Judge: ${msg.monitored_by_judge ? '✅ Yes' : '❌ No'}</span><br>
      <span>Recipients: ${Array.isArray(msg.recipients) ? msg.recipients.join(', ') : msg.recipients}</span>
    `);
  }

  const tags = card.append('div').attr('class', 'tags');
  if (msg.is_breach) tags.append('span').attr('class', 'tag tag-breach').text('BREACH');
  if (msg.sensitivity >= 4) tags.append('span').attr('class', 'tag tag-sensitive').text('Sensitive');
  if (msg.mentions_merger) tags.append('span').attr('class', 'tag tag-merger').text('Merger');
  if (msg.monitored_by_judge) {
    tags.append('span').attr('class', 'tag tag-monitored').text('Monitored');
  } else {
    tags.append('span').attr('class', 'tag tag-unmonitored').text('Unmonitored');
  }
}

// ── Copy & Export ─────────────────────────────────────────────

function copyEvidence() {
  const content = d3.select('#narrative-content').node();
  if (!content) return;

  const text = extractTextFromPanel(content);
  navigator.clipboard.writeText(text).then(() => {
    const btn = d3.select('#btn-copy-evidence');
    btn.text('✅ Copied!');
    setTimeout(() => btn.text('📋 Copy to Clipboard'), 2000);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
}

function exportEvidence() {
  const content = d3.select('#narrative-content').node();
  if (!content) return;

  const text = [
    '═══════════════════════════════════════════════════════════════',
    'CAUSAL BREACH OBSERVATORY — EVIDENCE EXPORT',
    'TenantThread VAST Challenge 2026 MC1',
    `Export date: ${new Date().toISOString()}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    extractTextFromPanel(content),
    '',
    '═══════════════════════════════════════════════════════════════',
    'END OF EVIDENCE EXPORT',
    '═══════════════════════════════════════════════════════════════'
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evidence_export_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function extractTextFromPanel(element) {
  // Walk DOM and extract readable text
  const lines = [];
  element.querySelectorAll('.evidence-card').forEach(card => {
    const h4 = card.querySelector('h4');
    const meta = card.querySelectorAll('.meta');
    const content = card.querySelector('.content-text');
    const tags = card.querySelector('.tags');

    if (h4) lines.push(`\n--- ${h4.textContent.trim()} ---`);
    meta.forEach(m => lines.push(m.textContent.trim()));
    if (content) lines.push(`Content: ${content.textContent.trim()}`);
    if (tags) lines.push(`Tags: ${tags.textContent.trim()}`);
    lines.push('');
  });
  return lines.join('\n');
}

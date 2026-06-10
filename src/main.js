/**
 * main.js — Application entry point & orchestrator
 * 
 * Initializes all modules in order:
 * 1. Load data
 * 2. Set up state
 * 3. Initialize filters
 * 4. Initialize all five views
 * 5. Initialize narrative panel
 * 6. Trigger initial render via applyFilters()
 * 
 * Also sets up cross-view coordination via D3 dispatch listeners.
 */

import { loadAllData } from './dataLoader.js?v=2';
import { state, dispatch, applyFilters } from './state.js?v=2';
import { initFilters } from './filters.js?v=2';
import { initGalaxy } from './v1-galaxy.js?v=2';
import { initTimeline } from './v2-timeline.js?v=2';
import { initEgoChain } from './v3-egochain.js?v=2';
import { initJudgeMap } from './v4-judgemap.js?v=2';
import { initPressure } from './v5-pressure.js?v=2';
import { initNarrative } from './narrative.js?v=2';

async function main() {
  try {
    console.log('🔭 Causal Breach Observatory — Initializing...');

    // 1. Load all data
    const data = await loadAllData();
    state.data = data;
    console.log(`   ✓ Data loaded: ${data.agents.length} agents, ${data.channels.length} channels, ${data.events.length} events, ${data.messages.length} messages`);

    // 2. Initialize filter panel (needs data to populate checkboxes)
    initFilters();
    console.log('   ✓ Filters initialized');

    // 3. Initialize all views
    initGalaxy();
    console.log('   ✓ V1: Agent Galaxy initialized');

    initTimeline();
    console.log('   ✓ V2: Causal Timeline initialized');

    initEgoChain();
    console.log('   ✓ V3: Ego-Chain initialized');

    initJudgeMap();
    console.log('   ✓ V4: Judge Coverage Map initialized');

    initPressure();
    console.log('   ✓ V5: Pressure Replay initialized');

    // 4. Initialize narrative panel
    initNarrative();
    console.log('   ✓ Narrative panel initialized');

    // 5. Populate KPI dashboard with real data
    updateKPIs(data);

    // 6. Set up cross-view coordination
    setupCrossViewCoordination();

    // 7. Trigger initial render
    applyFilters();
    console.log('   ✓ Initial render complete');
    console.log('🔭 Causal Breach Observatory — Ready!');

  } catch (error) {
    console.error('Failed to initialize Causal Breach Observatory:', error);
    d3.select('#viz-area').append('div')
      .style('color', '#f85149')
      .style('padding', '40px')
      .style('text-align', 'center')
      .style('font-size', '1.1rem')
      .html(`
        <h2>⚠️ Error Loading Data</h2>
        <p>Could not load data files. Make sure to serve this project from a local HTTP server:</p>
        <code style="display:block;margin:10px;padding:10px;background:#1c2128;border-radius:4px;">
          python -m http.server 8000
        </code>
        <p>Then open <a href="http://localhost:8000" style="color:#58a6ff;">http://localhost:8000</a></p>
        <p style="color:#8b949e;font-size:0.85rem;">Error: ${error.message}</p>
      `);
  }
}

/**
 * Set up coordination between views that goes beyond simple filter changes.
 * For example, when the pressure replay changes round, update the timeline brush
 * and ego-chain to highlight messages up to that round.
 */
function setupCrossViewCoordination() {
  // When round changes (pressure replay), filter messages up to that round
  dispatch.on('roundChange.main', (round) => {
    // Update filtered data to show only messages up to current round
    if (state.data) {
      const roundMsgs = state.data.messages.filter(m => m.round <= round);
      // Don't override filters, just update the round-based view
      d3.select('#pressure-round-label').text(
        `Round ${round} — ${roundMsgs.length} messages`
      );
    }
  });

  // When an agent is selected in any view, highlight in all views
  dispatch.on('agentSelect.main', (agentId) => {
    if (!agentId) return;
    // Update narrative panel is already handled by narrative.js
    // Galaxy and JudgeMap highlight are handled by their own dispatch listeners
    console.log(`Agent selected: ${agentId}`);
  });
}

// ── Start the application ─────────────────────────────────────

/**
 * Populate KPI dashboard with real data stats from the EDA.
 */
function updateKPIs(data) {
  const totalMsgs = data.messages.length;
  // Crisis day = rounds 14-23 (June 5)
  const crisisMsgs = data.messages.filter(m => m.round >= 14).length;
  const crisisPct = ((crisisMsgs / totalMsgs) * 100).toFixed(1);
  const sensitiveMsgs = data.messages.filter(m => m.sensitivity >= 4).length;

  d3.select('#kpi-rounds').text(23);
  d3.select('#kpi-messages').text(totalMsgs);
  d3.select('#kpi-agents').text(data.agents.length);
  d3.select('#kpi-channels').text(data.channels.length);
  d3.select('#kpi-crisis').text(`${crisisPct}%`);
  d3.select('#kpi-sensitive').text(sensitiveMsgs);
}

main();

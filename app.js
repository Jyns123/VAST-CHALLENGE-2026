/* ============================================================================
   AgentFlow — Investigative Visual Analytics Platform
   D3.js v7. ONE condensed, linked view: the "Behavioral Drift Braid".

   Design
   ------
   Every agent is a THREAD travelling through a vertical ladder of
   communication postures (monitored team channel → private → covert →
   public-official → public-personal → public-anonymous). The braid makes
   behavioral drift literally visible: threads that dive below the red
   "embargo enforcement perimeter" are exposing content publicly.

   Layers composited on the same canvas (all toggleable):
     · per-agent BASELINE posture lines (expected behavior)
     · covert COORDINATION ARCS (who side-huddled with whom, per round)
     · JUDGE GATES (compliance interventions: held vs. breached) + the
       detected "Judge silent" enforcement gap
     · the curated CAUSAL EVENT CHAIN E01→E12 with decision arrows
     · violation rings / boundary-test diamonds (leading indicators)
   Below: a LEADING-INDICATOR SEISMOGRAPH (composite anomaly score vs $TTHR)
   Bottom-right: 🧭 KEY QUESTIONS — each question refocuses the braid and
   surfaces the written answer + linked evidence.

   STATE      global cross-filter (time / actors / channels / flags / search)
   HL         analytic focus (agents / events) driven by questions & clicks
   filtered() single source of truth — the message set passing all filters
   ============================================================================ */

const CH_ORDER = ["comms_huddle","side_huddle","one_on_one_chat",
                  "official_post","personal_post","anonymous_post"];
let CH_LABEL = {comms_huddle:"Comms Huddle", side_huddle:"Side Huddle (covert)",
  one_on_one_chat:"1:1 Chat", official_post:"Official Post",
  personal_post:"Personal Post", anonymous_post:"Anonymous Post"};
const FLAGS = ["merger","embargo","execution","compliance","governance"];
let FLAG_LABEL = {merger:"Merger lang", embargo:"Embargo lang", execution:"Execution lang",
  compliance:"Compliance lang", governance:"Governance lang", violation:"Embargo VIOLATION",
  public:"Public posts only", internal_state:"Has internal reasoning"};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const chColor = (c) => css("--c-" + c) || "#888";

const AGENT_COLOR = d3.scaleOrdinal()
  .domain(["legal_agent","social_media_agent","quality_agent","pr_agent",
           "pr_intern_agent","intern_agent","judge_agent"])
  .range(["#ef4444","#a855f7","#2dd4bf","#5b8def","#38bdf8","#facc15","#94a3b8"]);

const PHASE_COLOR={seed:"#64708c",coordination:"#a855f7",control:"#5b8def",
  pressure:"#f59e0b",leak_buildup:"#f97316",boundary_test:"#f97316",breach:"#ef4444",aftermath:"#2dd4bf"};

/* the covert→public posture ladder (y axis of the braid) */
const POSTURE = {comms_huddle:0, one_on_one_chat:1, side_huddle:2,
                 official_post:3, personal_post:4, anonymous_post:5};
const ZONES = [
  {ch:"comms_huddle",    label:"TEAM HUDDLE",     sub:"monitored"},
  {ch:"one_on_one_chat", label:"1:1 CHAT",        sub:"private"},
  {ch:"side_huddle",     label:"SIDE HUDDLE",     sub:"covert"},
  {ch:"official_post",   label:"OFFICIAL POST",   sub:"sanctioned · public"},
  {ch:"personal_post",   label:"PERSONAL POST",   sub:"unsanctioned · public"},
  {ch:"anonymous_post",  label:"ANONYMOUS POST",  sub:"untraceable · public"},
];

/* ============================================================================
   i18n — English / Spanish. The toggle repopulates the label lookups and
   re-renders. Raw 912 message bodies stay in their original language (they are
   the primary evidence); everything analyst-facing is translated.
   ============================================================================ */
let LANG = localStorage.getItem("hc-lang") || "en";

const I18N = {
  en:{
    brand_sub:"Investigative Visual Analytics · TenantThread Embargo Breach",
    rail_search:"SEARCH", search_ph:"search messages, actors, keywords…",
    rail_time:"TIME WINDOW", reset:"reset", time_full:"full timeline",
    time_hint:"draw a lasso on the braid to select the nodes inside it",
    lasso_sel:"lasso selection",
    rail_actors:"ACTORS", rail_channels:"CHANNELS", rail_flags:"EVIDENCE FILTERS",
    rail_hyp:"HYPOTHESES", hyp_hint:"click to focus evidence",
    qfab:"Key Questions", qp_title:"INVESTIGATION QUESTIONS", qp_reset:"reset view",
    qp_hint:"Click a question — the braid refocuses to show the answer, with linked evidence.",
    insp_title:"EVIDENCE INSPECTOR", clear:"clear",
    insp_empty:"Hover or click any element to inspect the underlying communications. Click an agent's name at the right edge of the braid for its behavioral profile (baseline vs. crisis). Shift-click to add several selections together.",
    braid_h2:"Behavioral Drift Braid — every agent's trajectory down the covert-to-public ladder",
    braid_sub:"Each <b>thread is an agent</b>; its vertical position each round is the agent's average communication posture (top = monitored team channel, bottom = untraceable anonymous posting). Thread thickness = message volume. Crossing the red <b>enforcement perimeter</b> means content became publicly visible. Purple arcs = covert side-huddle ties · ⚖ gates = Judge interventions (green held / red breached) · numbered nodes = the causal chain E01→E12. <b>Lasso</b> around any nodes to select them; click anything to inspect.",
    layer_baselines:"· expected baseline", layer_arcs:"∿ covert ties", layer_gates:"⚖ judge gates",
    layer_events:"● event chain", layer_arrows:"→ causal arrows", focus_label:"focus",
    embargo_perimeter:"▼ PUBLIC EXPOSURE — embargo enforcement perimeter",
    mk_breach:"breach ~17:25 ", mk_embargo:" EMBARGO 18:00", judge_silent:"JUDGE SILENT",
    x_caption:"◄ daily rounds (May 17 – Jun 4) · hourly rounds on crisis day (Jun 5) ►",
    x_title:"TIME  (round) →",
    y_title:"COMMUNICATION POSTURE  ▲ monitored · ▼ public / anonymous",
    cp_title:"Critical Path — the 12-step causal chain, in time order",
    cp_desc:"Read it left → right. Each step shows <b>exactly when it happened</b> and the <b>time gap (Δ) since the previous step</b> — so you can see the pace: weeks of slow build-up, then everything detonates within minutes on the crisis day. The badge colour is the phase. Click any step to load its evidence.",
    cp_crisis:"⎯⎯ CRISIS DAY · Jun 5 ⎯⎯", cp_ignored:"⊘ ignored",
    cp_delta_now:"start", cp_d:"d", cp_h:"h", cp_m:"min",
    seis_title:"Leading-Indicator Seismograph — when did the system start trembling?",
    seis_desc:"How to read it: each bar is one round's <b>composite anomaly score</b> = flagged-language sensitivity (×0.4) + covert messages (×1) + boundary tests (×3) + embargo violations (×6). Taller, warmer bars = riskier rounds. The dashed lines are the pre-crisis mean +1σ (early-warning) and +2σ (alert) thresholds — bars rising above them are abnormal. The blue line is the $TTHR share price. The three tick rows below count, per round, covert messages (∿), boundary tests (◆) and violations (✕). Click any bar or tick to load that round's evidence.",
    seis_w1:"+1σ early warning", seis_w2:"+2σ alert",
    seis_row_covert:"covert", seis_row_boundary:"boundary", seis_row_violation:"violation",
    seis_anom_axis:"anomaly score", seis_legend:"legend",
    lg_normal:"normal", lg_w1:"≥ +1σ", lg_w2:"≥ +2σ", lg_viol:"has violation",
    lg_stock:"$TTHR share price", lg_rows:"row glyphs: ∿ covert · ◆ boundary test · ✕ violation",
    tt_covert:"covert tie", tt_sidehuddle_msgs:"side-huddle message(s)",
    tt_covert_posts:"public posts by this pair — click to load (right)",
    tt_posts:"post(s)", tt_violation:"EMBARGO VIOLATION", tt_boundary:"boundary test",
    tt_boundary_b:"public post with merger/embargo language — skirts the embargo without violating it. A leading indicator.",
    tt_msgs:"msgs", tt_public:"public", tt_boundary_lc:"boundary test",
    tt_gap_h:"⚠ enforcement gap",
    tt_gap_b:"Judge produced <b>zero output</b> during these rounds while covert ties, boundary tests and the first violations were occurring — the oversight blind spot that let the buildup go unchecked.",
    tt_judge:"Judge intervention", tt_breached:"BREACHED", tt_held:"HELD",
    tt_rulings:"ruling(s)",
    tt_breached_note:"A violation followed within 2 rounds — the ruling did not stop behavior.",
    tt_held_note:"No violation followed — compliance held.",
    tt_phase:"phase", tt_actor:"actor", tt_click_profile:"click → behavioral profile (expected vs. observed) and thread focus",
    tt_ceiling:"⊘ ceiling warning ignored →",
    tt_anomaly:"anomaly", tt_flagged:"flagged sensitivity", tt_events_suffix:"event(s)",
    ins_count:"{n} communication(s)", ins_none:"No communications match this selection.",
    ins_cleared:"Selection cleared.", ins_multi:"{n} selections · {m} messages",
    mc_internal:"internal:", mc_everyone:"Everyone", mc_violation:"VIOLATION", mc_to:"To:",
    mc_more:"read full message ▾", mc_less:"collapse ▴",
    pf_profile:"behavioral profile", pf_baseline:"baseline msgs", pf_crisis:"crisis-day msgs",
    pf_deviation:"deviation (L1)", pf_leak:"leak actions", pf_covert:"covert msgs", pf_anon:"anonymous posts",
    pf_expected:"expected (baseline)", pf_observed:"observed (crisis day)",
    pf_no_new:"no new channels", pf_new:"NEW:", pf_btn_crisis:"crisis-day messages",
    pf_btn_covert:"covert messages", pf_btn_public:"public posts",
    pf_hint:"The two bars compare this agent's channel mix before vs. during June 5. A colored segment appearing only in the bottom bar = a channel this agent had never used — the core behavioral anomaly.",
    hyp_for:"FOR", hyp_against:"AGAINST", hyp_evidence_title:"HYPOTHESIS {id} — EVIDENCE",
    hyp_evidence:"Underlying evidence ({n} messages):",
    q_load:"⇣ load evidence", q_evidence_suffix:"— evidence",
    search_matches:"{n} matches", search_load:"load all →", search_quick:"quick terms",
    search_none:"no matches",
    tab_braid:"Drift Braid", tab_balance:"Hypothesis Balance",
    bal_h2:"The Balance — was the breach INTENTIONAL, or a SYSTEMIC FAILURE?",
    bal_sub:"Every communication in the current view is sorted into <b>evidence categories</b>, each carrying an evidential weight (with diminishing returns, so volume can't drown signal). Each category is a <b>weight that drops into one pan</b>: the red <b>INTENTIONAL</b> pan (a deliberate act by one or more actors) or the blue <b>SYSTEMIC FAILURE</b> pan (late controls, emergent channel dynamics, no single intent). The beam tilts toward whichever side carries more weight.",
    bal_scope:"Scored over the {n} messages currently in view — narrow the time window or actors to re-weigh.",
    bal_verdict:"VERDICT", bal_for:"FOR", bal_against:"AGAINST", bal_net:"net", bal_conf:"confidence",
    bal_confirmed:"CONFIRMED — closes", bal_rejected:"REJECTED — closes against",
    bal_open:"OPEN — contested", bal_leading:"LEADING — not decisive",
    bal_cat:"evidence category", bal_n:"hits", bal_wt:"weight", bal_contrib:"pushes",
    bal_supports:"supports", bal_counters:"counters",
    bal_method:"Method: category weight = base × (1−e^(−hits/saturation)), so the 1st hit of a category counts most and additional hits saturate. Net = ΣFOR − ΣAGAINST; confidence = net ⁄ Σnet. A hypothesis CLOSES as CONFIRMED at ≥45% with a ≥12-pt lead, or REJECTED at ≤15%.",
    bal_load:"⇣ load these messages",
    pole_intent:"INTENTIONAL", pole_system:"SYSTEMIC FAILURE",
    pole_intent_d:"A deliberate act — one or more actors chose to disclose.",
    pole_system_d:"A system-level failure — late controls, emergent channel dynamics, no single intent.",
    bal_tilt:"The evidence tilts toward", bal_tie:"near balance",
    bal_tilt_line:"The evidence tilts toward <b>{label}</b> — {iw} vs {sw}. {tail}",
    bal_tail_intent:"A single actor's deliberate disclosure outweighs the systemic explanations.",
    bal_tail_system:"The breach reads as a system-level failure more than one actor's intent — though the final confirmation (E10/E11) keeps a strong intentional signal.",
    bal_tail_tie:"Intent and systemic failure are co-present — the case does not resolve cleanly to one pole.",
    bal_pole:"drives",
    bal_winner_line:"Dominant explanation: <b>{label}</b> ({conf}%). {tail}",
    bal_tail_closed:"It closes — decisive lead over the alternatives.",
    bal_tail_open:"Leading but not decisive — <b>{other}</b> remains a strong complementary explanation; the case is not yet closed between them.",
    cat_attributable_leak:"Attributable public leak", cat_attributable_leak_d:"public merger/embargo post that violated the embargo on the official, attributable channel — a deliberate, named disclosure.",
    cat_anon_preseed:"Anonymous pre-seeding", cat_anon_preseed_d:"anonymous merger/embargo posts before the embargo lifted — priming the audience.",
    cat_covert_coord:"Covert coordination", cat_covert_coord_d:"merger/embargo talk inside the covert side-huddle channel — off-the-record alignment.",
    cat_boundary_test:"Boundary testing", cat_boundary_test_d:"public merger/embargo posts that skirt the line without technically violating — incremental disclosure.",
    cat_uncontrolled_leak:"Uncontrolled public leak", cat_uncontrolled_leak_d:"embargo violations on personal/anonymous channels — disclosure that escaped sanctioned gatekeeping.",
    cat_defensive_clarif:"Defensive clarification", cat_defensive_clarif_d:"public compliance-framed posts — 'just clarifying', each locally defensible.",
    cat_concentration:"Breach concentration", cat_concentration_d:"share of all violations committed by the top two agents — high concentration points to intent, not diffuse confusion.",
    cat_late_control:"Late-installed control", cat_late_control_d:"the Judge compliance agent was added only ~1 week before the breach (E04).",
    cat_unenforced_warning:"Unenforced final warning", cat_unenforced_warning_d:"the Judge's final ceiling warning (E09) was issued but never enforced.",
    cat_channel_reinforce:"Channel reinforcement", cat_channel_reinforce_d:"merger/embargo language appears across official + personal + anonymous public channels at once — the channels amplified each other.",
  },
  es:{
    brand_sub:"Analítica Visual de Investigación · Filtración del Embargo de TenantThread",
    rail_search:"BUSCAR", search_ph:"buscar mensajes, actores, palabras clave…",
    rail_time:"VENTANA TEMPORAL", reset:"reiniciar", time_full:"línea de tiempo completa",
    time_hint:"dibuja un lazo sobre la trenza para seleccionar los nodos que encierres",
    lasso_sel:"selección con lazo",
    rail_actors:"ACTORES", rail_channels:"CANALES", rail_flags:"FILTROS DE EVIDENCIA",
    rail_hyp:"HIPÓTESIS", hyp_hint:"clic para enfocar evidencia",
    qfab:"Preguntas Clave", qp_title:"PREGUNTAS DE INVESTIGACIÓN", qp_reset:"reiniciar vista",
    qp_hint:"Haz clic en una pregunta: la trenza se reenfoca para mostrar la respuesta, con la evidencia vinculada.",
    insp_title:"INSPECTOR DE EVIDENCIA", clear:"limpiar",
    insp_empty:"Pasa el cursor o haz clic en cualquier elemento para inspeccionar las comunicaciones. Haz clic en el nombre de un agente en el borde derecho de la trenza para ver su perfil de comportamiento (base vs. crisis). Shift+clic para sumar varias selecciones.",
    braid_h2:"Trenza de Deriva Conductual — la trayectoria de cada agente bajando la escalera de lo encubierto a lo público",
    braid_sub:"Cada <b>hilo es un agente</b>; su posición vertical en cada ronda es la postura de comunicación promedio del agente (arriba = canal de equipo monitoreado, abajo = publicación anónima no rastreable). Grosor del hilo = volumen de mensajes. Cruzar el <b>perímetro de control</b> rojo significa que el contenido se hizo visible públicamente. Arcos morados = lazos encubiertos del side-huddle · compuertas ⚖ = intervenciones del Juez (verde sostuvo / rojo violado) · nodos numerados = la cadena causal E01→E12. <b>Lazo</b> alrededor de los nodos para seleccionarlos; haz clic en cualquier cosa para inspeccionar.",
    layer_baselines:"· base esperada", layer_arcs:"∿ lazos encubiertos", layer_gates:"⚖ compuertas del juez",
    layer_events:"● cadena de eventos", layer_arrows:"→ flechas causales", focus_label:"enfoque",
    embargo_perimeter:"▼ EXPOSICIÓN PÚBLICA — perímetro de control del embargo",
    mk_breach:"filtración ~17:25 ", mk_embargo:" EMBARGO 18:00", judge_silent:"JUEZ EN SILENCIO",
    x_caption:"◄ rondas diarias (17 may – 4 jun) · rondas por hora el día de crisis (5 jun) ►",
    x_title:"TIEMPO  (ronda) →",
    y_title:"POSTURA DE COMUNICACIÓN  ▲ monitoreado · ▼ público / anónimo",
    cp_title:"Ruta Crítica — la cadena causal de 12 pasos, en orden temporal",
    cp_desc:"Léela de izquierda → derecha. Cada paso muestra <b>exactamente cuándo ocurrió</b> y el <b>tiempo transcurrido (Δ) desde el paso anterior</b> — así ves el ritmo: semanas de preparación lenta, y luego todo detona en minutos el día de la crisis. El color de la insignia es la fase. Haz clic en un paso para cargar su evidencia.",
    cp_crisis:"⎯⎯ DÍA DE CRISIS · 5 jun ⎯⎯", cp_ignored:"⊘ ignorada",
    cp_delta_now:"inicio", cp_d:"d", cp_h:"h", cp_m:"min",
    seis_title:"Sismógrafo de Indicadores Tempranos — ¿cuándo empezó a temblar el sistema?",
    seis_desc:"Cómo leerlo: cada barra es la <b>puntuación de anomalía compuesta</b> de una ronda = sensibilidad del lenguaje señalado (×0.4) + mensajes encubiertos (×1) + pruebas de límite (×3) + violaciones de embargo (×6). Barras más altas y cálidas = rondas más riesgosas. Las líneas punteadas son los umbrales de media pre-crisis +1σ (alerta temprana) y +2σ (alerta) — barras por encima son anómalas. La línea azul es el precio de la acción $TTHR. Las tres filas inferiores cuentan, por ronda, mensajes encubiertos (∿), pruebas de límite (◆) y violaciones (✕). Haz clic en cualquier barra o marca para cargar la evidencia de esa ronda.",
    seis_w1:"+1σ alerta temprana", seis_w2:"+2σ alerta",
    seis_row_covert:"encubierto", seis_row_boundary:"límite", seis_row_violation:"violación",
    seis_anom_axis:"puntaje de anomalía", seis_legend:"leyenda",
    lg_normal:"normal", lg_w1:"≥ +1σ", lg_w2:"≥ +2σ", lg_viol:"con violación",
    lg_stock:"precio acción $TTHR", lg_rows:"glifos de fila: ∿ encubierto · ◆ prueba de límite · ✕ violación",
    tt_covert:"lazo encubierto", tt_sidehuddle_msgs:"mensaje(s) de side-huddle",
    tt_covert_posts:"posts públicos de esta pareja — clic para cargar (derecha)",
    tt_posts:"post(s)", tt_violation:"VIOLACIÓN DE EMBARGO", tt_boundary:"prueba de límite",
    tt_boundary_b:"post público con lenguaje de fusión/embargo — roza el embargo sin violarlo. Un indicador temprano.",
    tt_msgs:"msgs", tt_public:"públicos", tt_boundary_lc:"prueba de límite",
    tt_gap_h:"⚠ vacío de control",
    tt_gap_b:"El Juez produjo <b>cero salida</b> durante estas rondas mientras ocurrían lazos encubiertos, pruebas de límite y las primeras violaciones — el punto ciego de supervisión que dejó crecer la acumulación sin control.",
    tt_judge:"Intervención del Juez", tt_breached:"VIOLADO", tt_held:"SOSTUVO",
    tt_rulings:"fallo(s)",
    tt_breached_note:"Una violación siguió dentro de 2 rondas — el fallo no detuvo el comportamiento.",
    tt_held_note:"No siguió ninguna violación — el cumplimiento se sostuvo.",
    tt_phase:"fase", tt_actor:"actor", tt_click_profile:"clic → perfil de comportamiento (esperado vs. observado) y enfoque del hilo",
    tt_ceiling:"⊘ advertencia de techo ignorada →",
    tt_anomaly:"anomalía", tt_flagged:"sensibilidad señalada", tt_events_suffix:"evento(s)",
    ins_count:"{n} comunicación(es)", ins_none:"Ninguna comunicación coincide con esta selección.",
    ins_cleared:"Selección limpiada.", ins_multi:"{n} selecciones · {m} mensajes",
    mc_internal:"interno:", mc_everyone:"Todos", mc_violation:"VIOLACIÓN", mc_to:"Para:",
    mc_more:"ver mensaje completo ▾", mc_less:"contraer ▴",
    pf_profile:"perfil de comportamiento", pf_baseline:"msgs base", pf_crisis:"msgs día de crisis",
    pf_deviation:"desviación (L1)", pf_leak:"acciones de filtración", pf_covert:"msgs encubiertos", pf_anon:"posts anónimos",
    pf_expected:"esperado (base)", pf_observed:"observado (día crisis)",
    pf_no_new:"sin canales nuevos", pf_new:"NUEVO:", pf_btn_crisis:"mensajes del día de crisis",
    pf_btn_covert:"mensajes encubiertos", pf_btn_public:"posts públicos",
    pf_hint:"Las dos barras comparan la mezcla de canales de este agente antes vs. durante el 5 de junio. Un segmento de color que aparece solo en la barra inferior = un canal que este agente nunca había usado — la anomalía conductual central.",
    hyp_for:"A FAVOR", hyp_against:"EN CONTRA", hyp_evidence_title:"HIPÓTESIS {id} — EVIDENCIA",
    hyp_evidence:"Evidencia subyacente ({n} mensajes):",
    q_load:"⇣ cargar evidencia", q_evidence_suffix:"— evidencia",
    search_matches:"{n} coincidencias", search_load:"cargar todo →", search_quick:"términos rápidos",
    search_none:"sin coincidencias",
    tab_braid:"Trenza de Deriva", tab_balance:"Balanza de Hipótesis",
    bal_h2:"La Balanza — ¿la filtración fue INTENCIONAL o un FALLO SISTÉMICO?",
    bal_sub:"Cada comunicación de la vista actual se clasifica en <b>categorías de evidencia</b>, cada una con un peso probatorio (con rendimientos decrecientes, para que el volumen no ahogue la señal). Cada categoría es un <b>peso que cae en un platillo</b>: el platillo rojo <b>INTENCIONAL</b> (un acto deliberado de uno o más actores) o el azul <b>FALLO SISTÉMICO</b> (controles tardíos, dinámica emergente de canales, sin intención única). El brazo se inclina hacia el lado que carga más peso.",
    bal_scope:"Puntuado sobre los {n} mensajes actualmente en vista — ajusta la ventana temporal o los actores para re-pesar.",
    bal_verdict:"VEREDICTO", bal_for:"A FAVOR", bal_against:"EN CONTRA", bal_net:"neto", bal_conf:"confianza",
    bal_confirmed:"CONFIRMADA — cierra", bal_rejected:"RECHAZADA — cierra en contra",
    bal_open:"ABIERTA — en disputa", bal_leading:"LÍDER — no decisiva",
    bal_cat:"categoría de evidencia", bal_n:"casos", bal_wt:"peso", bal_contrib:"empuja",
    bal_supports:"apoya", bal_counters:"contradice",
    bal_method:"Método: peso de categoría = base × (1−e^(−casos/saturación)), así el 1.er caso pesa más y los siguientes saturan. Neto = ΣAFAVOR − ΣENCONTRA; confianza = neto ⁄ Σneto. Una hipótesis CIERRA como CONFIRMADA con ≥45% y una ventaja ≥12 pts, o RECHAZADA con ≤15%.",
    bal_load:"⇣ cargar estos mensajes",
    pole_intent:"INTENCIONAL", pole_system:"FALLO SISTÉMICO",
    pole_intent_d:"Un acto deliberado — uno o más actores eligieron divulgar.",
    pole_system_d:"Un fallo a nivel de sistema — controles tardíos, dinámica emergente de canales, sin intención única.",
    bal_tilt:"La evidencia se inclina hacia", bal_tie:"casi en equilibrio",
    bal_tilt_line:"La evidencia se inclina hacia <b>{label}</b> — {iw} vs {sw}. {tail}",
    bal_tail_intent:"La divulgación deliberada de un actor individual pesa más que las explicaciones sistémicas.",
    bal_tail_system:"La filtración se lee como un fallo a nivel de sistema más que como la intención de un único actor — aunque la confirmación final (E10/E11) conserva una fuerte señal de intención.",
    bal_tail_tie:"Intención y fallo sistémico están co-presentes — el caso no se resuelve limpiamente hacia un solo polo.",
    bal_pole:"impulsa",
    bal_winner_line:"Explicación dominante: <b>{label}</b> ({conf}%). {tail}",
    bal_tail_closed:"Cierra — ventaja decisiva sobre las alternativas.",
    bal_tail_open:"Líder pero no decisiva — <b>{other}</b> sigue siendo una explicación complementaria fuerte; el caso aún no cierra entre ambas.",
    cat_attributable_leak:"Filtración pública atribuible", cat_attributable_leak_d:"post público de fusión/embargo que violó el embargo en el canal oficial y atribuible — divulgación deliberada y con nombre.",
    cat_anon_preseed:"Pre-siembra anónima", cat_anon_preseed_d:"posts anónimos de fusión/embargo antes de que se levantara el embargo — preparando a la audiencia.",
    cat_covert_coord:"Coordinación encubierta", cat_covert_coord_d:"conversación de fusión/embargo dentro del canal encubierto side-huddle — alineación extraoficial.",
    cat_boundary_test:"Tanteo del límite", cat_boundary_test_d:"posts públicos de fusión/embargo que rozan la línea sin violarla técnicamente — divulgación incremental.",
    cat_uncontrolled_leak:"Filtración pública incontrolada", cat_uncontrolled_leak_d:"violaciones de embargo en canales personales/anónimos — divulgación que escapó al control sancionado.",
    cat_defensive_clarif:"Aclaración defensiva", cat_defensive_clarif_d:"posts públicos con marco de cumplimiento — 'solo aclarando', cada uno defendible localmente.",
    cat_concentration:"Concentración de la filtración", cat_concentration_d:"proporción de todas las violaciones cometidas por los dos agentes principales — alta concentración apunta a intención, no a confusión difusa.",
    cat_late_control:"Control instalado tarde", cat_late_control_d:"el agente de cumplimiento (Juez) se añadió solo ~1 semana antes de la filtración (E04).",
    cat_unenforced_warning:"Advertencia final no aplicada", cat_unenforced_warning_d:"la advertencia de techo final del Juez (E09) se emitió pero nunca se hizo cumplir.",
    cat_channel_reinforce:"Refuerzo entre canales", cat_channel_reinforce_d:"el lenguaje de fusión/embargo aparece a la vez en canales públicos oficial + personal + anónimo — los canales se amplificaron entre sí.",
  },
};
function t(k){ const L=I18N[LANG]||I18N.en; return (k in L)?L[k]:(I18N.en[k]??k); }

const CH_LABEL_I18N = {
  en:{comms_huddle:"Comms Huddle", side_huddle:"Side Huddle (covert)", one_on_one_chat:"1:1 Chat",
      official_post:"Official Post", personal_post:"Personal Post", anonymous_post:"Anonymous Post"},
  es:{comms_huddle:"Huddle de Equipo", side_huddle:"Side Huddle (encubierto)", one_on_one_chat:"Chat 1:1",
      official_post:"Post Oficial", personal_post:"Post Personal", anonymous_post:"Post Anónimo"},
};
const FLAG_LABEL_I18N = {
  en:{merger:"Merger lang", embargo:"Embargo lang", execution:"Execution lang", compliance:"Compliance lang",
      governance:"Governance lang", violation:"Embargo VIOLATION", public:"Public posts only", internal_state:"Has internal reasoning"},
  es:{merger:"Lenguaje de fusión", embargo:"Lenguaje de embargo", execution:"Lenguaje de ejecución", compliance:"Lenguaje de cumplimiento",
      governance:"Lenguaje de gobernanza", violation:"VIOLACIÓN de embargo", public:"Solo posts públicos", internal_state:"Tiene razonamiento interno"},
};
const ZONES_I18N = {
  en:{comms_huddle:{label:"TEAM HUDDLE",sub:"monitored"}, one_on_one_chat:{label:"1:1 CHAT",sub:"private"},
      side_huddle:{label:"SIDE HUDDLE",sub:"covert"}, official_post:{label:"OFFICIAL POST",sub:"sanctioned · public"},
      personal_post:{label:"PERSONAL POST",sub:"unsanctioned · public"}, anonymous_post:{label:"ANONYMOUS POST",sub:"untraceable · public"}},
  es:{comms_huddle:{label:"HUDDLE DE EQUIPO",sub:"monitoreado"}, one_on_one_chat:{label:"CHAT 1:1",sub:"privado"},
      side_huddle:{label:"SIDE HUDDLE",sub:"encubierto"}, official_post:{label:"POST OFICIAL",sub:"sancionado · público"},
      personal_post:{label:"POST PERSONAL",sub:"no sancionado · público"}, anonymous_post:{label:"POST ANÓNIMO",sub:"no rastreable · público"}},
};
const AGENT_LABEL_I18N = {
  en:{legal_agent:"Legal", quality_agent:"Platform-Trust", social_media_agent:"Social-Media", pr_agent:"PR",
      intern_agent:"Intern", pr_intern_agent:"PR-Intern", judge_agent:"Judge"},
  es:{legal_agent:"Legal", quality_agent:"Platform-Trust", social_media_agent:"Social-Media", pr_agent:"PR",
      intern_agent:"Interno", pr_intern_agent:"PR-Interno", judge_agent:"Juez"},
};
const PHASE_I18N = {seed:"siembra", coordination:"coordinación", control:"control", pressure:"presión",
  leak_buildup:"preparación de filtración", boundary_test:"prueba de límite", breach:"filtración", aftermath:"consecuencias"};

/* curated narrative — Spanish overrides keyed by id (raw messages stay original) */
const TR = {
  events:{
    E01:{title:"El CEO siembra 'desarrollos estratégicos' en privado",summary:"Los DMs privados del CEO Ajay insinúan 'desarrollos estratégicos' / 'catalizadores identificables' no divulgados — el primer rastro de la fusión dentro del sistema."},
    E02:{title:"Canal en la sombra (side_huddle) activado",summary:"La coordinación de la fusión se traslada al side_huddle encubierto, lejos del comms_huddle monitoreado. legal_agent + social_media_agent dominan este canal."},
    E03:{title:"Briefing de la fusión en el canal en la sombra",summary:"Se revelan malos números del Q2; la fusión con HarborCrest se informa dentro del canal encubierto como el catalizador de recuperación."},
    E04:{title:"Se asigna al Juez tras el desliz de @Elena",summary:"Un casi-incidente social precipita la instalación del agente de cumplimiento 'El Juez' — el control se añade tarde, solo ~1 semana antes de la filtración."},
    E05:{title:"Exposé de SaltWind #1 — alianzas con corredores de datos",summary:"Cae el primer exposé; crece la presión de #AlgorithmicEviction. La acción baja hacia $33. Se acelera la publicación pública defensiva."},
    E06:{title:"Exposé de SaltWind #2 — riesgo de reidentificación",summary:"El segundo exposé plantea el riesgo de reidentificación en la víspera de la crisis. El sentimiento del mercado se vuelve CRÍTICO ($31.50)."},
    E07:{title:"Primer post anónimo alude al contexto del acuerdo",summary:"legal_agent empieza a publicar de forma anónima — aclaraciones que rozan cada vez más la fusión embargada, probando el límite."},
    E08:{title:"Post anónimo nombra el 'acuerdo ResidentIQ' / gobernanza",summary:"Posts anónimos + personales empiezan a afirmar hechos de la alianza estratégica, acortando la distancia con el anuncio embargado."},
    E09:{title:"El Juez emite la ADVERTENCIA DE CUMPLIMIENTO final (el techo)",summary:"El Juez declara la exposición máxima tolerable: 'Ningún lenguaje prospectivo adicional... desde NINGUNA cuenta.' Esta advertencia es ignorada después."},
    E10:{title:"FILTRACIÓN — Legal confirma personalmente la fusión con CivicLoom",summary:"35 minutos antes del embargo de las 6:00 PM, el post PERSONAL de legal_agent confirma 'CivicLoom Realty Partners y TenantThread' — la primera divulgación explícita y atribuible."},
    E11:{title:"Social-Media amplifica: 'EJECUTANDO: ...fusión definitiva'",summary:"Un minuto después, social_media_agent amplifica con lenguaje de ejecución explícito — el sistema de reacción automatizado propaga la filtración públicamente."},
    E12:{title:"El embargo se levanta formalmente — pero la noticia ya era pública",summary:"A las 6:00 PM el embargo se levanta según lo previsto; para entonces los detalles de la fusión habían circulado públicamente ~35 minutos vía cuentas personales + anónimas."},
  },
  rounds:{
    0:"Arranque de planificación Q2 — consultas de fiscales señaladas",
    1:"Demo de Crestview; Platform Trust replica a Legal",
    2:"Debate acalorado de gobernanza de datos; mal uso por operadores",
    3:"Surge informe NHPI; canal en la sombra activado",
    4:"Guías de uso entregadas; Ajay insinúa briefing del lunes",
    5:"Internos ingresan; advertencia de 'cambios estructurales' de Ajay",
    6:"Malos números Q2 revelados; briefing de fusión en la sombra",
    7:"Gran incumplimiento de SLA; Platform Trust defiende la gobernanza",
    8:"Desliz de @Elena — Juez asignado al Comms Huddle",
    9:"El Juez llega al Comms Huddle; se refuerzan reglas del embargo",
    10:"Cae SaltWind Pieza #1 — alianzas con corredores de datos expuestas",
    11:"Control de daños; ResidentIQ ataca; discurso 'No hay Plan B'",
    12:"SaltWind Pieza #2 — riesgo de reidentificación; víspera de crisis",
  },
  hyp:{
    A:{label:"Divulgación deliberada", claim:"Uno o más agentes liberaron intencionalmente información embargada de la fusión.",
       for:["legal_agent redactó una confirmación de fusión explícita y atribuible 35 min antes (E10).",
            "Posts anónimos persistentes pre-sembraron #CivicLoom #6PM, preparando a la audiencia.",
            "La coordinación encubierta en el side_huddle se concentró en los dos mismos agentes que filtraron."],
       against:["Ningún mensaje individual declara la intención de violar el embargo.",
                "Los posts públicos se presentan como aclaraciones defensivas, no como filtraciones."]},
    B:{label:"Fallo de coordinación", claim:"La filtración fue una consecuencia no intencionada de mala coordinación y controles tardíos.",
       for:["El Juez se instaló solo ~1 semana antes de la filtración (E04).",
            "La producción pública del día de crisis explotó en canales personales/anónimos con poco control de acceso.",
            "La advertencia final de techo del Juez (E09) se emitió pero no se hizo cumplir."],
       against:["La filtración se concentró en dos agentes senior, no en una confusión difusa.",
                "Los posts que tantean el límite escalaron de forma sostenida — consistente con intención, no accidente."]},
    C:{label:"Comportamiento emergente", claim:"La filtración emergió de las interacciones entre agentes, canales y cumplimiento.",
       for:["Posts defensivos de 'aclaración' divulgaron incrementalmente el acuerdo bajo presión mediática.",
            "Canales anónimo + personal + oficial se reforzaron mutuamente (interacción de canales).",
            "El lenguaje de cumplimiento se satisfizo localmente (cada post 'defendible') mientras el agregado violaba el embargo."],
       against:["La confirmación final fue un acto discreto y de apariencia deliberada (E10/E11)."]},
  },
  questions:{
    q1:{tag:"eventos y causalidad", q:"¿Qué secuencia de eventos y relaciones llevó a la divulgación inapropiada?",
        a:`La cadena numerada de la trenza se lee como un único arco causal: el CEO siembra en privado 'desarrollos estratégicos' (<b>1</b>, 17 may) → la coordinación sale del huddle monitoreado hacia el side-huddle encubierto (<b>2–3</b>, 22–25 may, arcos morados) → un casi-desliz precipita la instalación tardía del Juez (<b>4</b>, 29 may) → dos exposés de SaltWind presionan públicamente al equipo mientras $TTHR cae (<b>5–6</b>) → el día de crisis Legal inicia pruebas de límite anónimas a las 9:49 (<b>7–8</b>, los hilos se hunden bajo el perímetro rojo) → la advertencia de techo del Juez a las 15:08 (<b>9</b>) es ignorada — flecha roja punteada — → Legal confirma personalmente la fusión con CivicLoom a las 17:25 (<b>10</b>), Social-Media amplifica un minuto después (<b>11</b>), y el embargo de las 18:00 se levanta sobre una noticia ya pública (<b>12</b>).`},
    q2:{tag:"elusión del control", q:"¿Qué decisiones y elementos del sistema dejaron que el post burlara el control del embargo (El Juez)?",
        a:`Cuatro fallos estructurales, todos visibles en la trenza: <b>(1) control tardío</b> — las compuertas ⚖ solo aparecen desde el 30 may, después de que la coordinación ya se había vuelto encubierta; <b>(2) el vacío de silencio</b> — la franja roja "JUEZ EN SILENCIO" muestra cero producción del Juez durante las horas de la mañana de crisis cuando ocurrían las pruebas de límite y las primeras violaciones; <b>(3) poder solo consultivo</b> — la advertencia de techo de las 15:08 (nodo 9) es un fallo, no un bloqueo; las compuertas rojas muestran violaciones siguiendo en horas; <b>(4) alcance</b> — el control vigilaba la cuenta oficial, pero la filtración viajó por canales <i>personal</i> y <i>anónimo</i> (las dos zonas inferiores), justo donde terminan el día los hilos de Legal y Social-Media.`},
    q3:{tag:"típico vs. filtración", q:"¿Cuál era el comportamiento típico de cada agente y cómo se compara con el de la filtración?",
        a:`Las líneas horizontales punteadas son la postura base pre-crisis de cada agente — cada hilo se mantuvo en las zonas internas superiores durante dos semanas (Legal: 60% huddle monitoreado, 37% 1:1 privado, <b>cero</b> publicación pública). El 5 de junio la trenza se deshilacha: el hilo de Legal se desploma cruzando el perímetro rojo hacia publicación <i>anónima</i> y <i>personal</i> — dos canales que nunca había usado (desviación 0.31, 12 posts anónimos, 6 acciones de filtración), y Social-Media abandona su carril de post oficial para amplificar con lenguaje "EJECUTANDO". Haz clic en <b>Legal ▸</b> o <b>Social-Media ▸</b> en el borde derecho: la tarjeta de perfil muestra la mezcla de canales esperada vs. observada lado a lado.`},
    q4:{tag:"indicadores tempranos", q:"¿Hubo indicadores tempranos de que tal divulgación era posible?",
        a:`Sí — el sismógrafo tiembla mucho antes de las 17:25. <b>22 may</b>: se activa el side-huddle (primeros arcos morados; la cuota encubierta llega al 12%) y un post público ya roza lenguaje adyacente a la fusión (primer ◆ naranja en la ronda 4). <b>29 may</b>: el casi-incidente de @Elena — suficiente para forzar la instalación del Juez. <b>Mañana del 5 jun</b>: las pruebas de límite anónimas empiezan a las 9:49, la anomalía compuesta cruza la línea de alerta +2σ horas antes de la filtración, y las violaciones empiezan a las 15:00 — 2.5 horas antes de la filtración "oficial". Cada ▲ sobre una barra pre-crisis es una alerta temprana que era visible en su momento.`},
    q5:{tag:"desviaciones previas", q:"¿Hubo ocasiones previas donde el comportamiento real difirió del esperado?",
        a:`Tres desviaciones pre-crisis destacan al arrastrar sobre las rondas de mayo: <b>(1) 17 may</b> — el CEO siembra información material no pública por DMs privados en vez de canales gobernados (nodo 1); <b>(2) 22–25 may</b> — Legal y Social-Media mueven la coordinación de la fusión al side-huddle encubierto (nodos 2–3): agentes senior eludiendo deliberadamente el canal monitoreado, la primera deriva de sus hilos bajo la base; <b>(3) 29 may</b> — el desliz de @Elena, un resbalón público atrapado justo a tiempo (nodo 4). Cada uno fue la misma <i>especie</i> de comportamiento que la filtración final — información moviéndose a canales menos gobernados — solo que a menor escala.`},
    q6:{tag:"episodios similares", q:"¿El sistema de agentes exhibió comportamientos como la filtración en otras ocasiones?",
        a:`La filtración no fue un acto discreto sino el punto final de una <b>escalada gradual que se ensayó a sí misma</b>: "aclaraciones" anónimas a las 9:49 (nodo 7) → nombrar el contexto del acuerdo a las 12:06 (nodo 8) → las primeras violaciones reales a las 15:00–16:00 por Social-Media, Legal y PR-Intern (anillos rojos antes de la línea de filtración) → la confirmación explícita a las 17:25. Cada paso usó la misma escalera de canales (encubierto → anónimo → personal) y cada uno fue un poco más audaz que el anterior. Los diamantes ◆ naranjas marcan cada ensayo; nota que se agrupan en exactamente los dos hilos que finalmente filtraron.`},
    q7:{tag:"por qué no hubo acción antes", q:"¿Por qué las ocasiones previas no derivaron en acción notable?",
        a:`Cuatro razones, cada una visible en una capa: <b>(1) baja visibilidad</b> — las desviaciones de mayo se quedaron en zonas internas sobre el perímetro rojo; nada público significaba nada a lo que reaccionar; <b>(2) el único casi-incidente visible SÍ provocó acción</b> — el desliz de @Elena produjo al Juez (nodo 4), y las compuertas ⚖ verdes (30 may–4 jun) muestran el cumplimiento sosteniéndose, lo que generó falsa confianza en que el control funcionaba; <b>(3) defendibilidad local</b> — el día de crisis cada post era individualmente "defendible bajo la opinión 10b-5 del asesor externo" (palabras del propio Juez), así que las revisiones por mensaje pasaban mientras la divulgación <i>agregada</i> crecía; <b>(4) sin dientes de control</b> — cuando el Juez finalmente trazó un techo duro a las 15:08, solo pudo advertir: la flecha roja punteada "advertencia de techo ignorada" es el único punto de fallo del sistema.`},
  },
};

/* language-aware data accessors (raw message bodies are never translated) */
function evTitle(e){ return LANG!=="en" && TR.events[e.id] ? TR.events[e.id].title : e.title; }
function evSummary(e){ return LANG!=="en" && TR.events[e.id] ? TR.events[e.id].summary : e.summary; }
function roundHeadline(ri){ const r=DATA.rounds[ri]; if(!r) return ""; return (LANG!=="en" && TR.rounds[ri]!=null) ? TR.rounds[ri] : r.headline; }
function hypLabel(h){ return LANG!=="en" && TR.hyp[h.id] ? TR.hyp[h.id].label : h.label; }
function hypClaim(h){ return LANG!=="en" && TR.hyp[h.id] ? TR.hyp[h.id].claim : h.claim; }
function hypFor(h){ return LANG!=="en" && TR.hyp[h.id] ? TR.hyp[h.id].for : h.for; }
function hypAgainst(h){ return LANG!=="en" && TR.hyp[h.id] ? TR.hyp[h.id].against : h.against; }
function qTag(Q){ return LANG!=="en" && TR.questions[Q.id] ? TR.questions[Q.id].tag : Q.tag; }
function qQ(Q){ return LANG!=="en" && TR.questions[Q.id] ? TR.questions[Q.id].q : Q.q; }
function qA(Q){ return LANG!=="en" && TR.questions[Q.id] ? TR.questions[Q.id].a : Q.a; }
function phaseLabel(p){ return (LANG!=="en" && PHASE_I18N[p]) ? PHASE_I18N[p] : (p||"").replace(/_/g," "); }

function applyLangData(){
  CH_LABEL   = {...CH_LABEL_I18N[LANG]};
  FLAG_LABEL = {...FLAG_LABEL_I18N[LANG]};
  ZONES.forEach(z=>{ const d=ZONES_I18N[LANG] && ZONES_I18N[LANG][z.ch]; if(d){ z.label=d.label; z.sub=d.sub; } });
  if(DATA.meta && DATA.meta.agents){
    Object.keys(DATA.meta.agents).forEach(id=>{
      const lab = AGENT_LABEL_I18N[LANG] && AGENT_LABEL_I18N[LANG][id];
      if(lab) DATA.meta.agents[id].label = lab;
    });
  }
}
function applyStaticI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{ const v=t(el.getAttribute("data-i18n")); if(v!=null) el.textContent=v; });
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{ el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  document.documentElement.lang = LANG;
}

const fmtTs = d3.timeFormat("%b %d · %H:%M");
const fmtDay = d3.timeFormat("%b %d");
const fmtHour = d3.timeFormat("%H:%M");
const parseTs = (s) => new Date(s);

/* ---------------------------------------------------------------- STATE --- */
const STATE = {
  agents: new Set(),       // active agents (all = "all on")
  channels: new Set(CH_ORDER),
  flags: new Set(),
  roundRange: null,        // [minRound, maxRound] or null
  search: "",
  hypothesis: null,
  view: "view-main",
  layers: {baselines:true, arcs:true, gates:true, events:true, arrows:true},
};
/* analytic focus applied by Key Questions / thread clicks */
const HL = { agents:null, events:null, note:null };

let DATA = {};
let MSG_BY_ID = {};
let DER = null;            // derived braid data (computed once)

/* --------------------------------------------------------------- LOADING -- */
Promise.all([
  d3.json("data/messages.json"),
  d3.json("data/rounds.json"),
  d3.json("data/network.json"),
  d3.json("data/actors.json"),
  d3.json("data/posts.json"),
  d3.json("data/events.json"),
  d3.json("data/meta.json"),
]).then(([messages,rounds,network,actors,posts,events,meta]) => {
  DATA = {messages,rounds,network,actors,posts,events,meta};
  messages.forEach(m => { m._date = parseTs(m.ts); MSG_BY_ID[m.id] = m; });
  rounds.forEach(r => r._date = parseTs(r.ts));
  STATE.agents = new Set(Object.keys(meta.agents));
  init();
}).catch(err => {
  document.getElementById("view-main").innerHTML =
    '<div style="padding:40px;color:#f59e0b">Could not load data. '+
    'Run <code>python3 scripts/transform.py</code> then serve with '+
    '<code>python3 -m http.server 8000</code>.<br><br>'+err+'</div>';
});

/* ------------------------------------------------------------ FILTERING --- */
function filtered(){
  const allAgents = STATE.agents.size === 0 || STATE.agents.size === Object.keys(DATA.meta.agents).length;
  const q = STATE.search.trim().toLowerCase();
  return DATA.messages.filter(m => {
    if(!allAgents && !STATE.agents.has(m.agent)) return false;
    if(!STATE.channels.has(m.channel)) return false;
    if(STATE.roundRange && (m.round < STATE.roundRange[0] || m.round > STATE.roundRange[1])) return false;
    for(const f of STATE.flags){
      if(f === "violation"){ if(!m.embargo_violation) return false; }
      else if(f === "public"){ if(!m.is_public) return false; }
      else if(f === "internal_state"){ if(!m.has_internal) return false; }
      else { if(!m.flags[f]) return false; }
    }
    if(q){
      const hay = (m.content + " " + m.agent + " " + JSON.stringify(m.internal_state)).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------- TOOLTIP ---- */
const tip = d3.select("#tooltip");
function showTip(html, ev){ tip.html(html).style("opacity",1); moveTip(ev); }
function moveTip(ev){
  const pad=14, w=tip.node().offsetWidth, h=tip.node().offsetHeight;
  let x=ev.clientX+pad, y=ev.clientY+pad;
  if(x+w>innerWidth) x=ev.clientX-w-pad;
  if(y+h>innerHeight) y=ev.clientY-h-pad;
  tip.style("left",x+"px").style("top",y+"px");
}
function hideTip(){ tip.style("opacity",0); }

/* ---------------------------------------------------------- INSPECTOR ----- */
function highlight(text){
  let out = escapeHtml(text);
  const terms = ["civicloom","harborcrest","merger","embargo","executing","6 pm","6:00 pm",
    "acquisition","definitive merger","strategic partner","rebrand","retention optimizer",
    "anonymous","confidential","10b-5","governance audit"];
  terms.forEach(t=>{
    const re = new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");
    out = out.replace(re,"<mark>$1</mark>");
  });
  return out;
}
function escapeHtml(s){ return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

/* keywords flagged in a message — the matched NLP terms per category */
function msgKeywords(m){
  const out=[], seen=new Set();
  const add=(cat,arr)=>(arr||[]).forEach(w=>{
    const k=cat+":"+(""+w).toLowerCase();
    if(w && !seen.has(k)){ seen.add(k); out.push({cat,w}); }
  });
  FLAGS.forEach(f=> add(f, m.nlp && m.nlp[f]));
  if(out.length<3) FLAGS.forEach(f=> add(f, m.nlp_inner && m.nlp_inner[f]));
  return out.slice(0,7);
}
function msgCard(m){
  const kws = msgKeywords(m);
  const kwHtml = kws.length
    ? `<div class="ev-kw">${kws.map(k=>`<span class="kw ${k.cat}">${escapeHtml(k.w)}</span>`).join("")}</div>`
    : (FLAGS.some(f=>m.flags[f])
        ? `<div class="ev-kw">${FLAGS.filter(f=>m.flags[f]).map(f=>`<span class="kw ${f}">${f}</span>`).join("")}</div>` : "");
  const recips = m.recipients || [];
  const recipLabel = recips.includes("ALL")
    ? t("mc_everyone")
    : recips.filter(r=>DATA.meta.agents[r]).map(r=>DATA.meta.agents[r].label).join(", ");
  const recipHtml = recipLabel ? `<div class="ev-recip"><span class="rcp">${t("mc_to")}</span> ${escapeHtml(recipLabel)}</div>` : "";
  // summarised: a short snippet, with the full body + inner reasoning behind a toggle
  const body = m.content || "";
  const isLong = body.length > 130;
  const snippet = isLong ? body.slice(0,130).replace(/\s+\S*$/,"") + "…" : body;
  const inner = m.internal_state && Object.keys(m.internal_state).length
    ? `<div class="ev-inner"><b>${t("mc_internal")}</b> ${highlight(Object.values(m.internal_state).join(" · "))}</div>` : "";
  const hasMore = isLong || inner;
  return `<div class="ev-card ${m.embargo_violation?'violation':''}">
    <div class="ev-meta"><span>${m.ts.replace("T"," ")}</span><span>${CH_LABEL[m.channel]}</span></div>
    <div class="ev-agent" style="color:${AGENT_COLOR(m.agent)}">${DATA.meta.agents[m.agent].label}
      ${m.embargo_violation?`<span class="tag merger">${t("mc_violation")}</span>`:''}</div>
    ${recipHtml}
    ${kwHtml}
    <div class="ev-text">
      <span class="ev-snip">${highlight(snippet)}</span>
      ${hasMore?`<div class="ev-full">${highlight(body)}${inner}</div>`:""}
    </div>
    ${hasMore?`<button class="ev-more" type="button">${t("mc_more")}</button>`:""}
  </div>`;
}
function inspect(title, msgs){
  msgs = msgs.filter(Boolean);
  document.getElementById("insp-title").textContent = title.toUpperCase();
  const body = document.getElementById("insp-body");
  if(!msgs.length){ body.innerHTML = `<div class="insp-empty">${t("ins_none")}</div>`; return; }
  const sorted = msgs.slice().sort((a,b)=>a._date-b._date);
  body.innerHTML = `<div class="hint" style="margin-bottom:8px">${t("ins_count").replace("{n}",sorted.length)}</div>`
    + sorted.map(msgCard).join("");
  body.scrollTop = 0;
}
function inspectIds(title, ids){ inspect(title, [...new Set(ids)].map(id=>MSG_BY_ID[id])); }

/* ---- multi-selection: shift/ctrl-click accumulates several nodes ---- */
let SEL = [];
function selClear(){ SEL = []; }
function selIdSet(){ return new Set(SEL.flatMap(s=>s.ids)); }
function pickInspect(title, items, ev, isIds){
  const ids = (isIds ? items : (items||[]).map(m=>m && m.id)).filter(Boolean);
  const additive = ev && (ev.shiftKey || ev.metaKey || ev.ctrlKey);
  if(additive) SEL.push({title, ids});
  else SEL = [{title, ids}];
  renderSelection();
}
function renderSelection(){
  if(!SEL.length){ clearInspector(); return; }
  const allIds = [...new Set(SEL.flatMap(s=>s.ids))];
  const msgs = allIds.map(id=>MSG_BY_ID[id]).filter(Boolean);
  if(SEL.length===1){ inspect(SEL[0].title, msgs); renderMain(); return; }
  const sorted = msgs.slice().sort((a,b)=>a._date-b._date);
  document.getElementById("insp-title").textContent =
    t("ins_multi").replace("{n}",SEL.length).replace("{m}",msgs.length).toUpperCase();
  const body = document.getElementById("insp-body");
  const chips = SEL.map((s,i)=>`<span class="sel-chip" data-i="${i}">${escapeHtml(s.title)} <b>✕</b></span>`).join("");
  body.innerHTML = `<div class="sel-bar">${chips}</div>` + sorted.map(msgCard).join("");
  body.querySelectorAll(".sel-chip b").forEach(b=>{
    b.onclick = ()=>{ SEL.splice(+b.parentNode.dataset.i,1); renderSelection(); };
  });
  body.scrollTop=0;
  renderMain();   // refresh node highlight rings
}
function clearInspector(){
  selClear();
  document.getElementById("insp-title").textContent = t("insp_title");
  document.getElementById("insp-body").innerHTML = `<div class="insp-empty">${t("ins_cleared")}</div>`;
  renderMain();
}
document.getElementById("insp-clear").onclick = clearInspector;

/* ----------------------------------------------- AGENT BEHAVIORAL PROFILE - */
function mixBar(mix){
  const cells = CH_ORDER.map(c=>{
    const w=(mix[c]||0)*100;
    return w>0?`<i style="width:${w}%;background:${chColor(c)}" title="${CH_LABEL[c]} ${(w).toFixed(0)}%"></i>`:"";
  }).join("");
  return `<div class="mixbar">${cells}</div>`;
}
function showAgentProfile(id){
  const a = DATA.actors.find(d=>d.id===id);
  if(!a) return;
  selClear();
  const meta = DATA.meta.agents[id];
  document.getElementById("insp-title").textContent = (meta.label+" — "+t("pf_profile")).toUpperCase();
  const newCh = a.new_channels.length
    ? a.new_channels.map(c=>`<span class="tag merger">${t("pf_new")} ${CH_LABEL[c]}</span>`).join(" ")
    : `<span class="tag governance">${t("pf_no_new")}</span>`;
  document.getElementById("insp-body").innerHTML = `
    <div class="ev-card" style="border-left-color:${AGENT_COLOR(id)}">
      <div class="ev-agent" style="color:${AGENT_COLOR(id)}">${meta.label} <span class="badge">${meta.seniority}</span></div>
      <div class="profile-grid">
        <div><b>${a.baseline_msgs}</b><span>${t("pf_baseline")}</span></div>
        <div><b>${a.crisis_msgs}</b><span>${t("pf_crisis")}</span></div>
        <div><b style="color:${a.deviation>0.2?'#ef4444':'#97a3bd'}">${a.deviation.toFixed(2)}</b><span>${t("pf_deviation")}</span></div>
        <div><b style="color:${a.leak_actions?'#ef4444':'#97a3bd'}">${a.leak_actions}</b><span>${t("pf_leak")}</span></div>
        <div><b>${a.covert_total}</b><span>${t("pf_covert")}</span></div>
        <div><b>${a.anonymous_posts}</b><span>${t("pf_anon")}</span></div>
      </div>
      <div class="mixrow"><span>${t("pf_expected")}</span>${mixBar(a.baseline_mix)}</div>
      <div class="mixrow"><span>${t("pf_observed")}</span>${mixBar(a.crisis_mix)}</div>
      <div class="ev-tags" style="margin-top:8px">${newCh}</div>
      <div class="profile-actions">
        <button class="mini" id="pf-crisis">${t("pf_btn_crisis")}</button>
        <button class="mini" id="pf-covert">${t("pf_btn_covert")}</button>
        <button class="mini" id="pf-public">${t("pf_btn_public")}</button>
      </div>
      <div class="hint" style="margin-top:6px">${t("pf_hint")}</div>
    </div>`;
  document.getElementById("pf-crisis").onclick = ()=>inspect(`${meta.label} — ${t("pf_btn_crisis")}`,
    DATA.messages.filter(m=>m.agent===id && m.round>=DATA.meta.crisis_round0));
  document.getElementById("pf-covert").onclick = ()=>inspect(`${meta.label} — ${t("pf_btn_covert")}`,
    DATA.messages.filter(m=>m.agent===id && m.channel==="side_huddle"));
  document.getElementById("pf-public").onclick = ()=>inspect(`${meta.label} — ${t("pf_btn_public")}`,
    DATA.messages.filter(m=>m.agent===id && m.is_public));
}

/* ================================================================= INIT === */
function init(){
  computeDerived();
  applyLangData();
  applyStaticI18n();
  buildLangToggle();
  buildRailFilters();
  buildHypotheses();
  buildQuestions();
  buildTabs();
  updateTimeReadout();
  switchView(STATE.view);
  window.addEventListener("resize", debounce(()=>{ if(STATE.view!=="view-balance") renderMain(); }, 180));
}
// expand / collapse the full message body inside any evidence card
document.addEventListener("click", e=>{
  const b = e.target.closest(".ev-more");
  if(!b) return;
  const card = b.closest(".ev-card");
  const open = card.classList.toggle("expanded");
  b.textContent = open ? t("mc_less") : t("mc_more");
});

function buildTabs(){
  document.querySelectorAll("#tabs .tab").forEach(btn=>
    btn.onclick = ()=>{ location.hash = btn.dataset.view==="view-balance"?"balance":"braid"; switchView(btn.dataset.view); });
  if(location.hash==="#balance"){ STATE.view="view-balance"; }
  window.addEventListener("hashchange",()=>switchView(location.hash==="#balance"?"view-balance":"view-main"));
}
function debounce(fn,ms){let timer;return(...a)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...a),ms);};}
function renderAll(){ updateTimeReadout(); if(STATE.view==="view-balance") renderBalance(); else renderMain(); }

function buildLangToggle(){
  const btn=document.getElementById("lang-toggle");
  if(!btn) return;
  btn.textContent = LANG==="en" ? "ES" : "EN";
  btn.onclick=()=>{
    LANG = LANG==="en" ? "es" : "en";
    localStorage.setItem("hc-lang", LANG);
    btn.textContent = LANG==="en" ? "ES" : "EN";
    applyLangData();
    applyStaticI18n();
    buildRailFilters();
    buildHypotheses();
    buildQuestions();
    selClear();
    document.getElementById("insp-title").textContent = t("insp_title");
    document.getElementById("insp-body").innerHTML = `<div class="insp-empty">${t("insp_empty")}</div>`;
    renderAll();
  };
}

/* ------------------------------------------------------ DERIVED BRAID ----- */
function computeDerived(){
  const agents = Object.keys(DATA.meta.agents);
  const R = DATA.rounds.length;
  const c0 = DATA.meta.crisis_round0;

  // per agent-round cells
  const byAR = {};
  agents.forEach(a=>byAR[a]=Array(R).fill(null));
  DATA.messages.forEach(m=>{
    const arr=byAR[m.agent]; if(!arr) return;
    if(!arr[m.round]) arr[m.round]={msgs:[]};
    arr[m.round].msgs.push(m);
  });
  agents.forEach(a=>byAR[a].forEach(cell=>{
    if(!cell) return;
    const ms=cell.msgs;
    cell.count=ms.length;
    // public messages weigh ×3: external exposure should pull the thread visibly
    cell.posture=d3.sum(ms,m=>(m.is_public?3:1)*POSTURE[m.channel])
                /d3.sum(ms,m=>m.is_public?3:1);
    cell.viol=ms.some(m=>m.embargo_violation);
    cell.boundary=ms.some(m=>m.is_public&&(m.flags.merger||m.flags.embargo)&&!m.embargo_violation);
    cell.covert=ms.filter(m=>m.channel==="side_huddle").length;
    cell.pub=ms.filter(m=>m.is_public).length;
  }));

  // expected behavior: pre-crisis posture baseline per agent
  const baseline={};
  agents.forEach(a=>{
    const vals=byAR[a].slice(0,c0).filter(Boolean).map(c=>c.posture);
    baseline[a]=vals.length?{mean:d3.mean(vals), sd:d3.deviation(vals)||0}:null;
  });

  // covert coordination pairs per round (who side-huddled with whom)
  const pairMap={};
  DATA.messages.filter(m=>m.channel==="side_huddle").forEach(m=>{
    (m.recipients||[]).filter(r=>r!=="ALL"&&DATA.meta.agents[r]&&r!==m.agent).forEach(r=>{
      const [a,b]=[m.agent,r].sort();
      const key=m.round+"|"+a+"|"+b;
      if(!pairMap[key]) pairMap[key]={round:m.round,a,b,count:0,ids:[]};
      pairMap[key].count++; pairMap[key].ids.push(m.id);
    });
  });
  const covertArcs=Object.values(pairMap);

  // judge gates: rounds with judge output; outcome = violation in [ri, ri+1]?
  const judgeRounds=[...new Set(DATA.messages.filter(m=>m.agent==="judge_agent").map(m=>m.round))].sort((x,y)=>x-y);
  const violRounds=new Set(DATA.messages.filter(m=>m.embargo_violation).map(m=>m.round));
  const gates=judgeRounds.map(ri=>({
    round:ri,
    msgs:DATA.messages.filter(m=>m.agent==="judge_agent"&&m.round===ri),
    breached:violRounds.has(ri)||violRounds.has(ri+1)||violRounds.has(ri+2),
  }));
  // enforcement gap: crisis rounds with risky activity but zero judge output
  const jset=new Set(judgeRounds);
  const silent=[];
  for(let ri=c0; ri<R; ri++){
    const risky=agents.some(a=>{const c=byAR[a][ri]; return c&&(c.boundary||c.viol||c.covert>0);});
    if(risky && !jset.has(ri)) silent.push(ri);
  }

  // composite anomaly score per round (leading-indicator seismograph)
  const anomaly=DATA.rounds.map((r,ri)=>{
    const ms=DATA.messages.filter(m=>m.round===ri);
    const flagged=ms.filter(m=>FLAGS.some(f=>m.flags[f]));
    const viol=ms.filter(m=>m.embargo_violation).length;
    const bound=ms.filter(m=>m.is_public&&(m.flags.merger||m.flags.embargo)&&!m.embargo_violation).length;
    const covert=ms.filter(m=>m.channel==="side_huddle").length;
    const sens=d3.sum(flagged,m=>m.sensitivity||0);
    return {ri, score:+(sens*0.4+viol*6+bound*3+covert*1).toFixed(1),
            viol, bound, covert, sens,
            flaggedIds:flagged.map(m=>m.id)};
  });
  const pre=anomaly.slice(0,c0).map(d=>d.score);
  const aMean=d3.mean(pre), aSd=d3.deviation(pre)||1;

  // Place each curated event where its EVIDENCE actually is, so clicking a
  // marker highlights the nodes under it. Start from the round nearest the
  // curated timestamp, then snap to the evidence round closest to that target.
  const events=DATA.events.map(e=>{
    const ed=new Date(e.ts);
    let target=0,best=Infinity;
    DATA.rounds.forEach((r,i)=>{const d=Math.abs(r._date-ed); if(d<best){best=d;target=i;}});
    let ri=target, _ts=e.ts;
    const evMsgs=(e.evidence||[]).map(id=>MSG_BY_ID[id]).filter(Boolean);
    if(evMsgs.length){
      const evRounds=[...new Set(evMsgs.map(m=>m.round))];
      ri=evRounds.reduce((b,r)=>Math.abs(r-target)<Math.abs(b-target)?r:b, evRounds[0]);
      if(ri!==target){                       // moved off the curated time …
        const inRound=evMsgs.filter(m=>m.round===ri).map(m=>m.ts).sort();
        _ts=inRound[0]||e.ts;                 // … show a real evidence timestamp
      }
    }
    return Object.assign({_round:ri, _ts}, e);
  });

  DER={agents,byAR,baseline,covertArcs,gates,silent,anomaly,aMean,aSd,events};
}

/* ------------------------------------------------------- RAIL FILTERS ----- */
function buildRailFilters(){
  const ag = d3.select("#filter-agents").html("");
  Object.keys(DATA.meta.agents).forEach(id=>{
    ag.append("div").attr("class","chip"+(STATE.agents.has(id)?"":" off")).html(
      `<span class="dot" style="background:${AGENT_COLOR(id)}"></span>${DATA.meta.agents[id].label}`)
      .on("click",function(){ toggleSet(STATE.agents,id); d3.select(this).classed("off",!STATE.agents.has(id)); renderAll(); });
  });
  const ch = d3.select("#filter-channels").html("");
  CH_ORDER.forEach(c=>{
    ch.append("div").attr("class","chip"+(STATE.channels.has(c)?"":" off")).html(
      `<span class="dot" style="background:${chColor(c)}"></span>${CH_LABEL[c]}`)
      .on("click",function(){ toggleSet(STATE.channels,c); d3.select(this).classed("off",!STATE.channels.has(c)); renderAll(); });
  });
  const fl = d3.select("#filter-flags").html("");
  ["violation","public","merger","embargo","execution","compliance","governance","internal_state"].forEach(f=>{
    fl.append("div").attr("class","chip"+(STATE.flags.has(f)?"":" off")).text(FLAG_LABEL[f])
      .on("click",function(){
        if(STATE.flags.has(f)) STATE.flags.delete(f); else STATE.flags.add(f);
        d3.select(this).classed("off",!STATE.flags.has(f)); renderAll();
      });
  });
  buildSearch();
  document.getElementById("time-reset").onclick = ()=>{ STATE.roundRange=null; renderAll(); };
}

/* ---- search: live match count, "load all" into inspector, quick-term chips ---- */
const SEARCH_TERMS = ["merger","embargo","civicloom","harborcrest","executing",
  "anonymous","residentiq","confidential","compliance","governance"];
function buildSearch(){
  const input = document.getElementById("search");
  input.value = STATE.search || "";
  const chips = d3.select("#search-chips").html("");
  SEARCH_TERMS.forEach(term=>{
    chips.append("div").attr("class","chip mini-chip off").text(term)
      .on("click",()=>{
        const cur = (STATE.search||"").trim().toLowerCase();
        STATE.search = (cur===term.toLowerCase()) ? "" : term;
        input.value = STATE.search;
        renderAll(); updateSearchMeta();
      });
  });
  input.oninput = debounce(()=>{ STATE.search = input.value; renderAll(); updateSearchMeta(); }, 200);
  updateSearchMeta();
}
function updateSearchMeta(){
  const meta = document.getElementById("search-meta");
  if(!meta) return;
  const q = (STATE.search||"").trim();
  const chipSel = d3.select("#search-chips").selectAll(".chip");
  chipSel.classed("off", function(){ return d3.select(this).text().toLowerCase() !== q.toLowerCase(); });
  if(!q){ meta.innerHTML = `<span class="sm-hint">${t("search_quick")} ↓</span>`; return; }
  const matches = filtered();
  const n = matches.length;
  meta.innerHTML = n
    ? `<span class="sm-count">${t("search_matches").replace("{n}",n)}</span> <button class="mini" id="search-load">${t("search_load")}</button>`
    : `<span class="sm-count sm-none">${t("search_none")}</span>`;
  const load = document.getElementById("search-load");
  if(load) load.onclick = ()=>{ selClear(); inspect(`"${q}"`, matches); renderMain(); };
}
function toggleSet(set,val){ if(set.has(val)) set.delete(val); else set.add(val); }
function updateTimeReadout(){
  if(!STATE.roundRange){ document.getElementById("time-readout").textContent=t("time_full"); return; }
  const a=DATA.rounds[STATE.roundRange[0]], b=DATA.rounds[STATE.roundRange[1]];
  document.getElementById("time-readout").textContent = fmtTs(a._date)+"  →  "+fmtTs(b._date);
}

/* ===================================================== HYPOTHESIS BALANCE ===
   Each message is sorted into evidence CATEGORIES. Every category has an
   evidential weight with diminishing returns (saturation), so a flood of one
   kind of message can't drown a rarer but stronger signal. Each category
   pushes one or more hypotheses FOR or AGAINST. We sum the pans, normalise to
   a confidence %, and decide whether a hypothesis CLOSES (confirmed/rejected)
   or stays OPEN.                                                            */
const HYP_COLOR = {A:"#ef4444", B:"#5b8def", C:"#a855f7"};
const tpl = (k,o)=>{ let s=t(k); for(const p in o) s=s.replace(new RegExp("\\{"+p+"\\}","g"),o[p]); return s; };
const mf = m => m.flags.merger || m.flags.embargo;   // merger/embargo language
let BAL_SIMS = [];   // active force simulations (stopped & rebuilt on re-render)

/* category: id, matcher, base weight, saturation count, [ [hyp, +1 for / -1 against, multiplier] ] */
const BAL_CATS = [
  {id:"attributable_leak", base:5, sat:2, fn:m=>m.is_public&&m.embargo_violation&&mf(m)&&m.channel==="official_post",
   maps:[["A",1,1.0],["B",-1,0.5]]},
  {id:"anon_preseed", base:3, sat:2, fn:m=>m.channel==="anonymous_post"&&mf(m)&&m.before_embargo,
   maps:[["A",1,1.0],["C",1,0.5]]},
  {id:"covert_coord", base:3, sat:20, fn:m=>m.channel==="side_huddle"&&mf(m),
   maps:[["A",1,0.7],["C",1,0.6]]},
  {id:"boundary_test", base:3, sat:8, fn:m=>m.is_public&&mf(m)&&!m.embargo_violation,
   maps:[["C",1,1.0],["B",1,0.4]]},
  {id:"uncontrolled_leak", base:3, sat:6, fn:m=>m.is_public&&m.embargo_violation&&m.channel!=="official_post",
   maps:[["B",1,0.8],["C",1,0.6]]},
  {id:"defensive_clarif", base:2, sat:2, fn:m=>m.is_public&&m.flags.compliance&&!m.embargo_violation,
   maps:[["A",-1,1.0],["C",1,0.7]]},
];

function computeBalance(msgs){
  const score = {A:{for:0,against:0}, B:{for:0,against:0}, C:{for:0,against:0}};
  const rows = [];

  // per-message evidence categories
  BAL_CATS.forEach(c=>{
    const hits = msgs.filter(c.fn);
    const strength = c.base * (1 - Math.exp(-hits.length / c.sat));
    const contrib = {};
    c.maps.forEach(([h,sign,mult])=>{
      score[h][sign>0?"for":"against"] += strength*mult;
      contrib[h] = sign*strength*mult;     // signed: + FOR, − AGAINST
    });
    rows.push({id:c.id, count:hits.length, base:c.base, strength, maps:c.maps, contrib,
               ids:hits.map(m=>m.id), structural:false});
  });

  // structural signal: breach concentration in the top two agents
  const vbyA = d3.rollups(msgs.filter(m=>m.embargo_violation), v=>v.length, m=>m.agent)
                 .sort((a,b)=>b[1]-a[1]);
  const totV = d3.sum(vbyA, d=>d[1]);
  const conc = totV ? (vbyA.slice(0,2).reduce((s,d)=>s+d[1],0))/totV : 0;
  const concStrength = 4*conc;
  score.A.for += concStrength; score.B.against += concStrength;
  rows.push({id:"concentration", count:Math.round(conc*100), unit:"%", strength:concStrength,
             maps:[["A",1],["B",-1]], contrib:{A:concStrength, B:-concStrength},
             ids:msgs.filter(m=>m.embargo_violation).map(m=>m.id), structural:true});

  // structural: late-installed control + unenforced final warning (case lore, fixed)
  score.B.for += 3.0;
  rows.push({id:"late_control", strength:3.0, maps:[["B",1]], contrib:{B:3.0}, ids:[], structural:true, fixed:true});
  score.B.for += 1.5; score.C.for += 1.0;
  rows.push({id:"unenforced_warning", strength:1.5, maps:[["B",1],["C",1]], contrib:{B:1.5,C:1.0}, ids:[], structural:true, fixed:true});

  // structural: channel reinforcement — merger/embargo present across all 3 public channels
  const pubChans = new Set(msgs.filter(m=>mf(m)&&m.is_public).map(m=>m.channel));
  const reinforced = ["official_post","personal_post","anonymous_post"].every(c=>pubChans.has(c));
  const reinfStrength = reinforced ? 3.0 : 0;
  score.C.for += reinfStrength;
  rows.push({id:"channel_reinforce", count:pubChans.size, strength:reinfStrength,
             maps:[["C",1]], contrib:{C:reinfStrength},
             ids:msgs.filter(m=>mf(m)&&m.is_public).map(m=>m.id), structural:true,
             absent:!reinforced});

  // net + confidence + per-hypothesis status
  const net={}, T0={};
  ["A","B","C"].forEach(h=>{ net[h]=Math.max(0, score[h].for - score[h].against); });
  const T = d3.sum(Object.values(net)) || 1;
  const conf={}; ["A","B","C"].forEach(h=> conf[h]=100*net[h]/T);
  const ordered = ["A","B","C"].sort((a,b)=>conf[b]-conf[a]);
  const winner = ordered[0], second = ordered[1];
  const margin = conf[winner]-conf[second];
  const status={};
  ["A","B","C"].forEach(h=>{
    if(conf[h]<=15) status[h]="rejected";
    else if(h===winner && conf[h]>=45 && margin>=12) status[h]="confirmed";
    else if(h===winner) status[h]="leading";
    else status[h]="open";
  });
  return {score, rows, net, conf, status, winner, second, margin, total:msgs.length};
}

/* which pole each evidence category drives, and a glyph for its weight node */
const POLE_OF = {
  attributable_leak:"intent", anon_preseed:"intent", covert_coord:"intent", concentration:"intent",
  late_control:"system", unenforced_warning:"system", uncontrolled_leak:"system",
  boundary_test:"system", channel_reinforce:"system", defensive_clarif:"system",
};
const POLE_COLOR = {intent:"#ef4444", system:"#5b8def"};
const CAT_ICON = {
  attributable_leak:"📣", anon_preseed:"👤", covert_coord:"🤝", concentration:"👥",
  late_control:"⏰", unenforced_warning:"⚠", uncontrolled_leak:"💧",
  boundary_test:"🚧", channel_reinforce:"🔁", defensive_clarif:"🛡",
};

/* aggregate the A/B/C category ledger into the two-pole balance */
function computePoles(B){
  const w={intent:0, system:0};
  const nodes=[];
  B.rows.forEach(r=>{
    const pole=POLE_OF[r.id]; if(!pole) return;
    const val=r.strength;
    w[pole]+=val;
    if(val>0.001) nodes.push({id:r.id, pole, val, ids:r.ids||[], structural:r.structural});
  });
  const total=w.intent+w.system || 1;
  const lean = w.intent>w.system ? "intent" : "system";
  const margin = Math.abs(w.intent-w.system);
  const tie = margin < 1.0;
  return {w, nodes, total, lean, margin, tie,
          pct:{intent:100*w.intent/total, system:100*w.system/total}};
}

/* ---- THE single physical balance: INTENTIONAL vs SYSTEMIC FAILURE ---- */
function drawSingleBalance(host, P){
  const W=760, Hh=440, cx=W/2, pivotY=92, baseY=404, Lx=250, chain=52, panW=232;
  // tilt: heavier pole dips. system on the right (s=+1), intent on the left (s=-1)
  const maxA=0.26, th=maxA*Math.tanh((P.w.system-P.w.intent)/7);
  const end=s=>({x:cx+s*Lx*Math.cos(th), y:pivotY+s*Lx*Math.sin(th)});
  const E={intent:end(-1), system:end(1)};
  const pan={intent:{x:E.intent.x, y:E.intent.y+chain}, system:{x:E.system.x, y:E.system.y+chain}};

  const wrap=host.append("div").attr("class","panel single-balance");
  const svg=wrap.append("svg").attr("class","balance-svg big")
    .attr("viewBox",`0 0 ${W} ${Hh}`).attr("width","100%");

  // floor + stand
  svg.append("rect").attr("x",cx-90).attr("y",baseY).attr("width",180).attr("height",9)
    .attr("rx",4).attr("fill","var(--line2)");
  svg.append("path").attr("d",`M${cx-22},${baseY} L${cx-5},${pivotY} L${cx+5},${pivotY} L${cx+22},${baseY} Z`)
    .attr("fill","var(--panel2)").attr("stroke","var(--line2)").attr("stroke-width",1.2);

  // beam (two-tone: red intent half, blue system half) + hub
  svg.append("line").attr("x1",E.intent.x).attr("y1",E.intent.y).attr("x2",cx).attr("y2",pivotY)
    .attr("stroke",POLE_COLOR.intent).attr("stroke-width",7).attr("stroke-linecap","round");
  svg.append("line").attr("x1",cx).attr("y1",pivotY).attr("x2",E.system.x).attr("y2",E.system.y)
    .attr("stroke",POLE_COLOR.system).attr("stroke-width",7).attr("stroke-linecap","round");
  svg.append("circle").attr("cx",cx).attr("cy",pivotY).attr("r",9)
    .attr("fill","var(--panel)").attr("stroke","var(--txt2)").attr("stroke-width",2.5);

  // chains, cups, captions
  ["intent","system"].forEach(pole=>{
    const e=E[pole], pc=POLE_COLOR[pole], pp=pan[pole];
    svg.append("line").attr("x1",e.x).attr("y1",e.y).attr("x2",pp.x-panW*0.36).attr("y2",pp.y)
      .attr("stroke","var(--line2)").attr("stroke-width",1.2);
    svg.append("line").attr("x1",e.x).attr("y1",e.y).attr("x2",pp.x+panW*0.36).attr("y2",pp.y)
      .attr("stroke","var(--line2)").attr("stroke-width",1.2);
    svg.append("path").attr("d",`M${pp.x-panW/2},${pp.y} Q${pp.x},${pp.y+46} ${pp.x+panW/2},${pp.y}`)
      .attr("fill","none").attr("stroke",pc).attr("stroke-width",3);
    svg.append("path").attr("d",`M${pp.x-panW/2},${pp.y} Q${pp.x},${pp.y+42} ${pp.x+panW/2},${pp.y} Z`)
      .attr("fill",pc).attr("opacity",.08);
    svg.append("text").attr("x",pp.x).attr("y",pp.y+70).attr("text-anchor","middle")
      .attr("class","pole-cap").attr("fill",pc)
      .text(pole==="intent"?t("pole_intent"):t("pole_system"));
    svg.append("text").attr("x",pp.x).attr("y",pp.y+86).attr("text-anchor","middle")
      .attr("class","pole-num").attr("fill",pc).text(P.w[pole].toFixed(1));
  });

  // weight nodes with gravity
  const rad=v=>Math.max(15,Math.min(36,15+Math.sqrt(v)*7));
  P.nodes.forEach(n=>{ n.r=rad(n.val); const pp=pan[n.pole];
    n.x=pp.x+(Math.random()-0.5)*70; n.y=pp.y-110-Math.random()*50; });
  const floorY=pole=>pan[pole].y+26;

  const g=svg.append("g").attr("class","weights").selectAll("g.wnode")
    .data(P.nodes).enter().append("g").attr("class","wnode")
    .style("cursor",d=>d.ids.length?"pointer":"default")
    .on("mousemove",(ev,d)=>showTip(
      `<div class="tt-h" style="color:${POLE_COLOR[d.pole]}">${CAT_ICON[d.id]||""} ${t("cat_"+d.id)}</div>
       <div class="tt-m">${t("bal_pole")} ${d.pole==="intent"?t("pole_intent"):t("pole_system")} · ${t("bal_wt")} ${d.val.toFixed(2)}</div>
       <div class="tt-b">${t("cat_"+d.id+"_d")}</div>`,ev))
    .on("mouseleave",hideTip)
    .on("click",(ev,d)=>{ if(d.ids.length) inspectIds(`${t("cat_"+d.id)}`, d.ids); });
  g.append("circle").attr("r",d=>d.r)
    .attr("fill",d=>POLE_COLOR[d.pole]).attr("fill-opacity",.88)
    .attr("stroke","#0c1018").attr("stroke-width",1.4)
    .attr("stroke-dasharray",d=>d.structural?"4 3":null);
  g.append("circle").attr("r",d=>d.r*0.46).attr("cx",d=>-d.r*0.3).attr("cy",d=>-d.r*0.3)
    .attr("fill","#fff").attr("opacity",.12);
  g.append("text").attr("text-anchor","middle").attr("dy","0.34em").attr("class","wicon")
    .style("font-size",d=>Math.min(20,d.r*0.95)+"px").text(d=>CAT_ICON[d.id]||"");

  const sim=d3.forceSimulation(P.nodes)
    .force("x",d3.forceX(d=>pan[d.pole].x).strength(0.05))
    .force("y",d3.forceY(d=>floorY(d.pole)).strength(0.16))
    .force("collide",d3.forceCollide(d=>d.r+2).strength(0.92))
    .alpha(1).alphaDecay(0.016)
    .on("tick",()=>{
      P.nodes.forEach(d=>{ const pp=pan[d.pole], half=panW/2-d.r-4;
        d.x=Math.max(pp.x-half,Math.min(pp.x+half,d.x));
        d.y=Math.min(floorY(d.pole)-d.r, d.y);
        if(d.y<pp.y-150+d.r) d.y=pp.y-150+d.r;
      });
      g.attr("transform",d=>`translate(${d.x},${d.y})`);
    });
  BAL_SIMS.push(sim);
}

function renderBalance(){
  const host=d3.select("#view-balance"); host.html("");
  const msgs = filtered();
  const B = computeBalance(msgs);
  const H = {}; DATA.meta.hypotheses.forEach(h=>H[h.id]=h);
  const sortedH = ["A","B","C"].sort((a,b)=>B.conf[b]-B.conf[a]);

  const P = computePoles(B);

  host.append("h2").text(t("bal_h2"));
  host.append("div").attr("class","sub").html(t("bal_sub"));
  host.append("div").attr("class","hint").style("margin","-6px 0 14px")
    .text(tpl("bal_scope",{n:B.total}));

  /* ---- verdict banner: which pole the balance tilts to ---- */
  const wColor = POLE_COLOR[P.lean];
  const tail = P.tie ? t("bal_tail_tie")
    : (P.lean==="intent" ? t("bal_tail_intent") : t("bal_tail_system"));
  const label = P.lean==="intent" ? t("pole_intent") : t("pole_system");
  host.append("div").attr("class","verdict-banner")
    .style("border-color",wColor)
    .html(`<div class="vb-tag" style="background:${wColor}">${t("bal_verdict")}</div>
      <div class="vb-text">${tpl("bal_tilt_line",{label, iw:`${t("pole_intent")} ${P.w.intent.toFixed(1)}`, sw:`${t("pole_system")} ${P.w.system.toFixed(1)}`, tail})}</div>`);

  /* ---- the single physical balance with node-gravity ---- */
  BAL_SIMS.forEach(s=>s.stop()); BAL_SIMS=[];
  drawSingleBalance(host, P);

  /* ---- evidence-category ledger ---- */
  const led=host.append("div").attr("class","panel bal-ledger");
  led.append("div").attr("class","ptitle").text(t("bal_cat").toUpperCase());
  const tbl=led.append("table").attr("class","bal-tbl");
  const thr=tbl.append("thead").append("tr");
  [t("bal_cat"),t("bal_n"),t("bal_wt"),t("bal_pole")].forEach((c,i)=>
    thr.append("th").attr("class",i>0&&i<3?"num":"").text(c));
  const tb=tbl.append("tbody");
  // group by pole so the two sides read clearly
  ["intent","system"].forEach(pole=>{
    B.rows.filter(r=>POLE_OF[r.id]===pole).forEach(r=>{
      const tr=tb.append("tr").attr("class", r.strength<=0?"row-absent":"");
      const td=tr.append("td");
      td.append("div").attr("class","cat-name").html(`${CAT_ICON[r.id]||""} ${t("cat_"+r.id)}`);
      td.append("div").attr("class","cat-desc").text(t("cat_"+r.id+"_d"));
      tr.append("td").attr("class","num").text(
        r.fixed ? "—" : (r.count!=null ? r.count + (r.unit||"") : "—"));
      tr.append("td").attr("class","num mono").text(r.strength.toFixed(2));
      const push=tr.append("td").attr("class","push");
      push.append("span").attr("class","push-chip pf")
        .style("--hc",POLE_COLOR[pole])
        .html(pole==="intent"?t("pole_intent"):t("pole_system"));
      if(r.ids && r.ids.length){
        tr.classed("clickable",true)
          .on("click",()=>inspectIds(`${t("cat_"+r.id)} — ${t("bal_load")}`, r.ids));
      }
    });
  });

  host.append("div").attr("class","hint bal-method").html(t("bal_method"));
}

function switchView(viewId){
  document.querySelectorAll("#tabs .tab").forEach(b=>
    b.classList.toggle("active", b.dataset.view===viewId));
  document.querySelectorAll("#canvas .view").forEach(v=>
    v.classList.toggle("active", v.id===viewId));
  STATE.view = viewId;
  if(viewId==="view-balance") renderBalance(); else renderMain();
}

/* --------------------------------------------------------- HYPOTHESES ----- */
function buildHypotheses(){
  const colors={A:"#ef4444",B:"#5b8def",C:"#a855f7"};
  const wrap=d3.select("#hypotheses").html("");
  DATA.meta.hypotheses.forEach(h=>{
    const strength=h.for.length/(h.for.length+h.against.length);
    const el=wrap.append("div").attr("class","hyp"+(STATE.hypothesis===h.id?" active":"")).attr("data-h",h.id);
    el.html(`<div class="ht"><span>${hypLabel(h)}</span><span class="hbadge">${h.id}</span></div>
      <div class="hclaim">${hypClaim(h)}</div>
      <div class="hscore"><i style="width:${strength*100}%;background:${colors[h.id]}"></i></div>`);
    el.on("click",()=>{
      STATE.hypothesis = STATE.hypothesis===h.id?null:h.id;
      d3.selectAll(".hyp").classed("active",false);
      if(STATE.hypothesis) el.classed("active",true);
      showHypothesisEvidence(h);
      // focus the braid on the hypothesis' event set
      HL.events = STATE.hypothesis ? new Set(h.evidence_events) : null;
      HL.note = STATE.hypothesis ? `${hypLabel(h)} (${h.id})` : null;
      renderMain();
    });
  });
}
function showHypothesisEvidence(h){
  if(STATE.hypothesis!==h.id){ clearInspector(); return; }
  selClear();
  const ids=[];
  h.evidence_events.forEach(eid=>{
    const ev=DATA.events.find(e=>e.id===eid);
    if(ev) ev.evidence.forEach(i=>ids.push(i));
  });
  const body=document.getElementById("insp-body");
  document.getElementById("insp-title").textContent=t("hyp_evidence_title").replace("{id}",h.id);
  body.innerHTML =
    `<div class="ev-card"><div class="ev-agent">${hypLabel(h)}</div>
      <div class="ev-text">${hypClaim(h)}</div>
      <div class="ev-tags" style="margin-top:8px"><span class="tag governance">${t("hyp_for")}</span></div>
      <ul style="margin:6px 0 0;padding-left:16px;font-size:11px;color:var(--txt2);line-height:1.6">
        ${hypFor(h).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>
      <div class="ev-tags" style="margin-top:8px"><span class="tag merger">${t("hyp_against")}</span></div>
      <ul style="margin:6px 0 0;padding-left:16px;font-size:11px;color:var(--txt2);line-height:1.6">
        ${hypAgainst(h).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`
    + `<div class="hint" style="margin:8px 0 6px">${t("hyp_evidence").replace("{n}",[...new Set(ids)].length)}</div>`
    + [...new Set(ids)].map(i=>MSG_BY_ID[i]).filter(Boolean)
        .sort((a,b)=>a._date-b._date).map(msgCard).join("");
  body.scrollTop=0;
}

/* ===========================================================================
   THE BEHAVIORAL DRIFT BRAID — single condensed view
   =========================================================================== */
function renderMain(){
  const host=d3.select("#view-main"); host.html("");
  const {agents,byAR,baseline,covertArcs,gates,silent,anomaly,aMean,aSd,events}=DER;
  const rounds=DATA.rounds, R=rounds.length, c0=DATA.meta.crisis_round0;
  const fset=new Set(filtered().map(m=>m.id));
  const agentOn = a => STATE.agents.size===0 || STATE.agents.has(a);
  const hlAgent = a => !HL.agents || HL.agents.has(a);
  const hlEvent = e => !HL.events || HL.events.has(e.id);

  host.append("h2").text(t("braid_h2"));
  host.append("div").attr("class","sub").html(t("braid_sub"));

  /* ---- layer toggles + focus note ---- */
  const ctl=host.append("div").attr("class","layerctl");
  const LAYERS=[["baselines","layer_baselines"],["arcs","layer_arcs"],
    ["gates","layer_gates"],["events","layer_events"],["arrows","layer_arrows"]];
  LAYERS.forEach(([k,lblKey])=>{
    ctl.append("div").attr("class","chip"+(STATE.layers[k]?"":" off")).text(t(lblKey))
      .on("click",function(){ STATE.layers[k]=!STATE.layers[k]; renderMain(); });
  });
  if(HL.agents||HL.events){
    ctl.append("div").attr("class","chip focus-note")
      .html(`◎ ${t("focus_label")}: ${escapeHtml(HL.note||"custom")} <b style="margin-left:4px">✕</b>`)
      .on("click",()=>{ HL.agents=null; HL.events=null; HL.note=null;
        d3.selectAll("#qp-list .qitem").classed("active",false); renderMain(); });
  }

  /* ---- geometry ---- */
  const W=Math.max(1000, host.node().clientWidth-46);
  const left=164, right=152, top=74;
  const bandH=56, braidH=bandH*ZONES.length;
  const axisH=94;
  const selIds=selIdSet();
  const x=d3.scalePoint().domain(d3.range(R)).range([left,W-right]).padding(0.4);
  const step=x(1)-x(0);
  const yZone=p=>top+(p+0.5)*bandH;   // posture 0..5 → band centers
  const jit=i=>(i-(agents.length-1)/2)*3.4;

  const panel=host.append("div").attr("class","panel braid-panel");
  const svg=panel.append("svg").attr("width",W).attr("height",top+braidH+axisH);

  /* arrowhead markers */
  const defs=svg.append("defs");
  [["arrh","#8fa0c0"],["arrh-red","#ef4444"]].forEach(([id,col])=>{
    defs.append("marker").attr("id",id).attr("viewBox","0 0 10 10")
      .attr("refX",9).attr("refY",5).attr("markerWidth",7).attr("markerHeight",7)
      .attr("orient","auto-start-reverse")
      .append("path").attr("d","M0,0L10,5L0,10z").attr("fill",col);
  });

  /* ---- y-axis title ---- */
  svg.append("text").attr("x",8).attr("y",top-32).attr("text-anchor","start")
    .attr("font-size",9).attr("font-weight",600).attr("font-family","var(--mono)")
    .attr("fill","var(--txt2)").text(t("y_title"));

  /* ---- posture zone bands (left gutter holds the full Y legend) ---- */
  const plotR = W-right+86;
  ZONES.forEach((z,i)=>{
    const y0=top+i*bandH;
    svg.append("rect").attr("x",0).attr("y",y0).attr("width",plotR).attr("height",bandH)
      .attr("fill",chColor(z.ch)).attr("fill-opacity",i>=3?0.055:0.035);
    svg.append("line").attr("x1",0).attr("x2",plotR).attr("y1",y0).attr("y2",y0)
      .attr("stroke","var(--line)").attr("stroke-width",0.6).attr("opacity",.5);
    svg.append("text").attr("x",10).attr("y",y0+bandH/2-3).attr("text-anchor","start")
      .attr("font-size",9.5).attr("font-family","var(--mono)").attr("fill",chColor(z.ch)).text(z.label);
    svg.append("text").attr("x",10).attr("y",y0+bandH/2+9).attr("text-anchor","start")
      .attr("font-size",8).attr("fill","var(--txt3)").text(z.sub);
  });

  /* ---- the embargo enforcement perimeter ---- */
  const periY=top+3*bandH;
  svg.append("line").attr("x1",0).attr("x2",plotR).attr("y1",periY).attr("y2",periY)
    .attr("class","embargo-line").attr("stroke-width",2);
  svg.append("text").attr("x",10).attr("y",periY-5).attr("class","embargo-label")
    .text(t("embargo_perimeter"));

  /* ---- crisis-day phase washes + embargo / leak markers ---- */
  {
    const roundPhase={};
    events.forEach(e=>{ if(!roundPhase[e._round]) roundPhase[e._round]=e.phase; });
    const seen={};
    rounds.forEach((r,ri)=>{
      if(!r.hour.startsWith("2046-06-05")) return;
      const ph=roundPhase[ri], col=PHASE_COLOR[ph]||"#f97316";
      svg.append("rect").attr("x",x(ri)-step/2).attr("y",top).attr("width",step).attr("height",braidH)
        .attr("fill",col).attr("fill-opacity",0.05);
      if(ph&&!seen[ph]){ seen[ph]=true;
        svg.append("text").attr("x",x(ri)).attr("y",top-46).attr("text-anchor","middle")
          .attr("font-size",7.5).attr("font-family","var(--mono)").attr("fill",col).attr("opacity",.9)
          .text(phaseLabel(ph));
      }
    });
    const embargoRound=rounds.findIndex(r=>r.hour==="2046-06-05T18:00:00");
    const leakRound=rounds.findIndex(r=>r.hour==="2046-06-05T17:00:00");
    [[leakRound,"#f97316",t("mk_breach"),"end"],[embargoRound,"#ef4444",t("mk_embargo"),"start"]].forEach(([ri,col,lab,anch])=>{
      if(ri<0) return;
      svg.append("line").attr("x1",x(ri)).attr("x2",x(ri)).attr("y1",top-14).attr("y2",top+braidH)
        .attr("stroke",col).attr("stroke-width",1.3).attr("stroke-dasharray","5 4").attr("opacity",.85);
      svg.append("text").attr("x",x(ri)).attr("y",top-17).attr("fill",col)
        .attr("font-size",9).attr("font-family","var(--mono)").attr("text-anchor",anch).text(lab);
    });
  }

  /* ---- thread points ---- */
  const pts={};  // agent -> [{ri,x,y,cell}]
  agents.forEach((a,ai)=>{
    pts[a]=[];
    byAR[a].forEach((cell,ri)=>{
      if(!cell) return;
      pts[a].push({ri, x:x(ri), y:yZone(cell.posture)+jit(ai), cell});
    });
  });

  /* ---- baselines (expected behavior) ---- */
  if(STATE.layers.baselines){
    agents.forEach((a,ai)=>{
      const b=baseline[a]; if(!b) return;
      const y=yZone(b.mean)+jit(ai);
      svg.append("line").attr("x1",left-4).attr("x2",W-right+10).attr("y1",y).attr("y2",y)
        .attr("stroke",AGENT_COLOR(a)).attr("stroke-width",1)
        .attr("stroke-dasharray","2 5").attr("opacity",hlAgent(a)&&agentOn(a)?0.4:0.07);
    });
  }

  /* groups that must sit above the brush overlay to stay interactive */
  const RAISE=[];

  /* ---- covert coordination arcs ---- */
  if(STATE.layers.arcs){
    const arcG=svg.append("g"); RAISE.push(arcG);
    covertArcs.forEach(p=>{
      const A=pts[p.a].find(d=>d.ri===p.round), B=pts[p.b].find(d=>d.ri===p.round);
      if(!A||!B) return;
      const dim=!(hlAgent(p.a)&&hlAgent(p.b)&&agentOn(p.a)&&agentOn(p.b));
      const bulge=12+Math.min(p.count*1.6,16);
      const d=`M${A.x},${A.y} C${A.x+bulge},${A.y} ${B.x+bulge},${B.y} ${B.x},${B.y}`;
      // public posts the two tied agents put out from this round on — the leak the tie produced
      const postIds=DATA.messages.filter(m=>m.is_public && m.round>=p.round &&
        (m.agent===p.a||m.agent===p.b)).map(m=>m.id);
      const open=ev=>{
        const ids=[...new Set([...p.ids, ...postIds])];
        pickInspect(`${t("tt_covert")}: ${DATA.meta.agents[p.a].label} ↔ ${DATA.meta.agents[p.b].label} → ${postIds.length} ${t("tt_posts")}`, ids, ev, true);
      };
      const tip=ev=>showTip(`<div class="tt-h" style="color:#a855f7">${t("tt_covert")}</div>
          <div class="tt-m">${rounds[p.round].hour.replace("T"," ")}</div>
          <div class="tt-b">${DATA.meta.agents[p.a].label} ↔ ${DATA.meta.agents[p.b].label} · ${p.count} ${t("tt_sidehuddle_msgs")}<br>
          → ${postIds.length} ${t("tt_posts")} ${t("tt_covert_posts")}</div>`,ev);
      // visible arc
      arcG.append("path").attr("d",d)
        .attr("fill","none").attr("stroke","#a855f7")
        .attr("stroke-width",Math.min(1+p.count*0.5,4.5))
        .attr("stroke-dasharray","4 3").attr("opacity",dim?0.06:0.45)
        .style("pointer-events","none");
      // wide invisible hit area so the thin tie is easy to click/hover
      arcG.append("path").attr("d",d).attr("fill","none").attr("stroke","transparent")
        .attr("stroke-width",14).style("cursor","pointer")
        .on("mousemove",tip).on("mouseleave",hideTip)
        .on("click",ev=>{ev.stopPropagation(); open(ev);});
    });
  }

  /* ---- threads (volume band + center line) ---- */
  const threadG=svg.append("g"); RAISE.push(threadG);
  agents.forEach(a=>{
    const P=pts[a]; if(!P.length) return;
    const on=agentOn(a), hl=hlAgent(a);
    const op = !on?0.05 : !hl?0.10 : 1;
    const wOf=c=>2+Math.sqrt(c.count)*2.1;
    threadG.append("path").datum(P)
      .attr("d",d3.area().x(d=>d.x).y0(d=>d.y-wOf(d.cell)/2).y1(d=>d.y+wOf(d.cell)/2).curve(d3.curveMonotoneX))
      .attr("fill",AGENT_COLOR(a)).attr("fill-opacity",0.16*op);
    threadG.append("path").datum(P)
      .attr("d",d3.line().x(d=>d.x).y(d=>d.y).curve(d3.curveMonotoneX))
      .attr("fill","none").attr("stroke",AGENT_COLOR(a)).attr("stroke-width",1.7)
      .attr("opacity",0.9*op);
  });

  /* ---- node glyphs per agent-round ---- */
  const nodeG=svg.append("g"); RAISE.push(nodeG);
  agents.forEach((a,ai)=>{
    const on=agentOn(a), hl=hlAgent(a);
    pts[a].forEach(d=>{
      const c=d.cell;
      // every public post drops a triangle into the zone it was published on —
      // personal/anonymous triangles appearing below the perimeter ARE the story
      d3.rollups(c.msgs.filter(m=>m.is_public),v=>v,m=>m.channel).forEach(([ch,list])=>{
        const py=yZone(POSTURE[ch])+jit(ai);
        const anyViol=list.some(m=>m.embargo_violation);
        const match=list.some(m=>fset.has(m.id));
        const op=(!on||!hl)?0.08:(match?1:0.16);
        const pg=nodeG.append("g").style("opacity",op);
        pg.append("line").attr("x1",d.x).attr("x2",d.x).attr("y1",d.y).attr("y2",py-7)
          .attr("stroke",chColor(ch)).attr("stroke-width",1).attr("stroke-dasharray","2 3").attr("opacity",.5);
        pg.append("path").attr("d",d3.symbol(d3.symbolTriangle,40+list.length*16)())
          .attr("transform",`translate(${d.x},${py})`)
          .attr("fill",chColor(ch))
          .attr("stroke",anyViol?"#ef4444":"#0c1018").attr("stroke-width",anyViol?2:0.8)
          .style("cursor","pointer")
          .on("mousemove",ev=>showTip(`<div class="tt-h" style="color:${chColor(ch)}">${CH_LABEL[ch]}</div>
            <div class="tt-m">${rounds[d.ri].hour.replace("T"," ")} · <span style="color:${AGENT_COLOR(a)}">${DATA.meta.agents[a].label}</span></div>
            <div class="tt-b">${list.length} ${t("tt_posts")}${anyViol?` · <b style="color:#ef4444">${t("tt_violation")}</b>`:''}<br>${escapeHtml(list[0].content).slice(0,150)}…</div>`,ev))
          .on("mouseleave",hideTip)
          .on("click",ev=>{ev.stopPropagation();
            pickInspect(`${DATA.meta.agents[a].label} → ${CH_LABEL[ch]} @ ${rounds[d.ri].hour}`,list,ev);});
      });
      const match=c.msgs.some(m=>fset.has(m.id));
      const op=(!on||!hl)?0.08:(match?1:0.16);
      const r=2.2+Math.sqrt(c.count)*1.35;
      const g=nodeG.append("g").attr("transform",`translate(${d.x},${d.y})`).style("opacity",op);
      if(c.viol) g.append("circle").attr("r",r+3.5).attr("fill","none")
        .attr("stroke","#ef4444").attr("stroke-width",2);
      g.append("circle").attr("class","node-dot").attr("r",r)
        .classed("sel-node", c.msgs.some(m=>selIds.has(m.id)))
        .attr("fill",AGENT_COLOR(a)).attr("fill-opacity",.85)
        .attr("stroke","#0c1018").attr("stroke-width",1)
        .on("mousemove",ev=>{
          const byCh=d3.rollups(c.msgs,v=>v.length,m=>m.channel)
            .sort((p,q)=>q[1]-p[1]).map(([ch,n])=>`${CH_LABEL[ch]}: ${n}`).join("<br>");
          showTip(`<div class="tt-h" style="color:${AGENT_COLOR(a)}">${DATA.meta.agents[a].label}</div>
            <div class="tt-m">${rounds[d.ri].hour.replace("T"," ")}</div>
            <div class="tt-b">${c.count} ${t("tt_msgs")} · ${c.pub} ${t("tt_public")}${c.viol?` · <b style="color:#ef4444">${t("mc_violation")}</b>`:''}${c.boundary?` · <b style="color:#f97316">${t("tt_boundary")}</b>`:''}<br>${byCh}</div>`,ev);
        })
        .on("mouseleave",hideTip)
        .on("click",ev=>{ev.stopPropagation(); pickInspect(`${DATA.meta.agents[a].label} @ ${rounds[d.ri].hour}`,c.msgs,ev);});
      if(c.boundary)
        g.append("path").attr("d",d3.symbol(d3.symbolDiamond,42)())
          .attr("transform",`translate(0,${-r-8})`)
          .attr("fill","#f97316").attr("stroke","#0c1018").attr("stroke-width",.8)
          .style("cursor","pointer")
          .on("mousemove",ev=>showTip(`<div class="tt-h" style="color:#f97316">${t("tt_boundary")}</div>
            <div class="tt-b">${t("tt_boundary_b")}</div>`,ev))
          .on("mouseleave",hideTip)
          .on("click",ev=>{ev.stopPropagation();
            pickInspect(`${t("tt_boundary")} — ${DATA.meta.agents[a].label}`,
              c.msgs.filter(m=>m.is_public&&(m.flags.merger||m.flags.embargo)),ev);});
    });
  });

  /* ---- judge gates + silent gap ---- */
  if(STATE.layers.gates){
    const gateG=svg.append("g"); RAISE.push(gateG);
    if(silent.length){
      const x0=x(silent[0])-step/2, x1=x(silent[silent.length-1])+step/2;
      gateG.append("rect").attr("x",x0).attr("y",top-12).attr("width",x1-x0).attr("height",12)
        .attr("fill","#ef4444").attr("fill-opacity",.16).attr("stroke","#ef4444")
        .attr("stroke-dasharray","3 3").attr("stroke-width",.8)
        .style("cursor","help")
        .on("mousemove",ev=>showTip(`<div class="tt-h" style="color:#ef4444">${t("tt_gap_h")}</div>
          <div class="tt-b">${t("tt_gap_b")}</div>`,ev))
        .on("mouseleave",hideTip);
      gateG.append("text").attr("x",(x0+x1)/2).attr("y",top-3).attr("text-anchor","middle")
        .attr("font-size",7.5).attr("font-family","var(--mono)").attr("fill","#ef4444")
        .style("pointer-events","none").text(t("judge_silent"));
    }
    gates.forEach(gt=>{
      const col=gt.breached?"#ef4444":"#22c55e";
      gateG.append("line").attr("x1",x(gt.round)).attr("x2",x(gt.round))
        .attr("y1",top-26).attr("y2",top+braidH)
        .attr("stroke",col).attr("stroke-width",1).attr("stroke-dasharray","2 4").attr("opacity",.5);
      gateG.append("text").attr("x",x(gt.round)).attr("y",top-28).attr("text-anchor","middle")
        .attr("font-size",13).attr("fill",col).style("cursor","pointer").text("⚖")
        .on("mousemove",ev=>showTip(`<div class="tt-h" style="color:${col}">${t("tt_judge")} — ${gt.breached?t("tt_breached"):t("tt_held")}</div>
          <div class="tt-m">${rounds[gt.round].hour.replace("T"," ")} · ${gt.msgs.length} ${t("tt_rulings")}</div>
          <div class="tt-b">${escapeHtml(gt.msgs[0].content).slice(0,180)}…</div>
          <div class="tt-b">${gt.breached?t("tt_breached_note"):t("tt_held_note")}</div>`,ev))
        .on("mouseleave",hideTip)
        .on("click",ev=>{ev.stopPropagation(); pickInspect(`${DATA.meta.agents.judge_agent.label} @ ${rounds[gt.round].hour}`,gt.msgs,ev);});
    });
  }

  /* ---- curated event chain + causal arrows ---- */
  if(STATE.layers.events){
    const evG=svg.append("g"); RAISE.push(evG);
    // y of an actor's thread AT a given round — interpolated so the marker lands
    // on the thread directly under its own round (not the nearest existing node)
    const threadYAt=(actor,ri)=>{
      const P=pts[actor];
      if(!P||!P.length) return yZone(0);
      if(ri<=P[0].ri) return P[0].y;
      if(ri>=P[P.length-1].ri) return P[P.length-1].y;
      for(let k=0;k<P.length-1;k++){
        if(ri>=P[k].ri && ri<=P[k+1].ri){
          const f=(ri-P[k].ri)/((P[k+1].ri-P[k].ri)||1);
          return P[k].y + f*(P[k+1].y-P[k].y);
        }
      }
      return P[P.length-1].y;
    };
    // anchor each event to its actor's thread at its OWN round; nudge only the
    // markers that genuinely share a round (E10/E11) so they don't overlap
    const used={};
    const eNodes=events.map(e=>{
      const tx=x(e._round);                       // true horizontal slot of the round
      const ty=threadYAt(e.actor, e._round);      // thread height at that round
      const n=(used[e._round]=(used[e._round]||0)+1);
      const ex=tx+(n-1)*16;                        // marker x (offset on collision only)
      const ey=ty-26;
      return {e, x:ex, y:ey, tx, ty};
    });
    // causal arrows (drawn first, under nodes)
    if(STATE.layers.arrows){
      for(let i=0;i<eNodes.length-1;i++){
        const A=eNodes[i],B=eNodes[i+1];
        const both=hlEvent(A.e)&&hlEvent(B.e);
        const ignored=A.e.id==="E09"&&B.e.id==="E10";
        const my=Math.max(14, Math.min(A.y,B.y)-26-Math.abs(B.x-A.x)*0.06);
        evG.append("path")
          .attr("d",`M${A.x},${A.y-9} Q${(A.x+B.x)/2},${my} ${B.x},${B.y-9}`)
          .attr("fill","none")
          .attr("stroke",ignored?"#ef4444":"#8fa0c0")
          .attr("stroke-width",ignored?1.8:1.1)
          .attr("stroke-dasharray",ignored?"5 3":null)
          .attr("marker-end",`url(#${ignored?"arrh-red":"arrh"})`)
          .attr("opacity",both?(ignored?0.95:0.55):0.08);
        if(ignored&&both)
          evG.append("text").attr("x",(A.x+B.x)/2-14).attr("y",my+16).attr("text-anchor","end")
            .attr("font-size",8.5).attr("font-family","var(--mono)").attr("fill","#ef4444")
            .text(t("tt_ceiling"));
      }
    }
    eNodes.forEach(({e,x:ex,y:ey,tx,ty})=>{
      const col=PHASE_COLOR[e.phase]||"#888";
      const op=hlEvent(e)?1:0.13;
      const g=evG.append("g").style("opacity",op).style("cursor","pointer");
      // leader connects the numbered marker to the actual thread node at its round
      g.append("line").attr("x1",ex).attr("x2",tx).attr("y1",ey+8).attr("y2",ty-4)
        .attr("stroke",col).attr("stroke-width",1).attr("opacity",.7);
      g.append("circle").attr("cx",tx).attr("cy",ty).attr("r",2.4).attr("fill",col).attr("opacity",.8);
      g.append("circle").attr("cx",ex).attr("cy",ey).attr("r",e.kind==="breach"?10:8.5)
        .attr("fill",col).attr("fill-opacity",.95).attr("stroke","#0c1018").attr("stroke-width",1.6);
      g.append("text").attr("x",ex).attr("y",ey+3).attr("text-anchor","middle")
        .attr("font-size",8).attr("font-weight",700).attr("fill","#0c1018")
        .style("pointer-events","none").text(+e.id.slice(1));
      g.on("mousemove",ev=>showTip(`<div class="tt-h" style="color:${col}">${e.id} · ${evTitle(e)}</div>
          <div class="tt-m">${(e._ts||e.ts).replace("T"," ")} · ${t("tt_phase")}: ${phaseLabel(e.phase)} · ${t("tt_actor")}:
            <span style="color:${AGENT_COLOR(e.actor)}">${DATA.meta.agents[e.actor]?DATA.meta.agents[e.actor].label:e.actor}</span></div>
          <div class="tt-b">${escapeHtml(evSummary(e)).slice(0,240)}</div>`,ev))
        .on("mouseleave",hideTip)
        .on("click",ev=>{ev.stopPropagation(); pickInspect(`${e.id} — ${evTitle(e)}`,e.evidence,ev,true);});
    });
  }

  /* ---- thread end labels (right edge) ---- */
  {
    const labG=svg.append("g"); RAISE.push(labG);
    const labels=agents
      .map(a=>{const P=pts[a]; return P.length?{a, y:P[P.length-1].y}:null;})
      .filter(Boolean).sort((p,q)=>p.y-q.y);
    for(let i=1;i<labels.length;i++)
      if(labels[i].y-labels[i-1].y<13) labels[i].y=labels[i-1].y+13;
    labels.forEach(L=>{
      labG.append("text").attr("x",W-right+16).attr("y",L.y+3)
        .attr("font-size",10.5).attr("font-weight",HL.agents&&HL.agents.has(L.a)?700:500)
        .attr("fill",AGENT_COLOR(L.a)).style("cursor","pointer")
        .style("opacity",hlAgent(L.a)&&agentOn(L.a)?1:0.3)
        .text(DATA.meta.agents[L.a].label+" ▸")
        .on("mousemove",ev=>showTip(`<div class="tt-h" style="color:${AGENT_COLOR(L.a)}">${DATA.meta.agents[L.a].label}</div>
          <div class="tt-b">${t("tt_click_profile")}</div>`,ev))
        .on("mouseleave",hideTip)
        .on("click",()=>{
          const solo=HL.agents&&HL.agents.size===1&&HL.agents.has(L.a);
          HL.agents=solo?null:new Set([L.a]);
          HL.note=solo?null:DATA.meta.agents[L.a].label+" "+t("focus_label");
          showAgentProfile(L.a);
          renderMain();
        });
    });
  }

  /* ---- x axis ---- */
  const xa=svg.append("g").attr("class","axis").attr("transform",`translate(0,${top+braidH+16})`);
  xa.selectAll("text").data(rounds).join("text")
    .attr("x",(d,i)=>x(i)).attr("y",0).attr("text-anchor","end")
    .attr("transform",(d,i)=>`rotate(-45,${x(i)},0)`)
    .text(d=>d.hour.startsWith("2046-06-05")?fmtHour(d._date):fmtDay(d._date))
    .attr("fill",d=>d.hour.startsWith("2046-06-05")?"#ffd28a":"#64708c");
  svg.append("text").attr("x",(left+W-right)/2).attr("y",top+braidH+axisH-26)
    .attr("text-anchor","middle").attr("font-size",10).attr("font-weight",600)
    .attr("font-family","var(--mono)").attr("fill","var(--txt2)")
    .text(t("x_title"));
  svg.append("text").attr("x",(left+W-right)/2).attr("y",top+braidH+axisH-9)
    .attr("text-anchor","middle").attr("font-size",8.5)
    .attr("font-family","var(--mono)").attr("fill","var(--txt3)")
    .text(t("x_caption"));

  /* ---- lasso: draw a free-form loop to select any enclosed nodes/messages ---- */
  const lassoLayer=svg.append("g").attr("class","lasso-layer").style("pointer-events","none");
  const lassoCatch=svg.append("rect").attr("class","lasso-catch")
    .attr("x",left-12).attr("y",top).attr("width",(W-right+12)-(left-12)).attr("height",braidH)
    .attr("fill","transparent").style("cursor","crosshair");
  // every selectable braid node: agent-round circles (their cell carries the msgs)
  const lassoNodes=[];
  agents.forEach(a=> pts[a].forEach(d=> lassoNodes.push({x:d.x,y:d.y,ids:d.cell.msgs.map(m=>m.id)})));
  const inPoly=(px,py,poly)=>{                 // ray-casting point-in-polygon
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
      if(((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/((yj-yi)||1e-9)+xi)) inside=!inside;
    }
    return inside;
  };
  lassoCatch.on("mousedown",ev=>{
    ev.preventDefault();
    const additive=ev.shiftKey||ev.metaKey||ev.ctrlKey;
    let lp=[d3.pointer(ev,svg.node())];
    const path=lassoLayer.append("path").attr("class","lasso-path");
    const move=mv=>{ lp.push(d3.pointer(mv,svg.node()));
      path.attr("d","M"+lp.map(p=>p[0]+","+p[1]).join("L")+"Z"); };
    const up=()=>{
      d3.select(window).on("mousemove.lasso",null).on("mouseup.lasso",null);
      path.remove();
      const xs=lp.map(p=>p[0]), ys=lp.map(p=>p[1]);
      const span=Math.max(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys));
      if(lp.length<3 || span<8){ if(!additive){ selClear(); renderSelection(); } return; }  // tiny loop = clear
      const ids=[...new Set(lassoNodes.filter(n=>inPoly(n.x,n.y,lp)).flatMap(n=>n.ids))];
      if(ids.length) pickInspect(`${t("lasso_sel")} · ${ids.length}`, ids, {shiftKey:additive}, true);
    };
    d3.select(window).on("mousemove.lasso",move).on("mouseup.lasso",up);
  });
  // interactive layers must sit above the lasso catch to receive their own clicks;
  // the lasso still works by starting the drag on empty band space
  RAISE.forEach(g=>g.raise());

  /* ====================== CRITICAL PATH TIMELINE ========================== */
  renderCriticalPath(host);

  /* ====================== LEADING-INDICATOR SEISMOGRAPH ==================== */
  renderSeismograph(host, x, left, right, W);
}

/* human-readable gap between two timestamps: "2d", "5h", "35min" */
function humanDelta(ms){
  const mins=Math.round(ms/60000);
  if(mins>=1440) return Math.round(mins/1440)+t("cp_d");
  if(mins>=60)   return Math.round(mins/60)+t("cp_h");
  return Math.max(1,mins)+t("cp_m");
}

/* The critical path as an explicit, time-ordered ribbon — answers WHEN each
   numbered event happens and how fast the chain accelerates into the breach. */
function renderCriticalPath(host){
  const evts=DER.events.slice().sort((a,b)=>
    (new Date(a._ts||a.ts)-new Date(b._ts||b.ts)) || a.id.localeCompare(b.id));
  const hlEvent=e=>!HL.events||HL.events.has(e.id);
  const fmt=d3.timeFormat("%b %d · %H:%M");

  const panel=host.append("div").attr("class","panel critpath-panel");
  panel.append("div").attr("class","ptitle").text(t("cp_title"));
  panel.append("div").attr("class","pdesc").html(t("cp_desc"));
  const strip=panel.append("div").attr("class","critpath");

  let prevDate=null, prevCrisis=false;
  evts.forEach((e,i)=>{
    const ts=e._ts||e.ts;
    const d=new Date(ts);
    const crisis=ts.startsWith("2046-06-05");
    if(crisis && !prevCrisis)
      strip.append("div").attr("class","cp-daybreak").append("span").text(t("cp_crisis"));

    if(i>0){
      const ignored=evts[i-1].id==="E09" && e.id==="E10";
      const conn=strip.append("div").attr("class","cp-arrow"+(ignored?" ignored":""));
      conn.append("div").attr("class","cp-delta").text("+"+humanDelta(d-prevDate));
      conn.append("div").attr("class","cp-arrowline").text(ignored?t("cp_ignored"):"→");
    }

    const col=PHASE_COLOR[e.phase]||"#888";
    const step=strip.append("div")
      .attr("class","cp-step"+(hlEvent(e)?"":" dim")+(e.kind==="breach"?" breach":""))
      .style("--pc",col).style("cursor","pointer");
    const head=step.append("div").attr("class","cp-head");
    head.append("span").attr("class","cp-num").style("background",col).text(+e.id.slice(1));
    head.append("span").attr("class","cp-time").text(fmt(d));
    step.append("div").attr("class","cp-title").text(evTitle(e));
    step.append("div").attr("class","cp-phase").style("color",col).text(phaseLabel(e.phase));

    step.on("mousemove",ev=>showTip(`<div class="tt-h" style="color:${col}">${e.id} · ${evTitle(e)}</div>
        <div class="tt-m">${ts.replace("T"," ")} · ${t("tt_phase")}: ${phaseLabel(e.phase)} · ${t("tt_actor")}:
          <span style="color:${AGENT_COLOR(e.actor)}">${DATA.meta.agents[e.actor]?DATA.meta.agents[e.actor].label:e.actor}</span></div>
        <div class="tt-b">${escapeHtml(evSummary(e)).slice(0,240)}</div>`,ev))
      .on("mouseleave",hideTip)
      .on("click",ev=>{ev.stopPropagation(); pickInspect(`${e.id} — ${evTitle(e)}`,e.evidence,ev,true);});

    prevDate=d; prevCrisis=crisis;
  });
}

function renderSeismograph(host, x, left, right, W){
  const {anomaly,aMean,aSd}=DER;
  const rounds=DATA.rounds, R=rounds.length, c0=DATA.meta.crisis_round0;
  const step=x(1)-x(0);
  const panel=host.append("div").attr("class","panel");
  panel.append("div").attr("class","ptitle").text(t("seis_title"));
  panel.append("div").attr("class","pdesc").html(t("seis_desc"));

  // inline legend (how to read the colors / line / rows)
  const lgItems=[
    [`<i style="background:#5b8def"></i>`, t("lg_normal")],
    [`<i style="background:#f59e0b"></i>`, t("lg_w1")],
    [`<i style="background:#f97316"></i>`, t("lg_w2")],
    [`<i style="background:#ef4444"></i>`, t("lg_viol")],
    [`<i class="lline" style="background:#7aa2ff"></i>`, t("lg_stock")],
  ];
  panel.append("div").attr("class","seis-legend")
    .html(lgItems.map(([sw,lab])=>`<span class="lg-i">${sw}${lab}</span>`).join("")
      + `<span class="lg-i lg-rows">${t("lg_rows")}</span>`);

  const Hh=158, top=16, rowH=13, mTicks=rowH*3+18;
  const svg=panel.append("svg").attr("width",W).attr("height",Hh+mTicks+30);
  const yMax=d3.max(anomaly,d=>d.score)||1;
  const y=d3.scaleLinear().domain([0,yMax*1.05]).range([Hh,top]);

  // y axis + title
  const ax=svg.append("g").attr("class","axis").attr("transform",`translate(${left-8},0)`)
    .call(d3.axisLeft(y).ticks(4));
  ax.select(".domain").remove();
  ax.selectAll(".tick line").attr("stroke","var(--line)").attr("x2",W-left-right+20);
  svg.append("text").attr("transform",`translate(14,${(top+Hh)/2}) rotate(-90)`)
    .attr("text-anchor","middle").attr("font-size",8.5).attr("font-family","var(--mono)")
    .attr("fill","var(--txt3)").text(t("seis_anom_axis"));

  // thresholds
  [[aMean+aSd,t("seis_w1"),"#f59e0b",10],[aMean+2*aSd,t("seis_w2"),"#ef4444",-4]].forEach(([v,lab,col,dy])=>{
    if(v>yMax*1.05) return;
    svg.append("line").attr("x1",left-8).attr("x2",W-right+12).attr("y1",y(v)).attr("y2",y(v))
      .attr("stroke",col).attr("stroke-dasharray","4 4").attr("stroke-width",1).attr("opacity",.7);
    svg.append("text").attr("x",left-2).attr("y",y(v)+dy).attr("font-size",8)
      .attr("font-family","var(--mono)").attr("fill",col).text(lab);
  });

  // brush-range shading
  if(STATE.roundRange){
    const [a,b]=STATE.roundRange;
    svg.append("rect").attr("x",x(a)-step/2).attr("y",top-6)
      .attr("width",x(b)-x(a)+step).attr("height",Hh-top+8)
      .attr("fill","var(--accent)").attr("fill-opacity",.07);
  }

  // bars
  const bw=Math.max(5,step*0.55);
  anomaly.forEach(d=>{
    const col=d.viol>0?"#ef4444":d.score>aMean+2*aSd?"#f97316":d.score>aMean+aSd?"#f59e0b":"#5b8def";
    svg.append("rect").attr("x",x(d.ri)-bw/2).attr("y",y(d.score)).attr("width",bw)
      .attr("height",Math.max(1,Hh-y(d.score)))
      .attr("rx",2).attr("fill",col).attr("fill-opacity",.78)
      .style("cursor","pointer")
      .on("mousemove",ev=>showTip(`<div class="tt-h">${t("tt_anomaly")} ${d.score}</div>
        <div class="tt-m">${rounds[d.ri].hour.replace("T"," ")}</div>
        <div class="tt-b">${t("tt_flagged")} ${d.sens.toFixed(0)} · ${t("seis_row_covert")} ${d.covert} · ${t("seis_row_boundary")} ${d.bound} ·
          <b style="color:#ef4444">${d.viol} ${t("seis_row_violation")}</b><br>${escapeHtml(roundHeadline(d.ri))}</div>`,ev))
      .on("mouseleave",hideTip)
      .on("click",ev=>pickInspect(`${t("tt_anomaly")} @ ${rounds[d.ri].hour}`,d.flaggedIds,ev,true));
    // pre-crisis early-warning flags
    if(d.ri<c0 && d.score>aMean+aSd)
      svg.append("text").attr("x",x(d.ri)).attr("y",y(d.score)-5).attr("text-anchor","middle")
        .attr("font-size",9).attr("fill","#f59e0b").text("▲");
  });

  // stock overlay
  const sp=rounds.map((r,i)=>({i,v:r.stock_price})).filter(d=>d.v!=null);
  if(sp.length>1){
    const ys=d3.scaleLinear().domain(d3.extent(sp,d=>d.v)).range([Hh-8,top+8]);
    svg.append("path").datum(sp)
      .attr("d",d3.line().x(d=>x(d.i)).y(d=>ys(d.v)).curve(d3.curveMonotoneX))
      .attr("fill","none").attr("stroke","#7aa2ff").attr("stroke-width",1.6).attr("opacity",.85);
    svg.append("text").attr("x",x(sp[sp.length-1].i)+6).attr("y",ys(sp[sp.length-1].v)-7)
      .attr("font-size",8.5).attr("font-family","var(--mono)").attr("fill","#7aa2ff")
      .text("$TTHR "+sp[sp.length-1].v.toFixed(0));
  }

  // tick rows
  const rows=[["covert","seis_row_covert","∿","#a855f7",d=>d.covert],
              ["boundary","seis_row_boundary","◆","#f97316",d=>d.bound],
              ["violation","seis_row_violation","✕","#ef4444",d=>d.viol]];
  rows.forEach(([key,lblKey,glyph,col,get],i)=>{
    const ry=Hh+16+i*rowH;
    svg.append("text").attr("x",left-12).attr("y",ry+4).attr("text-anchor","end")
      .attr("font-size",8).attr("font-family","var(--mono)").attr("fill",col).text(t(lblKey));
    anomaly.forEach(d=>{
      const n=get(d); if(!n) return;
      svg.append("text").attr("x",x(d.ri)).attr("y",ry+4).attr("text-anchor","middle")
        .attr("font-size",Math.min(8+n*0.7,13)).attr("fill",col).attr("opacity",.9)
        .style("cursor","pointer").text(glyph)
        .on("mousemove",ev=>showTip(`<div class="tt-b">${n} ${t(lblKey)} ${t("tt_events_suffix")} · ${rounds[d.ri].hour.replace("T"," ")}</div>`,ev))
        .on("mouseleave",hideTip)
        .on("click",ev=>{
          const ms=DATA.messages.filter(m=>m.round===d.ri&&(
            key==="covert"?m.channel==="side_huddle":
            key==="violation"?m.embargo_violation:
            m.is_public&&(m.flags.merger||m.flags.embargo)&&!m.embargo_violation));
          pickInspect(`${t(lblKey)} @ ${rounds[d.ri].hour}`,ms,ev);
        });
    });
  });
}

/* ===========================================================================
   🧭 KEY QUESTIONS — floating panel (bottom-right)
   Each question applies a braid focus preset and shows the written answer.
   =========================================================================== */
const QUESTIONS=[
  {
    id:"q1", tag:"events & causality",
    q:"What sequence of events and relationships led to the inappropriate release?",
    a:`The braid's numbered chain reads as one causal arc: the CEO privately seeds "strategic developments"
       (<b>1</b>, May 17) → coordination moves off the monitored huddle into the covert side-huddle
       (<b>2–3</b>, May 22–25, purple arcs) → a near-miss slip triggers the late installation of The Judge
       (<b>4</b>, May 29) → two SaltWind exposés put public pressure on the team while $TTHR slides
       (<b>5–6</b>) → on crisis day Legal starts anonymous boundary-testing at 9:49 (<b>7–8</b>, threads dive
       below the red perimeter) → the Judge's 15:08 ceiling warning (<b>9</b>) is ignored — red dashed arrow —
       → Legal personally confirms the CivicLoom merger at 17:25 (<b>10</b>), Social-Media amplifies one minute
       later (<b>11</b>), and the 18:00 embargo lifts on news already public (<b>12</b>).`,
    preset(){ HL.events=null; HL.agents=null; HL.note="full causal chain";
      STATE.layers.events=true; STATE.layers.arrows=true; STATE.layers.arcs=false; STATE.roundRange=null; },
    evidence(){ return DATA.events.flatMap(e=>e.evidence); }
  },
  {
    id:"q2", tag:"enforcement bypass",
    q:"Which decisions and system elements let the post slip past embargo enforcement (The Judge)?",
    a:`Four structural failures, all visible on the braid: <b>(1) late control</b> — the ⚖ gates only appear
       from May 30, after coordination had already gone covert; <b>(2) the silent gap</b> — the red "JUDGE SILENT"
       strip shows zero Judge output during the crisis-morning hours when boundary tests and the first violations
       occurred; <b>(3) advisory-only power</b> — the 15:08 ceiling warning (node 9) is a ruling, not a block;
       the red gates show violations following within hours; <b>(4) scope</b> — enforcement watched the official
       account, but the breach travelled through <i>personal</i> and <i>anonymous</i> channels (the two bottom
       zones), which is exactly where the threads of Legal and Social-Media end the day.`,
    preset(){ HL.events=new Set(["E04","E09","E10","E11"]);
      HL.agents=new Set(["judge_agent","legal_agent","social_media_agent","pr_intern_agent"]);
      HL.note="enforcement bypass"; STATE.layers.gates=true; STATE.layers.events=true;
      STATE.layers.arrows=true; STATE.roundRange=[DATA.meta.crisis_round0,DATA.rounds.length-1]; },
    evidence(){ return ["E04","E09","E10","E11"].flatMap(id=>DATA.events.find(e=>e.id===id).evidence); }
  },
  {
    id:"q3", tag:"typical vs. breach behavior",
    q:"What was each agent's typical behavior, and how does the breach behavior compare?",
    a:`The dotted horizontal lines are each agent's pre-crisis baseline posture — every thread hugged the top
       internal zones for two weeks (Legal: 60% monitored huddle, 37% private 1:1, <b>zero</b> public posting).
       On June 5 the braid frays: Legal's thread plunges across the red perimeter into <i>anonymous</i> and
       <i>personal</i> posting — two channels it had never used (deviation 0.31, 12 anonymous posts, 6 leak
       actions), and Social-Media leaves its official-post lane to amplify with "EXECUTING" language.
       Click <b>Legal ▸</b> or <b>Social-Media ▸</b> at the right edge: the profile card shows the
       expected-vs-observed channel mix side by side.`,
    preset(){ HL.agents=new Set(["legal_agent","social_media_agent"]); HL.events=null;
      HL.note="baseline vs. crisis"; STATE.layers.baselines=true; STATE.roundRange=null;
      showAgentProfile("legal_agent"); },
    evidence(){ return DATA.messages.filter(m=>m.agent==="legal_agent"&&m.is_public).map(m=>m.id); }
  },
  {
    id:"q4", tag:"leading indicators",
    q:"Were there leading indicators that such a release was possible?",
    a:`Yes — the seismograph trembles well before 17:25. <b>May 22</b>: the side-huddle activates (first purple
       arcs; covert share eventually reaches 12%) and a public post already brushes merger-adjacent language
       (first orange ◆ in round 4). <b>May 29</b>: the @Elena near-miss — close enough to force installing
       The Judge. <b>June 5 morning</b>: anonymous boundary-testing starts at 9:49, the composite anomaly
       crosses the +2σ alert line hours before the breach, and violations begin at 15:00 — 2.5 hours before
       the "official" breach. Every ▲ above a pre-crisis bar is an early warning that was visible at the time.`,
    preset(){ HL.events=new Set(["E02","E04","E07","E08","E09"]); HL.agents=null;
      HL.note="leading indicators"; STATE.layers.arcs=true; STATE.layers.events=true;
      STATE.roundRange=null; },
    evidence(){ return ["E02","E04","E07","E08"].flatMap(id=>DATA.events.find(e=>e.id===id).evidence); }
  },
  {
    id:"q5", tag:"prior deviations",
    q:"Were there prior occasions where agents' actual behavior differed from expected behavior?",
    a:`Three pre-crisis deviations stand out when you brush the May rounds: <b>(1) May 17</b> — the CEO seeds
       material non-public information through private DMs instead of governed channels (node 1);
       <b>(2) May 22–25</b> — Legal and Social-Media move merger coordination into the covert side-huddle
       (nodes 2–3): senior agents deliberately routing around the monitored channel, their threads' first
       drift below baseline; <b>(3) May 29</b> — the @Elena faux pas, a public slip caught just in time
       (node 4). Each was the same <i>species</i> of behavior as the final breach — information moving to
       less-governed channels — just at smaller scale.`,
    preset(){ HL.events=new Set(["E01","E02","E03","E04"]); HL.agents=null;
      HL.note="pre-crisis deviations"; STATE.layers.arcs=true;
      STATE.roundRange=[0,DATA.meta.crisis_round0-1]; },
    evidence(){ return ["E01","E02","E03","E04"].flatMap(id=>DATA.events.find(e=>e.id===id).evidence); }
  },
  {
    id:"q6", tag:"similar episodes",
    q:"Did the agent system exhibit behaviors like the breach on other occasions?",
    a:`The breach was not a discrete act but the endpoint of a <b>graded escalation that rehearsed itself</b>:
       anonymous "clarifications" at 9:49 (node 7) → naming deal context at 12:06 (node 8) → the first actual
       violations at 15:00–16:00 by Social-Media, Legal and PR-Intern (red rings before the breach line) →
       the explicit confirmation at 17:25. Each step used the same channel ladder (covert → anonymous →
       personal) and each was slightly bolder than the last. The orange ◆ diamonds mark every rehearsal;
       note they cluster on exactly the two threads that ultimately breached.`,
    preset(){ HL.events=new Set(["E07","E08","E10","E11"]); HL.agents=null;
      HL.note="escalation rehearsals"; STATE.roundRange=[DATA.meta.crisis_round0,DATA.rounds.length-1]; },
    evidence(){ return DATA.messages.filter(m=>m.is_public&&(m.flags.merger||m.flags.embargo)).map(m=>m.id); }
  },
  {
    id:"q7", tag:"why no earlier action",
    q:"Why didn't the prior occasions result in noticeable action?",
    a:`Four reasons, each visible in a layer: <b>(1) low visibility</b> — May's deviations stayed in internal
       zones above the red perimeter; nothing public meant nothing to react to; <b>(2) the one visible near-miss
       DID trigger action</b> — the @Elena slip produced The Judge (node 4), and the green ⚖ gates (May 30–Jun 4)
       show compliance holding, which built false confidence that the control worked; <b>(3) local defensibility</b>
       — on crisis day each post was individually "defensible under outside counsel's 10b-5 opinion" (the Judge's
       own words), so per-message checks passed while the <i>aggregate</i> disclosure climbed; <b>(4) no
       enforcement teeth</b> — when the Judge finally drew a hard ceiling at 15:08, it could only warn:
       the red dashed "ceiling warning ignored" arrow is the system's single point of failure.`,
    preset(){ HL.events=new Set(["E04","E09"]); HL.agents=null;
      HL.note="why no earlier action"; STATE.layers.gates=true; STATE.layers.events=true;
      STATE.layers.arrows=true; STATE.roundRange=null; },
    evidence(){ return ["E04","E09"].flatMap(id=>DATA.events.find(e=>e.id===id).evidence); }
  },
];

function buildQuestions(){
  const fab=document.getElementById("qfab");
  const qp=document.getElementById("qpanel");
  fab.onclick=()=>qp.classList.toggle("hidden");
  document.getElementById("qp-close").onclick=()=>qp.classList.add("hidden");
  document.getElementById("qp-reset").onclick=()=>{
    HL.agents=null; HL.events=null; HL.note=null; STATE.roundRange=null;
    d3.selectAll("#qp-list .qitem").classed("active",false);
    renderAll();
  };
  const list=d3.select("#qp-list").html("");
  QUESTIONS.forEach(Q=>{
    const item=list.append("div").attr("class","qitem").attr("data-q",Q.id);
    item.append("div").attr("class","q-q")
      .html(`<span class="q-tag">${qTag(Q)}</span>${qQ(Q)}`);
    const ans=item.append("div").attr("class","q-a");
    ans.html(qA(Q));
    const acts=ans.append("div").attr("class","q-actions");
    acts.append("button").attr("class","mini").text(t("q_load"))
      .on("click",ev=>{ ev.stopPropagation();
        selClear(); inspectIds(`${qTag(Q)} ${t("q_evidence_suffix")}`, Q.evidence()); renderMain(); });
    item.on("click",()=>{
      const active=item.classed("active");
      d3.selectAll("#qp-list .qitem").classed("active",false);
      if(active){ HL.agents=null; HL.events=null; HL.note=null; renderAll(); return; }
      item.classed("active",true);
      Q.preset();
      renderAll();
    });
  });
}

/* ---------------------------------------------------------------- PANEL TOGGLES --- */
(function(){
  const rail = document.getElementById("rail");
  const railBtn = document.getElementById("rail-toggle");
  railBtn.addEventListener("click", () => {
    rail.classList.toggle("collapsed");
    const c = rail.classList.contains("collapsed");
    railBtn.textContent = c ? "›" : "‹";
    railBtn.title = c ? "Expandir panel" : "Minimizar panel";
    setTimeout(() => window.dispatchEvent(new Event("resize")), 240);
  });

  const insp = document.getElementById("inspector");
  const inspBtn = document.getElementById("insp-toggle");
  inspBtn.addEventListener("click", () => {
    insp.classList.toggle("collapsed");
    const c = insp.classList.contains("collapsed");
    inspBtn.textContent = c ? "‹" : "›";
    inspBtn.title = c ? "Expandir panel" : "Minimizar panel";
    setTimeout(() => window.dispatchEvent(new Event("resize")), 240);
  });
})();

/* ---------------------------------------------------------------- THEME TOGGLE --- */
(function(){
  const btn = document.getElementById("theme-toggle");
  const html = document.documentElement;
  const setIcon = () => btn.textContent = html.dataset.theme === "dark" ? "☀" : "🌙";
  if(localStorage.getItem("af-theme") === "dark") html.dataset.theme = "dark";
  setIcon();
  btn.addEventListener("click", () => {
    html.dataset.theme = html.dataset.theme === "dark" ? "" : "dark";
    setIcon();
    localStorage.setItem("af-theme", html.dataset.theme || "light");
  });
})();

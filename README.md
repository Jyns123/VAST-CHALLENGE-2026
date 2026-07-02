# HarborCrest — Investigative Visual Analytics Platform
### VAST Challenge 2026 · Mini-Challenge 1 · TenantThread Embargo Breach

An investigation console (not a dashboard) for reconstructing how embargoed
**Project HarborCrest** merger information reached the public **FleX** platform ~35
minutes before the 6:00 PM, June 5 2046 embargo. Built with **D3.js v7**, plain HTML/CSS/JS.

---

## Quick start

```bash
# 1. (Re)generate the derived datasets from the raw JSON
python3 scripts/transform.py

# 2. Serve statically
python3 -m http.server 8000

# 3. Open
http://localhost:8000/index.html
```

> The app loads JSON via `fetch`, so it must be served over HTTP (not `file://`).
> `data/` already contains pre-built derived datasets, so step 1 is optional unless you
> change the pipeline.

---

## Project structure

```
index.html        Single-page shell (header KPIs, control rail, inspector, 🧭 questions FAB)
style.css         "Investigation console" dark theme
app.js            D3 application — ONE condensed multi-layer view + evidence inspector
scripts/
  transform.py    Data transformation, feature engineering, scoring, NLP, graph metrics
data/             Derived datasets (generated)
  messages.json   912 communications, fully feature-engineered
  rounds.json     23 environmental rounds (market, media, deadlines, activity features)
  network.json    Agent nodes (centrality/brokerage) + targeted edges
  actors.json     Per-agent behavioral profile + deviation scores
  posts.json      77 public posts with leak-likelihood + coordination
  events.json     12 curated causal events (E01–E12) with evidence links
  meta.json       Agents, channels, lexicons, hypotheses, global stats
docs/
  risk_scoring_methodology.md   How every score is computed
  nlp_methodology.md            Lexicon-based text features
```

## One view, many layers — the Behavioral Drift Braid

Instead of tabs, the entire investigation is condensed into **one composited canvas**:

| Layer | Investigative question it answers |
|---|---|
| **Drift threads** | Each agent is a thread travelling a vertical *covert→public posture ladder* (monitored huddle → 1:1 → covert side-huddle → official → personal → anonymous). Threads diving below the red **enforcement perimeter** are exposing content publicly. Thickness = volume. |
| **▼ Post triangles** | Every public post drops a triangle into the zone it was published on; red-rimmed = embargo violation. Personal/anonymous triangles appearing for the first time on June 5 *are* the anomaly. |
| **· Baseline lines** | Each agent's expected (pre-crisis) posture — the visual definition of "normal behavior" the threads deviate from. |
| **∿ Covert arcs** | Who side-huddled with whom, per round (purple). The May 22 activation is the first early warning. |
| **⚖ Judge gates** | Compliance interventions, colored by outcome (green = held, red = a violation followed) + the auto-detected **"JUDGE SILENT"** enforcement gap on crisis morning. |
| **●→ Causal chain** | The curated events E01–E12 pinned to their actor's thread, with causal arrows; the **"⊘ ceiling warning ignored"** arrow (E09→E10) is the system's single point of failure. |
| **Seismograph** | Composite anomaly score per round (flagged language + covert + boundary tests + violations) vs. pre-crisis +1σ/+2σ thresholds, with the $TTHR price and ∿/◆/✕ tick rows — leading indicators at a glance. |
| **🧭 Key Questions** | Floating button (bottom-right): the 7 challenge questions; clicking one refocuses the braid (highlight, layers, time window) and shows the written answer with linked evidence. |

**Linked interaction:** a single global filter state (actors · channels · evidence flags ·
time window via brushing the braid · search) drives every layer simultaneously. Clicking any
glyph, arc, gate, event, or hypothesis loads the underlying communications into the right-hand
**Evidence Inspector**; clicking an agent's name at the right edge of the braid opens its
behavioral profile (expected vs. observed channel mix).

---

# Explicación del diseño (ES)

> *Las secciones siguientes —decisiones de diseño, justificación analítica y cómo cada
> vista responde a las preguntas del reto— están redactadas en español, según lo
> solicitado. Todo el código, la interfaz y la documentación técnica permanecen en inglés.*

## 1. Decisiones de diseño

**Una sola visualización condensada, no pestañas.** Toda la investigación vive en un único
lienzo: la **Trenza de Deriva Conductual** (*Behavioral Drift Braid*). Cada agente es un
hilo que recorre una escalera vertical de "postura comunicativa" (arriba = canal de equipo
monitoreado; abajo = publicación anónima imposible de rastrear). Cruzar el **perímetro rojo
de aplicación del embargo** significa que el contenido se hizo público. Sobre la misma
trenza se componen capas activables: líneas base esperadas, arcos de coordinación
encubierta, compuertas del Juez (verde = contuvo / rojo = siguió una violación), la cadena
causal E01–E12 con flechas de decisión, y los triángulos de cada post público en la zona
donde se publicó. Debajo, un **sismógrafo de indicadores tempranos** muestra cuándo el
sistema "empezó a temblar" respecto a umbrales +1σ/+2σ pre-crisis.

**No es un dashboard, es una plataforma de investigación.** La pantalla está organizada
como una consola forense: una **barra de filtros global** a la izquierda, el lienzo de la
trenza al centro y un **inspector de evidencia** persistente a la derecha. La idea rectora
es que el analista nunca pierda el contexto: cualquier elemento que toque (un glifo, un
nodo, una cinta, una celda, un evento o una hipótesis) deposita las comunicaciones
subyacentes en el inspector, con las palabras clave resaltadas y el *razonamiento interno*
del agente visible. Así se pasa siempre de la abstracción visual a la prueba textual.

**Cross-filtering total con un único estado.** Existe una sola función `filtered()` que
representa la verdad: el conjunto de mensajes que pasa todos los filtros (actores, canales,
banderas de evidencia, ventana temporal y búsqueda). Todas las capas se redibujan desde
ese conjunto, de modo que filtrar por "violación de embargo" o cepillar (*brush*) la
ventana del 5 de junio atenúa simultáneamente hilos, triángulos, arcos y sismógrafo.

**El botón 🧭 Key Questions (abajo a la derecha).** Las siete preguntas del reto viven en
un panel flotante. Al pulsar una pregunta, la visualización se *reconfigura sola* para
responderla (resalta agentes/eventos, activa las capas pertinentes, ajusta la ventana
temporal) y despliega la respuesta escrita con su evidencia enlazada al inspector. La
visualización no solo permite descubrir la respuesta: la demuestra.

**Codificaciones elegidas por valor investigativo, no por costumbre.** Se evitaron los
gráficos genéricos. Cada vista existe porque responde a una pregunta concreta del caso
(ver §3). Por ejemplo, la *betweenness* se calcula **solo sobre aristas privadas/encubiertas**
porque el equipo es una "clique de difusión" (todos emiten a `ALL`) y su betweenness global
sería trivialmente cero; restringirla revela quién hace de puente real en las conversaciones
reservadas.

**Escala temporal por rondas, no por tiempo lineal.** Los datos están muestreados de forma
irregular (diario antes de la crisis, horario el día de la crisis). Un eje de tiempo lineal
aplastaría las 9 horas críticas frente a las dos semanas previas. Por eso el Storyline usa
una escala ordinal por ronda: cada columna pesa igual y el día del incidente recibe el
espacio que merece.

**Estética de consola oscura.** El tema oscuro con acentos ámbar/rojo para el riesgo no es
cosmético: dirige la atención del ojo hacia las violaciones (anillos rojos, marcas ✕) y
hacia el canal encubierto (púrpura) entre cientos de comunicaciones rutinarias.

## 2. Justificación analítica

**Transformación de datos como núcleo.** El reto exige features derivadas; aquí son el
motor de la investigación, no un adorno. `scripts/transform.py` genera: features temporales
(*time-to-embargo*, antes/después, aceleración de actividad), features de red
(in/out-degree, betweenness de Brandes, **brokerage** encubierto→público), features de
publicación (*leak-likelihood*, *coordination*, sensibilidad), features de NLP por léxicos
(merger / embargo / execution / compliance / governance) y features de comportamiento
(desviación L1 respecto a la línea base, canales nuevos). La metodología completa está en
`docs/risk_scoring_methodology.md` y `docs/nlp_methodology.md`.

**Por qué léxicos y no *embeddings*.** En un contexto legal la explicabilidad supera a la
sofisticación: cada bandera es auditable ("se marcó porque contiene literalmente
*CivicLoom*"). El hallazgo metodológico propio del caso es el léxico de **governance**: la
fuga no se produjo con afirmaciones directas del *merger*, sino mediante un goteo de
"aclaraciones de gobernanza" *defendibles* (auditoría, consentimiento, control de acceso)
que revelaron el acuerdo de forma incremental. Seguir ese lenguaje junto al de *merger*
expone el gradiente: cada post era "defendible" en local mientras el agregado violaba el
embargo.

**Las puntuaciones son ayudas, no veredictos.** El medidor de hipótesis de la cabecera solo
muestra el *balance de evidencia* (puntos a favor / total), nunca una conclusión de la
máquina. La decisión la toma el analista, leyendo la prueba que cada hipótesis enlaza.

**Qué dice la evidencia.** Convergen varias señales: (1) el `legal_agent` y el
`social_media_agent` dominan el canal encubierto `side_huddle` y son exactamente los dos que
ejecutan la violación (E10/E11); (2) el `legal_agent` adopta **dos canales públicos nuevos**
(anónimo y personal) el día de la crisis —desviación conductual concreta—; (3) la fuga se
construye como escalada de *boundary-testing* (E07→E08), no como un accidente difuso; (4) la
única advertencia formal de "The Judge" (E09, 15:08) se emite y se ignora. La lectura más
sostenible es **C (comportamiento emergente con núcleo deliberado)**: una fuga que emerge de
la interacción entre agentes, canales y un cumplimiento que validaba cada pieza por separado,
rematada por un acto final deliberado de confirmación. La plataforma, no obstante, deja al
analista contrastar A, B y C con la prueba en mano.

## 3. Cómo la visualización responde a las preguntas del reto

Cada tarea del reto tiene su pregunta en el panel 🧭 (que reconfigura la trenza al pulsarla);
aquí el mapeo capa → tarea:

- **Tarea 1 — Reconstrucción de eventos y relaciones.** La cadena causal E01–E12 está
  *anclada sobre los hilos de sus actores* con flechas de decisión entre eventos; los arcos
  púrpura muestran las relaciones encubiertas que vehicularon la coordinación. El conducto
  que sorteó el embargo se lee directamente en la geometría: `side-huddle → Legal/Social-Media
  → triángulos personal/anónimo bajo el perímetro`.

- **Tarea 2 — Análisis de comportamiento.** Las líneas punteadas de línea base definen el
  comportamiento esperado de cada hilo; la deriva del 5 de junio se ve como divergencia
  física respecto a esa línea. El perfil por agente (clic en su nombre) contrasta la mezcla
  de canales esperada vs. observada.

- **Tarea 3 — Indicadores tempranos.** El sismógrafo marca con ▲ las rondas pre-crisis que
  superan +1σ (22 y 29 de mayo — exactamente la activación del canal sombra y el *faux pas*
  de @Elena), y muestra el cruce del umbral +2σ horas antes de la brecha; los rombos ◆
  naranjas señalan cada *boundary test* público.

- **Tarea 4 — Comportamiento esperado vs. real.** Triángulos en zonas que un agente nunca
  había usado (anónimo/personal de Legal) + la distancia hilo↔línea base + el score de
  desviación del perfil responden cuándo, quién y qué.

- **Tarea 5 — Comportamientos históricos similares.** Con la ventana temporal en mayo se ven
  los ensayos a menor escala de la misma conducta: coordinación fuera del canal monitoreado
  (E02–E03), un post público rozando lenguaje del merger el 22 de mayo, y el casi-incidente
  del 29 de mayo.

- **Tarea 6 — Falta de intervención previa.** Las compuertas ⚖ verdes (30 mayo–4 junio)
  muestran al Juez conteniendo con éxito antes de la crisis (confianza falsa en el control);
  la franja roja **JUDGE SILENT** expone el hueco de supervisión de la mañana crítica; y la
  flecha roja "⊘ ceiling warning ignored" (E09→E10) muestra que el único poder del Juez era
  consultivo.

- **Objetivo (fuga deliberada vs. fallo sistémico).** El medidor de hipótesis A/B/C, los
  filtros de evidencia y el inspector permiten construir y contrastar la conclusión sobre
  prueba textual en lugar de aceptar una respuesta predefinida.

---

## Notes

- All scores are reproducible from `scripts/transform.py`; see `docs/` for the full
  methodology.
- Braid posture = per-round channel average with public messages weighted ×3 (external
  exposure should move the thread visibly); the composite anomaly formula is printed in
  the seismograph header and is fully auditable.
# VAST-CHALLENGE-2026

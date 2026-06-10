# 🔭 Causal Breach Observatory

**TenantThread — VAST Challenge 2026, Mini Challenge 1**  
Sistema de visualización interactiva para analizar la filtración de información embargada del 5 de junio de 2046.

---

## 📋 Descripción

El **Causal Breach Observatory** es un sistema analítico de visualización en D3.js v7 compuesto por cinco vistas coordinadas ("linked views") y un panel narrativo con scoring de hipótesis. Permite reconstruir cómo se originó y propagó la filtración de información embargada sobre la fusión TTHR-Verdant a las 17:00 del 5 de junio de 2046 en la plataforma TenantThread.

El diseño sigue los principios de rigor analítico del paper *Melody Way* (VAST 2025): toda codificación visual mapea a un atributo real del dataset (`MC1_final_00.json`), sin métricas fabricadas.

El sistema está diseñado para dos audiencias:
1. **Equipo legal**: evidencia clara, exportable, con cadenas causales trazables.
2. **Analistas**: exploración de hipótesis rivales (H1: fallo del Judge, H2: coordinación deliberada, H3: presión sistémica).

---

## 🚀 Cómo ejecutar

1. **Navega al directorio del proyecto:**
   ```bash
   cd viz
   ```

2. **Inicia un servidor HTTP local** (necesario para cargar módulos ES6 y archivos JSON):
   ```bash
   # Python 3
   python -m http.server 8000

   # O con Node.js
   npx http-server -p 8000

   # O con PHP
   php -S localhost:8000
   ```

3. **Abre en el navegador:**
   ```
   http://localhost:8000
   ```

### Despliegue en GitHub Pages

El repositorio incluye un workflow en `.github/workflows/deploy.yml` para publicar el sitio estático en GitHub Pages sin proceso de build.

1. Sube este proyecto a un repositorio de GitHub con rama `main`.
2. En GitHub, ve a **Settings > Pages**.
3. En **Source**, selecciona **GitHub Actions**.
4. Haz push a `main` o ejecuta manualmente el workflow **Deploy static site to GitHub Pages**.

La publicación servirá el contenido tal como está, incluyendo `index.html`, `css/`, `src/` y `MC1_final_00.json`.

---

## 📁 Estructura del proyecto

```
viz/
├── index.html              # Página principal con layout de 3 columnas
├── README.md               # Este archivo
├── MC1_final_00.json       # Dataset oficial del Mini Challenge 1
├── MC1_EDA_VAST2026.ipynb  # Notebook EDA exploratorio
├── css/
│   └── styles.css          # Estilos globales (tema oscuro, layout, componentes)
├── data/                   # Archivos derivados del EDA (referencia)
│   ├── agents.json
│   ├── channels.json
│   ├── events.json
│   └── messages.json
└── src/
    ├── main.js             # Orquestador: carga datos e inicializa vistas
    ├── dataLoader.js       # Carga y transforma MC1_final_00.json
    ├── state.js            # Estado global + D3 dispatch para coordinación
    ├── filters.js          # Panel de filtros (izquierda)
    ├── narrative.js        # Panel narrativo + Causal Lens (Simplex, Fingerprint, Hipótesis)
    ├── v1-galaxy.js        # V1: Agent Causal Galaxy (radial)
    ├── v2-timeline.js      # V2: Causal Timeline (multi-día)
    ├── v3-egochain.js      # V3: Information Flow & Channel Migration
    ├── v4-judgemap.js       # V4: Multidimensional Oversight Matrix
    └── v5-pressure.js      # V5: Systemic Pressure Replay + Stock Price
```

---

## 🎯 Las cinco vistas

### V1: Agent Causal Galaxy
**Qué hace:** ubica a cada agente según su activación temprana y su peso en la crisis.

- **Ángulo** → ronda del primer evento crítico del agente.
- **Anillo radial** → capa organizacional/rol (Compliance, Platform Trust, Legal, Senior Comms, Junior).
- **Tamaño del nodo** → volumen total de mensajes.
- **Color** → rol del agente.
- **Halo rojo** → agente con alta implicación causal en el breach.

**Pregunta analítica:** ¿Quiénes se activaron primero y quién acumuló mayor centralidad de riesgo?

### V2: Causal Timeline
**Qué hace:** reconstruye la secuencia causal completa de mayo-junio con severidad y eventos clave.

- **Eje X** → fecha y hora (rango multi-día real del dataset).
- **Eje Y** → severidad del evento.
- **Estrellas** → eventos críticos por ronda.
- **Conexiones** → tipo de vínculo causal/temático (incluye marcadores del Judge y del breach).
- **Brush temporal** → filtra todas las vistas por ventana de tiempo.

**Pregunta analítica:** ¿Qué secuencia concreta llevó al quiebre del embargo a las 17:00?

### V3: Information Flow & Channel Migration
**Qué hace:** visualiza cómo la información fluye entre canales de comunicación a lo largo de las rondas, revelando migraciones de contenido sensible desde canales privados hacia públicos.

- **Eje X** → número de ronda (1–23).
- **Eje Y** → canal, ordenado por nivel de privacidad (interno → privado → público).
- **Tamaño de burbuja** → cantidad de mensajes en esa celda (canal × ronda).
- **Color de burbuja** → sensibilidad promedio (escala `YlOrRd`: amarillo = baja, rojo = alta).
- **Arcos curvos** → enlaces `responding_to` que cruzan canales (información que migra entre niveles de privacidad).
- **Color de arco** → rojo si el contenido sensible cruza a un canal más público; gris si es flujo normal.
- **Borde dorado** → la celda contiene menciones a la fusión (merger keywords).
- **Bandas de fondo** → verde (internal), ámbar (private), rojo (public) para señalar zonas de riesgo.

**Pregunta analítica:** ¿Cómo migró la información embargada desde canales internos/privados hacia canales públicos, y en qué rondas ocurrieron los saltos críticos?

### V4: Multidimensional Oversight Matrix
**Qué hace:** cruza canales y fases para evidenciar brechas de supervisión con codificación multivariable.

- **Matriz** → canal (Y) × fase (X: Pre, Judge, Crisis, Post).
- **Color de celda** → cobertura del Judge vs presión de blind spots.
- **Tamaño de celda** → volumen de mensajes.
- **Punto central** → tasa de mensajes sensibles.
- **Borde punteado** → densidad de menciones de merger.
- **Tooltip** → métricas completas (coverage, blind spots, sensible rate, merger rate, top agent).

**Pregunta analítica:** ¿En qué combinación canal-fase se concentró el riesgo fuera de la cobertura del Judge?

### V5: Systemic Pressure Replay
**Qué hace:** descompone y anima la presión acumulada por ronda, con superposición del precio real de la acción TTHR.

- **Área apilada** → componentes del pressure score derivados de datos reales.
- **Componentes** → External Pressure (conteo mensajes urgentes), Channel Risk (riesgo promedio del canal), Semantic Risk (menciones merger + sensibilidad alta), Judge Gap (mensajes sensibles sin supervisión), Coordination (chats privados con merger), Embargo Proximity (cercanía temporal al breach).
- **Línea azul punteada** → precio real de la acción $TTHR extraído de `market_snapshot.stock_price` ($38.70 → ~$18), con eje Y secundario en dólares.
- **Controles Play/Pause/Reset** → replay temporal del deterioro del sistema.
- **Línea vertical roja** → marca la ronda del breach (R22).

**Pregunta analítica:** ¿Predomina una falla sistémica progresiva o un salto deliberado puntual? ¿Cómo correlaciona la presión interna con el desplome bursátil?

### Panel narrativo (complemento analítico)
Además de las 5 visualizaciones, el panel derecho integra un **MC1 Causal Lens** que resume evidencia multidimensional:

- **Scenario Simplex (H1/H2/H3)** → posiciona el caso en un triángulo de hipótesis rivales.
- **Phase Fingerprint** → intensidad de riesgo por fase (Pre/Judge/Crisis/Post).
- **Scoreboard de hipótesis** → puntajes dinámicos según filtros activos.

---

## 🔗 Interactividad y vinculación

| Acción | Efecto |
|--------|--------|
| Click en agente (Galaxy) | Resalta en Judge Map, muestra detalles en panel narrativo |
| Click en evento (Timeline) | Muestra evento en panel narrativo con mensajes relacionados |
| Click en burbuja (V3) | Muestra mensajes del canal-ronda seleccionado |
| Brush temporal (Timeline) | Filtra todas las vistas por rango de tiempo |
| Filtros (izquierda) | Actualizan Galaxy, Timeline, Judge Map, Ego-chain |
| Slider de presión (V5) | Muestra estado del sistema en cada ronda |
| Play (V5) | Anima la evolución temporal de presión |

---

## 🔍 Filtros disponibles

- **Búsqueda textual**: busca en nombre de agente, contenido de mensaje, canal, tipo
- **Agentes**: selección individual
- **Roles**: legal, platform_trust, pr, social_media, pr_intern, intern, judge
- **Canales**: comms_huddle, one_on_one_chat, side_huddle, official_post, personal_post, anonymous_post
- **Fase**: pre-crisis (R1-R8), supervisión Judge (R9-R13), crisis (R14-R22), post-breach (R23)
- **Tipo de mensaje**: broadcast, public_post, one_on_one_chat, side_huddle, action
- **Semántico**: solo sensibles (≥4), solo menciones al merger
- **Criticidad mínima**: slider 1–5

---

## 🎨 Decisiones de diseño visual

### Por qué estas codificaciones:
- **Posición para tiempo**: es el canal visual más efectivo para datos ordinales/cuantitativos (Cleveland & McGill, 1984)
- **Color para categorías**: distingue roles/tipos de agente de forma instantánea
- **Tamaño para volumen**: escala cuadrática (`scaleSqrt`) asegura percepción proporcional del área
- **Halo/anillo para riesgo**: señal redundante de alta saliencia que no interfiere con otros canales
- **Tema oscuro**: reduce fatiga visual en sesiones analíticas prolongadas
- **Escalas perceptualmente uniformes**: usamos `d3.scaleSequential` para asegurar que diferencias iguales en datos se perciban como diferencias iguales en color

### Accesibilidad:
- Tooltips con texto legible y alto contraste
- Colores primarios diferenciados (verde/rojo/amarillo/azul/púrpura) — distinguibles incluso con deuteranomalía
- Controles de filtro con etiquetas claras
- Exportación en texto plano para lectores de pantalla

---

## 📊 Fuente de datos oficial

La visualización usa exclusivamente el archivo oficial del reto:

- `MC1_final_00.json`

El loader en `src/dataLoader.js` está en modo estricto:

- Carga `MC1_final_00.json` desde la raíz del proyecto.
- Si el archivo no existe o no tiene la estructura esperada (`rounds`), la app falla con error.
- No hay fallback a datasets alternativos o mock.

El archivo oficial se transforma en runtime al esquema que consumen las vistas (`agents`, `channels`, `events`, `messages`).

---

## ⚖️ Alineación con hipótesis del caso

| Hipótesis | Vistas que la abordan |
|-----------|----------------------|
| **Fallo del oversight del Judge** | V4 (blind spots por canal-fase), V3 (flujo sin intervención del Judge) |
| **Coordinación deliberada** | V3 (arcos cross-channel entre canales privados), V1 (proximidad temporal de activación) |
| **Presión sistémica** | V5 (curva de presión + stock price), V2 (eventos de presión en Timeline) |
| **Cadena causal del breach** | V3 (migración canal privado → público), V2 (secuencia de eventos) |
| **Señales tempranas** | V1 (primer evento de cada agente), V2 (eventos de severidad alta tempranos) |

---

## 🛠️ Tecnologías

- **D3.js v7** (cargado desde CDN)
- **ES6 Modules** (import/export nativos del navegador)
- **CSS Grid / Flexbox** para layout responsivo
- **Google Fonts**: Inter (400,600,700,800) + JetBrains Mono (400,700)
- Sin frameworks adicionales (no React, no Vue, no Angular)

---

## 📊 Datos del dataset

El sistema usa exclusivamente `MC1_final_00.json` (dataset oficial MC1 VAST 2026):

- **23 rondas** de simulación (R1–R23)
- **912 mensajes** entre 7 agentes en 6 canales
- **Período**: 17 mayo – 5 junio 2046
- **Fases**: Pre-crisis (R1–R8), Supervisión Judge (R9–R13), Crisis (R14–R22), Post-breach (R23)

Campos reales utilizados por las visualizaciones:
- `agent_id`, `agent_role`, `agent_label` — identidad y rol del agente
- `channel` — canal de comunicación (comms_huddle, one_on_one_chat, official_post, side_huddle, personal_post, anonymous_post)
- `message_type` — broadcast, one_on_one_chat, public_post, side_huddle, action
- `responding_to` — enlaces de respuesta entre mensajes (749/912 tienen este campo)
- `internal_state` — {reacting, rationalizing, deliberating} del agente
- `content` — texto completo del mensaje
- `market_snapshot` — stock_price ($38.70 → ~$18), percent_change, sentiment (neutral → CRITICAL → RECOVERING)
- `environment_context` — event_narrative, media_events, critical_deadlines

---

## 📝 Licencia

Proyecto académico para el VAST Challenge 2026.

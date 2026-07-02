# Guion de presentación — HarborCrest (VAST 2026, Mini-Challenge 1)

Dos presentadores con bloques **seguidos** (un solo relevo, en la diapositiva 9 → 10):
- **Jyns:** diapositivas **1 a 9** (la parte más sencilla: caso, metáfora, lectura de la trenza, interacción y Key Questions).
- **Cesar:** diapositivas **10 a 17** (la parte técnica: layout/perfil, alineación, datos, features, justificación, demo y conclusión).

Duración objetivo: 10 a 12 minutos. Las líneas son para decir en voz alta, no para leer textual; adáptenlas a su estilo.

---

# BLOQUE DE JYNS (diapositivas 1 a 9)

## Diapositiva 1 — Portada (JYNS) · ~30s
"Buenas a todos. Somos el equipo P8: yo soy Jyns y me acompaña Cesar.
Vamos a presentar **HarborCrest**, nuestra plataforma de analítica visual para reconstruir la brecha de embargo de TenantThread.
La pregunta que perseguimos toda la presentación es simple: esa fuga, ¿fue **deliberada** o un **fallo de los sistemas automáticos** de comunicación y cumplimiento?
Todo lo resolvimos en una sola visualización interactiva hecha en D3.js, que llamamos la **Trenza de Deriva Conductual**. Empiezo contando el caso."

## Diapositiva 2 — El caso (JYNS) · ~60s
"TenantThread vende software de gestión de propiedades. Su producto polémico, el *Retention Optimizer*, puntúa a los inquilinos por su pago, su mantenimiento y hasta el tono de sus mensajes.
En plena ola mediática con el hashtag #AlgorithmicEviction, la empresa firma **en secreto** una fusión con CivicLoom, el Project HarborCrest, bajo embargo estricto hasta las 6 de la tarde del 5 de junio de 2046.
Para hacer cumplir ese embargo había un agente automático de cumplimiento, *The Judge*. Aun así, a eso de las **5:25 PM** la información de la fusión apareció en la red social FleX desde cuentas automáticas de la empresa: **35 minutos antes** de lo permitido.
El encargado legal de CivicLoom necesita reconstruir las dos semanas previas y decidir si hubo **intención** o un **fallo sistémico**.
Trabajamos con 7 agentes de IA y 6 canales. Y algo clave: **nuestra plataforma no da un veredicto**, le da al analista la evidencia para que él lo construya."

## Diapositiva 3 — Las 7 preguntas analíticas (JYNS) · ~40s
"El reto plantea **7 preguntas** y cada una la mapeamos a una capa concreta de la visualización.
Van en pares: eventos y causalidad, y cómo se evadió el control; conducta típica frente a la brecha, e indicadores tempranos; desviaciones previas y episodios similares; y por qué no hubo intervención antes.
Lo interesante es que esas preguntas no se quedan en el papel: el botón **Key Questions** las hace accionables. Al pulsar una, la trenza **se reconfigura sola** para responderla. Ahora les muestro la idea central del diseño."

## Diapositiva 4 — Decisión de diseño central (JYNS) · ~60s
"La metáfora es la **Trenza de Deriva Conductual**. Cada agente es un **hilo** que recorre una escalera vertical de *postura comunicativa*:
**arriba**, el canal de equipo monitoreado; **abajo**, la publicación anónima e irrastreable.
Cruzar la **línea roja** del embargo significa que el contenido se hizo público. Así la deriva de conducta se ve literalmente: los hilos que se hunden están exponiendo información.
Cómo leerla en 5 segundos: hilos planos y arriba es **rutina**; hilos que se desploman bajo la línea roja al final es **la brecha**. Y se ve clarito que **Legal** y **Social-Media** son los dos que cruzan el perímetro el 5 de junio.
¿Por qué todo en una sola vista y no en pestañas? Porque saltar entre pestañas te obliga a rearmar el contexto en la cabeza. Aquí causalidad, coordinación, control y anomalía conviven en el mismo lienzo."

## Diapositiva 5 — Cómo se lee la trenza: las codificaciones (JYNS) · ~60s
"Cada elemento visual significa algo, y los ordenamos por **importancia**.
Lo más fácil de leer es la **altura del hilo**: te dice qué tan público es un mensaje, de canal monitoreado arriba a post anónimo abajo.
Después: el **color** identifica al agente; el **grosor** es cuántos mensajes mandó esa ronda; un **anillo rojo** marca una violación del embargo; y un **rombo ámbar** es un *boundary test*, un post que roza el embargo sin cruzarlo.
Sobre los hilos aparecen **triángulos**: cada post público cae en la zona donde se publicó. Que a Legal le salgan triángulos personales o anónimos **por primera vez** es justo la anomalía que buscamos.
La **línea punteada** es lo normal de cada agente, su base; y los **arcos morados** muestran quién coordinó con quién por debajo de la mesa, en el side-huddle."

## Diapositiva 6 — Capas que se superponen (JYNS) · ~70s
"Estas capas se **prenden y apagan** sobre la misma línea de tiempo, así que el analista arma la vista que necesita.
Están las **líneas base** (lo esperado), los **arcos encubiertos** (cuya primera activación, el 22 de mayo, ya es una señal), las **compuertas del Judge** (verde si contuvo, rojo si después hubo violación) y la **cadena de eventos E01 a E12**.
Y aquí está el hallazgo que **solo aparece al superponerlas**: la franja roja **JUDGE SILENT** muestra que The Judge **no dijo nada** durante la mañana del 5 de junio, justo cuando pasaban los primeros boundary tests y las primeras violaciones, dos horas y media antes de la brecha oficial de las 17:25.
Y cuando por fin puso un límite, a las 15:08, la flecha roja *ceiling warning ignored* muestra que **lo ignoraron**: el Judge solo podía advertir, no bloquear."

## Diapositiva 7 — El sismógrafo: indicadores tempranos (JYNS) · ~55s
"Debajo de la trenza pusimos un **sismógrafo** que responde: ¿cuándo empezó a temblar el sistema?
Cada barra es un puntaje de **anomalía por ronda** que combina lenguaje sensible, mensajes encubiertos, boundary tests y violaciones, dándole más peso a lo más grave; las líneas punteadas son los umbrales de alerta, y la línea azul es el precio de la acción.
Lo importante: las señales **eran visibles a tiempo**. El 22 de mayo se enciende el canal sombra; el 29 el casi-incidente de @Elena obliga a instalar a The Judge; y la mañana del 5 de junio la anomalía dispara la alerta **horas antes** de la brecha.
Abajo, tres filas alinean en el tiempo la coordinación encubierta, los boundary tests y las violaciones."

## Diapositiva 8 — Diseño de interacción (JYNS) · ~55s
"Toda la exploración corre sobre **un único estado**.
Hay un **cross-filter total**: actores, canales, banderas de evidencia, tiempo y búsqueda; cualquier cambio **redibuja todas las capas a la vez**.
Tienes un **brush temporal**: cepillas la trenza para enfocar un rango y el sismógrafo se actualiza en vivo.
El **inspector vinculado**: haces clic en cualquier glifo, arco, compuerta o evento y carga los mensajes de fondo, con palabras clave resaltadas y el razonamiento interno del agente.
Y además puedes ver el **perfil de un agente**, prender o apagar capas, y usar el botón de **Key Questions**, que les muestro ahora."

## Diapositiva 9 — Interacción estrella: Key Questions (JYNS) · ~55s
"Esta es nuestra interacción estrella. Abajo a la derecha, un **botón flotante** despliega las 7 preguntas del reto.
Al pulsar una, la visualización **se reconfigura sola**: resalta los agentes y eventos relevantes y atenúa el resto, prende las capas que tocan, ajusta la ventana de tiempo, y muestra la **respuesta escrita** con un botón *load evidence* que vuelca los mensajes probatorios al inspector.
La idea es narrativa: la visualización no solo te deja **descubrir** la respuesta, te la **demuestra**, encadenando afirmación, vista y evidencia textual.
Y el enlace es compartible: por ejemplo *?q=q2* abre directo la trenza enfocada en la evasión del control.
Con esto les dejo la parte técnica. Te paso, Cesar."

---

# BLOQUE DE CESAR (diapositivas 10 a 17)

## Diapositiva 10 — Layout y perfil esperado vs. observado (CESAR) · ~60s
"Gracias, Jyns. El layout es de **consola forense**: filtros a la izquierda, la trenza al centro, y el inspector de evidencia a la derecha. Los paneles laterales se **colapsan** para darle todo el ancho a la trenza, así nunca pierdes el contexto.
El tiempo va por **rondas**, no lineal: como los datos son diarios antes de la crisis y horarios durante, un eje lineal aplastaría las horas críticas; con rondas, cada columna pesa igual.
Y el **perfil de agente**: si hago clic en *Legal* salen dos barras, su mezcla de canales **antes** y **durante** el 5 de junio.
El hallazgo salta a la vista: Legal abre **dos canales públicos que nunca había usado**, anónimo y personal. Ese segmento que aparece solo en la barra de abajo **es** la anomalía conductual."

## Diapositiva 11 — Alineación diseño ↔ tareas (CESAR) · ~55s
"Para no dejarlo al azar, mapeamos **cada tarea del reto a la capa que la responde**.
Eventos y relaciones: la cadena causal E01 a E12 más las flechas y los arcos encubiertos.
Comportamiento esperado vs. real: líneas base contra hilos, más la tarjeta de perfil.
Indicadores tempranos: el sismógrafo con sus umbrales.
Desviaciones previas: el brush en mayo, que muestra la coordinación fuera del canal monitoreado y el casi-incidente del 29.
Episodios similares: la misma escalera de canales reutilizada en cada ensayo a menor escala.
Y la falta de intervención: las compuertas verdes que generaron confianza falsa, la franja JUDGE SILENT y la flecha *ceiling warning ignored*. Cada pregunta tiene una respuesta visual concreta."

## Diapositiva 12 — Transformación de datos (CESAR) · ~55s
"La transformación es el **motor** de la investigación, no un adorno. El script `transform.py` lee el JSON crudo, aplana las rondas anidadas y genera *features* **auditables** que cada capa de la trenza consume.
Entra `MC1_final.json`, 23 rondas con comunicaciones anidadas; sale en **7 datasets derivados** que D3 consume en vivo, recorridos por un único `filtered()`.
Esos 7 son: `messages` con 912 comunicaciones más features de tiempo y NLP; `rounds` con mercado, medios y deadlines; `network` con nodos y aristas por canal; `actors` con el perfil y la desviación por agente; `posts` con 77 publicaciones y su *leak-likelihood*; `events` con la cadena causal enlazada a su evidencia; y `meta` con agentes, canales, léxicos, hipótesis y stats."

## Diapositiva 13 — Ingeniería de características (CESAR) · ~70s
"Las features se agrupan en **cuatro familias**.
**Temporales:** horas hasta el embargo, la aceleración de actividad ronda a ronda, y el índice por ronda, diario antes y horario el 5 de junio.
**NLP por léxicos**, y es clave que sea transparente: 5 léxicos regex, *merger, embargo, execution, compliance* y *governance*; cada coincidencia es auditable. De ahí sale una *sensitivity* ponderada, y la regla `embargo_violation`: post público, con lenguaje de fusión, antes de las 6 PM.
**Red de comunicación:** in y out-degree, *betweenness* de Brandes solo sobre aristas dirigidas, no broadcast, y un *brokerage* de mensajes encubiertos.
**Comportamiento:** la mezcla de canales base vs. crisis, la desviación como distancia L1 entre ambas, y canales nuevos y leak actions por agente.
¿Por qué léxicos y no embeddings? Porque en contexto **legal la explicabilidad gana**: cada bandera se justifica con el término literal que la disparó, y todo es reproducible desde `transform.py`."

## Diapositiva 14 — Prototipo funcional y justificación (CESAR) · ~60s
"El prototipo es **funcional**, de media a alta fidelidad: D3.js v7 con HTML, CSS y JS planos, sin frameworks, SVG renderizado en vivo desde los datos. El pipeline en `transform.py` es **reproducible**, y tenemos tema claro y oscuro, paneles colapsables y deep-links.
En la cabecera hay **métricas vivas**: 912 mensajes, 77 posts públicos, 16 violaciones, 12% de tráfico encubierto, recalculadas según el filtro activo.
Tres justificaciones de diseño: primero, **léxicos sobre embeddings** por explicabilidad. Segundo, el **léxico de governance** es nuestro hallazgo propio: la fuga no llegó con afirmaciones directas, sino con un goteo de *aclaraciones de gobernanza* defendibles que revelaron el acuerdo de forma incremental. Tercero, las **puntuaciones son ayudas, no veredictos**: el medidor de hipótesis solo muestra el balance de evidencia, decide el analista. Y con esto pasamos a la demo en vivo."

## Diapositiva 15 — Demo en vivo (CESAR) · ~90s
"Vamos al producto en vivo." (Abrir la app servida en `http://127.0.0.1:8780/`.)
Checklist de demo, en este orden:
1. "Esta es la trenza completa con todas las capas." Señalar los hilos arriba en rutina y los que se hunden al final.
2. "Cambio el idioma con este botón." Tocar **EN/ES** para mostrar que toda la interfaz y la narrativa se traducen.
3. "Filtro por tiempo cepillando mayo." Hacer un **brush** corto y mostrar que el sismógrafo se actualiza.
4. "Busco un término." Escribir `merger`, mostrar el **contador de coincidencias** y el botón *cargar todo* al inspector.
5. "Selecciono varios nodos a la vez." **Shift+clic** en dos o tres nodos y mostrar que el inspector junta los mensajes de todos.
6. "Y la interacción estrella." Abrir **Key Questions**, pulsar la pregunta 2 (evasión del control) y mostrar cómo la trenza se reconfigura y aparece la evidencia.
"El repo está en GitHub." (Mostrar el enlace de la diapositiva.)

## Diapositiva 16 — Conclusión de la investigación (CESAR) · ~70s
"¿Qué sostiene la evidencia, leída sobre la trenza?
**Convergencia de actores:** `legal_agent` y `social_media_agent` dominan el canal encubierto y son **exactamente** los dos que ejecutan la violación, en E10 y E11.
**Desviación conductual concreta:** Legal adopta dos canales públicos nuevos, anónimo y personal, el día de la crisis.
**Escalada, no accidente:** la fuga se construye como un boundary-testing graduado, de E07 a E08, cada paso más audaz que el anterior.
**Control sin dientes:** la única advertencia formal del Judge, E09 a las 15:08, se emite y se ignora.
La lectura más sostenible es la **hipótesis C: comportamiento emergente con un núcleo deliberado**. Una fuga que emerge de la interacción entre agentes, canales y un cumplimiento que validaba cada pieza por separado, rematada por un acto final deliberado de confirmación.
Y lo más importante: la plataforma **no impone** esta conclusión. Permite contrastar A, B y C con la prueba textual en la mano. Gracias."

## Diapositiva 17 — Cierre / preguntas (AMBOS)
Imagen de cierre de fondo. "Quedamos atentos a sus preguntas."

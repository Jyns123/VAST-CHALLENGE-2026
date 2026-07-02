# Metodología de Puntuación de Riesgo

Todas las puntuaciones se calculan en `scripts/transform.py` y se emiten como conjuntos de datos
derivados. Son **transparentes y reproducibles** — cada puntuación es una combinación aritmética
documentada de características observables de los mensajes, nunca una caja negra. Las
puntuaciones son *ayudas* de decisión para el analista, no veredictos.

---

## 1. Puntuación de Sensibilidad del Mensaje

Escalar por mensaje que mide cuánto material embargado/sensible contiene una comunicación
individual. Se calcula a partir de los conteos de coincidencias léxicas sobre el **contenido público**:

```
sensibilidad =  3.0 · |términos de fusión|
              + 2.0 · |términos de embargo|
              + 1.5 · |términos de gobernanza|
              + 1.0 · |términos de ejecución|
```

Justificación de los pesos:
- **Lenguaje de fusión (×3)** es el sujeto embargado en sí — la señal más alta.
- **Lenguaje de embargo (×2)** indica conciencia de la restricción (contexto de intención).
- **Lenguaje de gobernanza (×1.5)** es el vocabulario de "historia de cobertura" usado para
  divulgar de forma oblicua (auditoría / consentimiento / controles de acceso), por lo que
  está moderadamente elevado.
- **Lenguaje de ejecución (×1)** ("EXECUTING", "posting now") marca el acto de publicar.

Se usa como intensidad de celda en el mapa de calor de riesgo de **Comportamiento y Anomalía**
(sumado por agente × ronda, más un incremento de +4 por cualquier violación del embargo en
esa celda).

---

## 2. Indicador de Violación del Embargo (binario)

Una comunicación se marca como **violación del embargo** cuando se cumplen *las tres* condiciones:

```
violacion_embargo =  es_canal_publico
                  AND contiene_lenguaje_de_fusion
                  AND marca_temporal < 2046-06-05 18:00  (levantamiento del embargo)
```

Esta es la definición más estricta y defendible: una publicación *públicamente visible* que
*nombra el sujeto embargado* *antes* del levantamiento del embargo. 16 mensajes califican. El
primero atribuible es la publicación personal de `legal_agent` a las 17:25 (evento **E10**).

---

## 3. Puntuación de Probabilidad de Fuga (publicaciones públicas, 0–1)

Cada publicación pública recibe una puntuación sobre cuán fuertemente funciona como una fuga:

```
probabilidad_fuga =  0.45 · [lenguaje de fusión presente]
                   + 0.20 · [publicado antes del embargo]
                   + 0.15 · [lenguaje de ejecución presente]
                   + 0.10 · [canal anónimo]
                   + 0.10 · min(coordinación, 10)/10        (limitado, normalizado)
restringido a [0, 1]
```

- **Fusión (0.45)** domina — sin ella, una publicación no puede filtrar el hecho embargado.
- **Antes del embargo (0.20)** convierte la divulgación en *violación*.
- **Ejecución (0.15)** distingue "hacerlo" de "discutirlo".
- **Anónimo (0.10)** premia los canales negables (comportamiento de prueba de límites).
- **Coordinación (0.10)** vincula la publicación con actividad previa encubierta en side-huddle.

Las publicaciones con mayor puntuación son exactamente el clúster de la brecha
(Legal/Social-Media, 17:25–17:54).

---

## 4. Puntuación de Coordinación (publicaciones públicas)

Cuenta los mensajes en `side_huddle` (encubiertos) en los **90 minutos anteriores** a una
publicación pública. Un valor alto significa que el acto público fue preparado por actividad
encubierta en canales secundarios — la firma de una publicación *coordinada* en lugar de
espontánea. Las publicaciones de la brecha de las 17:25 tienen de 9 a 13 mensajes encubiertos
previos.

---

## 5. Centralidad de Red y Corretaje de Información

Calculado sobre el grafo dirigido de agentes (aristas privadas + encubiertas; transmisiones
excluidas porque el equipo es una clique de difusión cuya intermediación es trivialmente cero):

- **Grado de entrada/salida** — alcance directo.
- **Intermediación** (algoritmo de Brandes, normalizado) solo sobre aristas *dirigidas* —
  quién conecta conversaciones privadas separadas. **Legal = 0.36** (mayor intermediario).
- **Corretaje de Información** = `(mensajes encubiertos + privados enviados) × (publicaciones públicas creadas)`,
  normalizado min-max. Esta es la métrica investigativa clave: identifica agentes que están
  tanto en el canal encubierto **como** publicando en canales públicos — el conducto interno→público.
  **Social-Media = 1.00, Legal = 0.78** dominan.

---

## 6. Puntuación de Desviación de Comportamiento (por agente)

Cuantifica cuán fuera de lo habitual actuó cada agente en el día de la crisis:

```
mezcla_base   = distribución del uso de canales en rondas pre-crisis (antes del 2046-06-05)
mezcla_crisis = distribución del uso de canales en el día de la crisis
desviacion    = ½ · Σ_canal | mezcla_crisis[c] − mezcla_base[c] |     (L1 / 2  ∈ [0,1])
```

También se expone **`new_channels`**: canales públicos que un agente usó el día de la crisis
pero *nunca* en la línea base. `legal_agent` adopta por primera vez `anonymous_post` **y**
`personal_post` — una señal de alerta concreta y no estadística que complementa la magnitud
de la desviación.

---

## 7. Fuerza de Evidencia por Hipótesis (medidor del encabezado)

Las tres hipótesis (A deliberada / B fallo de coordinación / C emergente) **no** son
puntuadas por el modelo en un veredicto. El medidor del encabezado simplemente muestra
`|puntos de apoyo| / (|apoyo| + |contradicción|)` del registro de evidencia curado, para que
el analista vea el *equilibrio de evidencia*, no una conclusión de la máquina. Al hacer clic en
una hipótesis se cargan los mensajes subyacentes para un juicio independiente.

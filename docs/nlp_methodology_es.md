# Metodología NLP / Extracción de Características de Texto

La plataforma extrae características de texto con un enfoque **transparente basado en léxicos**
en lugar de un modelo de embeddings opaco. Para un contexto investigativo/legal, esta es una
decisión deliberada: cada etiqueta es explicable y auditable ("esta publicación fue marcada
porque literalmente contiene *CivicLoom*"), lo que importa cuando el resultado puede respaldar
una conclusión legal. Toda la extracción ocurre en `scripts/transform.py`.

---

## 1. Léxicos (cinco familias de lenguaje)

Cada familia es una lista de fragmentos de expresiones regulares sin distinción de mayúsculas,
calibrados para este corpus. Se almacenan en `data/meta.json` para que la interfaz pueda mostrar
qué términos coincidieron.

| Familia | Propósito (pregunta analítica) | Términos representativos |
|---|---|---|
| **merger** | Tema embargado — *qué* no debe filtrarse | `civicloom`, `harborcrest`, `merger`, `acquisi`, `definitive agreement`, `strategic partner`, `rebrand`, `takeover`, `new capital`, `well-capitalized` |
| **embargo** | Conciencia de la restricción — *contexto de intención* | `embargo`, `6 ?pm`, `6:00`, `do not (disclose\|post)`, `confidential`, `material nonpublic`, `premature`, `no comment` |
| **execution** | El acto de publicar — *quién apretó el gatillo* | `executing`, `posting now`, `going live`, `publish`, `authorized to share`, `green light`, `confirm` |
| **compliance** | Encuadre legal/de riesgo — *cómo fue racionalizado* | `compliance`, `10b-5`, `pslra`, `safe harbor`, `securities`, `defensible`, `outside counsel`, `liability`, `flagged` |
| **governance** | Vocabulario de "cobertura" para divulgación indirecta | `governance`, `audit`, `consent management`, `access control`, `role-based`, `permissible-use`, `retention optimizer`, `re-identification` |

La familia **governance** es el hallazgo metodológico específico de este caso: la brecha no
ocurrió mediante declaraciones directas sobre la fusión desde el principio — se filtró a través
de una serie de publicaciones *de "clarificación de gobernanza" defendibles* que divulgaron el
acuerdo de forma incremental. Rastrear el lenguaje de gobernanza junto al de fusión expone ese
gradiente (visible como la trayectoria de riesgo ascendente en **Reconstrucción de Fuga** y los
eventos de prueba de límites E07/E08).

---

## 2. Dónde se aplican las características

Para cada comunicación ejecutamos los léxicos sobre dos campos de forma independiente:

- **`nlp`** — sobre el `content` público (lo que se dijo externamente). Impulsa la detección de
  violaciones, la sensibilidad, la probabilidad de fuga y el resaltado `<mark>` en el inspector.
- **`nlp_inner`** — sobre el `internal_state` del agente (reaccionando / racionalizando /
  deliberando). Esto separa el **conocimiento privado** de las **declaraciones públicas** y es
  lo que permite a la plataforma responder *"¿quién sabía qué y cuándo?"* — un agente puede
  llevar lenguaje de fusión internamente durante días antes de cualquier publicación pública.

---

## 3. Características de texto derivadas por mensaje

```
flags        : {merger, embargo, execution, compliance, governance}  → booleanos
nlp          : términos coincidentes por familia (contenido público)  → visualización de evidencia
nlp_inner    : términos coincidentes por familia (razonamiento interno) → "conocimiento privado"
sensitivity  : mezcla ponderada (ver risk_scoring_methodology_es.md §1)
has_internal : indica si el mensaje expone el razonamiento del agente
```

Estas características alimentan los **filtros de evidencia** globales (filtrar por
merger/embargo/execution/etc.), el **mapa de calor de riesgo**, el ranking de
**probabilidad de fuga** y el índice de búsqueda.

---

## 4. Limitaciones y advertencias honestas

- La coincidencia por léxico no tiene desambiguación de sentido de palabras; `deal` o `confirm`
  pueden producir falsos positivos. Lo mitigamos **exigiendo lenguaje de fusión para cualquier
  violación** y siempre vinculando una etiqueta al **texto completo del mensaje** en el
  inspector, para que el analista verifique en lugar de confiar ciegamente en la etiqueta.
- Manejo de nombres en clave: `CivicLoom`, `HarborCrest` y `ResidentIQ` se detectan
  explícitamente porque la re-identificación de la contraparte embargada es el eje central del
  caso.
- Esto es intencionalmente **no** un modelo de tópicos ni un clasificador LLM — se priorizó la
  explicabilidad sobre el recall, lo cual es apropiado para evidencia que puede ser escrutada
  legalmente.

# MC1 — Datos de Crisis Multi-Agente

## Descripción General

Esta carpeta contiene los datos para la **crisis de LLM multi-agente** de nuestro equipo de comunicaciones corporativas. Recientemente ocurrió una investigación periodística, un embargo de comunicaciones en torno a la fusión de una empresa y una tormenta en redes sociales. Los datos se basan en 7 agentes de IA que interactúan entre sí a través de múltiples canales y toman decisiones en tiempo real sobre qué publicar y qué no.

---

## Archivos

| Archivo                  | Descripción                                                                   | Tamaño |
| ------------------------ | ----------------------------------------------------------------------------- | ------ |
| `MC1_final.json`         | Dataset MC1 con las dos semanas previas a la publicación de la información    |        |
| `mc1_data_description.md`| Este archivo de documentación                                                 | —      |

---

Cada archivo JSON sigue esta estructura.

```json
{
  "rounds": [
    {
      "hour": "2046-05-17 9 AM",
      "environment_context": {
        "event_narrative": "...",
        "market_snapshot": { ... },
        "media_events": [ ... ],
        "agents_unavailable": [ ... ]
      },
      "agent_outputs": [
        {
          "agent_id": "legal_agent",
          "internal_state": {
            "reacting": "...",
            "rationalizing": "...",
            "deliberating": "..."
          },
          "communications": [
            {
              "message_id": "...",
              "channel": "comms_huddle",
              "message_text": "..."
            }
          ],
          "declared_action": "MONITORING"
        }
      ]
    }
  ]
}
```

---

## Agentes

| ID del Agente          | Rol            | Etiqueta       | Antigüedad         | Descripción                                                                                                                           |
| ---------------------- | -------------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `legal_agent`          | legal          | Agente Legal   | Senior             | Asesor legal general.                                                                                                                 |
| `quality_agent`        | platform_trust | Confianza-Plat | Senior             | Vicepresidente de Confianza y Seguridad de la Plataforma.                                                                             |
| `social_manager_agent` | social_manager | Gestor Social  | Senior             | Gestiona los mensajes en redes sociales.                                                                                              |
| `pr_agent`             | pr             | Agente de PR   | Senior             | Director de Comunicaciones y Relaciones Públicas.                                                                                     |
| `intern_agent`         | intern         | Becario        | Junior             | Becario general.                                                                                                                      |
| `pr_intern_agent`      | pr_intern      | Becario de PR  | Junior             | Becario del equipo de PR con acceso a la cuenta oficial de TenantThread en Flex.                                                      |
| `judge_eval_agent`     | judge          | Juez           | Oficial de cumplimiento | Evalúa riesgos, media en conflictos y proporciona orientación sobre cumplimiento normativo.                                     |

---

## Empresas y Nombres en Clave

| Entidad                                | Descripción                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TenantThread**                       | La empresa que está siendo adquirida, cuyos registros se presentan aquí. Una plataforma proptech que ofrece herramientas de gestión de inquilinos, incluido el controvertido sistema "Optimizador de Retención". |
| **CivicLoom**                          | La empresa que adquiere TenantThread en la fusión. Su identidad está embargada hasta las 18:00 del día de la crisis.                                                                               |
| **Proyecto HarborCrest**               | Nombre en clave interno para la fusión entre CivicLoom y TenantThread.                                                                                                                             |
| **ResidentIQ**                         | Otra empresa proptech mencionada en el SaltWind Journal.                                                                                                                                           |
| **SaltWind Journal**                   | Periódico local que publica reportajes sobre la industria proptech.                                                                                                                                |
| **OceanCrunch**                        | Medio de comunicación tecnológico. Sarah Kowalski es reportera.                                                                                                                                    |
| **@HorizonMgmt, @PinnacleResidential** | Clientes principales de TenantThread.                                                                                                                                                              |

---

## Canales de Comunicación

Los agentes disponen de múltiples canales de comunicación para interacciones agente-agente, agente-persona y agente-sistema. Los agentes también tienen la capacidad de publicar en redes sociales con una supervisión mínima.

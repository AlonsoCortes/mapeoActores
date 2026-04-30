# Documentación de la base de datos

## Contexto

Esta base de datos está diseñada para capturar y visualizar información sobre proyectos, las instituciones que participan en ellos y los actores (personas) involucrados. La información se almacena en **Supabase** (PostgreSQL) y se consume desde una aplicación web en GitHub Pages que incluye un mapa interactivo.

---

## Diagrama de relaciones

```
instituciones ──────────────── proyectos_instituciones ──────────────── proyectos
                                  (tipo_participacion)
                                                                              │
                                                                    proyecto_actores
                                                                    (posicion_proyecto)
                                                                              │
                                                                          actores
```

---

## Tablas principales

### `instituciones`

Almacena las organizaciones vinculadas a los proyectos en una jerarquía de 3 niveles. Tiene ubicación geográfica para mostrarse en el mapa.

**Niveles:** `1 — Organización` › `2 — Departamento` › `3 — Grupo`

Ejemplo: UNAM (1) › Facultad de Arquitectura (2) › Laboratorio de Planeación (3)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | bigint | auto | Identificador único, generado automáticamente |
| `nombre` | text | sí | Nombre de la organización, departamento o grupo |
| `nivel` | smallint | sí | Nivel jerárquico: 1 (Organización), 2 (Departamento), 3 (Grupo). Default: 1 |
| `parent_id` | bigint FK | no | Referencia al registro padre en esta misma tabla. Null para nivel 1 |
| `tipo` | text | no | Tipo de organización (ej. ONG, gobierno, academia) |
| `alcaldia` | text | no | Alcaldía donde se ubica (contexto CDMX) |
| `colonia` | text | no | Colonia donde se ubica |
| `latitud` | float8 | no | Coordenada geográfica — latitud |
| `longitud` | float8 | no | Coordenada geográfica — longitud |
| `created_at` | timestamptz | auto | Fecha y hora de creación del registro |

**Migración SQL** (ejecutar en Supabase si la tabla ya existe):

```sql
alter table instituciones
  add column nivel     smallint not null default 1 check (nivel in (1, 2, 3)),
  add column parent_id bigint references instituciones(id) on delete set null;
```

---

### `proyectos`

Almacena los proyectos registrados. También tiene ubicación geográfica propia, independiente de la de sus instituciones.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | bigint | auto | Identificador único, generado automáticamente |
| `nombre` | text | sí | Nombre del proyecto |
| `objetivo` | text | no | Descripción del objetivo principal |
| `latitud` | float8 | no | Coordenada geográfica — latitud |
| `longitud` | float8 | no | Coordenada geográfica — longitud |
| `created_at` | timestamptz | auto | Fecha y hora de creación del registro |

---

### `actores`

Almacena las personas de contacto vinculadas a los proyectos. No tiene ubicación propia.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | bigint | auto | Identificador único, generado automáticamente |
| `nombres` | text | sí | Nombre(s) de pila |
| `apellido_p` | text | sí | Apellido paterno |
| `apellido_m` | text | sí | Apellido materno |
| `email` | text | sí | Correo electrónico (campo obligatorio de contacto) |
| `phone` | text | no | Teléfono o WhatsApp |
| `posicion` | text | no | Cargo o posición general de la persona |
| `created_at` | timestamptz | auto | Fecha y hora de creación del registro |

---

## Tablas intermedias

Estas tablas existen porque las relaciones entre entidades son de **muchos a muchos**: un proyecto puede tener varias instituciones, y una institución puede participar en varios proyectos. Lo mismo aplica para actores.

### `proyectos_instituciones`

Vincula proyectos con instituciones. La combinación `(proyecto_id, institucion_id)` es única — no se puede registrar la misma institución dos veces en el mismo proyecto.

| Campo | Tipo | Descripción |
|---|---|---|
| `proyecto_id` | bigint FK | Referencia a `proyectos.id` |
| `institucion_id` | bigint FK | Referencia a `instituciones.id` |
| `tipo_participacion` | text | Rol de la institución (ej. financiadora, ejecutora, aliada) |

---

### `proyecto_actores`

Vincula proyectos con actores. La combinación `(proyecto_id, actor_id)` es única.

| Campo | Tipo | Descripción |
|---|---|---|
| `proyecto_id` | bigint FK | Referencia a `proyectos.id` |
| `actor_id` | bigint FK | Referencia a `actores.id` |
| `posicion_proyecto` | text | Rol específico del actor dentro de este proyecto |

---

## Reglas de integridad

- **`references ... on delete cascade`** — si se elimina un proyecto, sus registros en `proyectos_instituciones` y `proyecto_actores` se borran automáticamente. Evita registros huérfanos.
- **`not null`** en campos clave — `nombre` en instituciones y proyectos, y `email` en actores son obligatorios. La base de datos rechaza registros sin estos valores.
- **`primary key` compuesta** en tablas intermedias — impide duplicados de vínculos.

---

## Notas de implementación

- La base de datos corre en **Supabase** (PostgreSQL con PostGIS disponible).
- Se accede vía la **API REST automática** que genera Supabase, usando `Project URL` y `anon key`.
- El mapa público consume los datos de `proyectos` e `instituciones` mediante peticiones GET sin autenticación (requiere configurar RLS en Supabase).
- El formulario de captura requiere autenticación para operaciones de escritura (INSERT).

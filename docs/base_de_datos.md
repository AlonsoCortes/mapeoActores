# Documentación de la base de datos

## Contexto

Esta base de datos está diseñada para capturar y visualizar información sobre proyectos, las instituciones que participan en ellos y los actores (personas) involucrados. La información se almacena en **Supabase** (PostgreSQL) y se consume desde una aplicación web publicada en **GitHub Pages** que incluye un mapa interactivo.

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
| `tipo` | text | no | Tipo de organización — valor controlado por catálogo `cat_tipos_institucion` |
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

## Catálogos en JavaScript

Algunos campos tienen valores controlados que se manejan directamente en el frontend, sin tabla en Supabase, porque son datos fijos que no cambian.

### Alcaldías de la CDMX (`assets/js/catalogos.js`)

Las 16 alcaldías de la Ciudad de México se almacenan en el arreglo `ALCALDIAS_CDMX`. El formulario de captura carga estas opciones en los selects de alcaldía al iniciar la página (sin requerir sesión).

```js
const ALCALDIAS_CDMX = [
  'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán',
  'Cuajimalpa de Morelos', 'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco',
  'Iztapalapa', 'La Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta',
  'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco',
];
```

### Colonias (no implementado — posibilidad futura)

El campo `colonia` en `instituciones` actualmente acepta texto libre. Si en el futuro se necesita controlar este campo, la opción recomendada es:

- Agregar un arreglo `COLONIAS_CDMX` en `catalogos.js`, estructurado como objeto `{ alcaldia: [colonia1, colonia2, ...] }` para permitir filtrado en cascada.
- El formulario actualizaría el select de colonias al cambiar la alcaldía seleccionada.
- La fuente oficial es el catálogo SEPOMEX (~1,800 colonias) o el INEGI.

No se implementó porque la variación en nombres de colonia (abreviaturas, acentos, barrios vs. colonias) hace difícil garantizar consistencia sin un proceso de normalización previo.

---

## Tablas de catálogo

### `cat_tipos_institucion`

Catálogo controlado de tipos de institución. El formulario carga estas opciones dinámicamente; para agregar o quitar un tipo basta modificar esta tabla en Supabase sin tocar el código.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | smallint | Identificador autoincremental |
| `nombre` | text | Nombre del tipo (único) |

**Valores actuales:**

| Sector | Tipos |
|---|---|
| Sector público / Gobierno | Gobierno federal · Gobierno de la Ciudad de México · Alcaldía · Organismo descentralizado · Organismo autónomo |
| Educación | Institución educativa pública · Institución educativa privada · Centro público de investigación · Instituto tecnológico |
| Salud | Hospital / Instituto de salud público · Hospital / Clínica privada |
| Empresa | Empresa privada · Startup / Empresa de base tecnológica |
| Ecosistema de innovación | Incubadora / Aceleradora · Clúster / Parque tecnológico |
| Sociedad civil | Asociación civil / OSC · Fundación |
| Internacional | Organismo internacional · Embajada / Consulado |
| Otro | Otro |

**SQL de creación:**

```sql
create table cat_tipos_institucion (
  id     smallint primary key generated always as identity,
  nombre text not null unique
);

insert into cat_tipos_institucion (nombre) values
  ('Gobierno federal'),
  ('Gobierno de la Ciudad de México'),
  ('Alcaldía'),
  ('Organismo descentralizado'),
  ('Organismo autónomo'),
  ('Institución educativa pública'),
  ('Institución educativa privada'),
  ('Centro público de investigación'),
  ('Instituto tecnológico'),
  ('Hospital / Instituto de salud público'),
  ('Hospital / Clínica privada'),
  ('Empresa privada'),
  ('Startup / Empresa de base tecnológica'),
  ('Incubadora / Aceleradora'),
  ('Clúster / Parque tecnológico'),
  ('Asociación civil / OSC'),
  ('Fundación'),
  ('Organismo internacional'),
  ('Embajada / Consulado'),
  ('Otro');
```

---

## Reglas de integridad

- **`references ... on delete cascade`** — si se elimina un proyecto, sus registros en `proyectos_instituciones` y `proyecto_actores` se borran automáticamente. Evita registros huérfanos.
- **`not null`** en campos clave — `nombre` en instituciones y proyectos, y `email` en actores son obligatorios. La base de datos rechaza registros sin estos valores.
- **`primary key` compuesta** en tablas intermedias — impide duplicados de vínculos.

---

## Notas de implementación

- La base de datos corre en **Supabase** (PostgreSQL con PostGIS disponible).
- Se accede vía la **API REST automática** que genera Supabase, usando `Project URL` y `anon key`.
- El mapa público consume los datos de `proyectos` e `instituciones` mediante peticiones GET sin autenticación (requiere configurar RLS en Supabase para lectura pública).
- El formulario de captura requiere autenticación para operaciones de escritura (INSERT).
- Los datos guardados **no pueden editarse** desde la interfaz — los errores deben reportarse al administrador.

---

## Arquitectura de deploy

El sitio es completamente estático y se publica en **GitHub Pages** via **GitHub Actions**.

```
Repositorio GitHub (público)
    │
    ├── assets/js/config.js   ← en .gitignore, NO existe en el repo
    └── .github/workflows/
            └── deploy.yml    ← genera config.js e inyecta credenciales
```

### Flujo de deploy

```
git push → GitHub Actions se activa
              │
              ├── checkout del código
              ├── genera assets/js/config.js con los secretos del repo
              └── publica en GitHub Pages
```

### Credenciales (GitHub Secrets)

Las credenciales de Supabase se almacenan como **secretos del repositorio** en GitHub (Settings → Secrets and variables → Actions) y nunca aparecen en el código fuente:

| Secreto | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase (`https://....supabase.co`) |
| `SUPABASE_ANON` | Llave pública anon (`sb_publishable_...`) |

La llave `anon` es de tipo **publishable** — está diseñada para ser usada en código cliente. La seguridad de escritura la controlan las políticas **RLS** de Supabase, no el secreto de esta llave.

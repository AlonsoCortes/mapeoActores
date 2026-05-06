# Documentación de la base de datos

## Contexto

Esta base de datos está diseñada para capturar y visualizar información sobre proyectos, las instituciones que participan en ellos y los actores (personas) involucrados. La información se almacena en **Supabase** (PostgreSQL) y se consume desde una aplicación web publicada en **GitHub Pages** que incluye un mapa interactivo.

---

## Diagrama de relaciones

```
instituciones ──── proyectos_instituciones ──── proyectos ──── proyecto_tematicas
                      (tipo_participacion)          │
                                                    ├────────── proyecto_ubicaciones
                                                    │              (latitud, longitud)
                                                    └────────── proyecto_actores
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

**SQL de creación:**

```sql
CREATE TABLE public.instituciones (
  id         bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre     text        NOT NULL,
  nivel      smallint    NOT NULL DEFAULT 1 CHECK (nivel IN (1, 2, 3)),
  parent_id  bigint      REFERENCES public.instituciones(id) ON DELETE SET NULL,
  tipo       text,
  alcaldia   text,
  colonia    text,
  latitud    float8,
  longitud   float8,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública"    ON public.instituciones FOR SELECT TO anon        USING (true);
CREATE POLICY "Insert autenticado" ON public.instituciones FOR INSERT TO authenticated WITH CHECK (true);
```

**Migración SQL** (si la tabla ya existe sin los campos de jerarquía):

```sql
ALTER TABLE instituciones
  ADD COLUMN nivel     smallint NOT NULL DEFAULT 1 CHECK (nivel IN (1, 2, 3)),
  ADD COLUMN parent_id bigint REFERENCES instituciones(id) ON DELETE SET NULL;
```

---

### `proyectos`

Almacena los proyectos registrados. Las ubicaciones geográficas se manejan en la tabla `proyecto_ubicaciones` para soportar múltiples localizaciones por proyecto.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | bigint | auto | Identificador único, generado automáticamente |
| `nombre` | text | sí | Nombre del proyecto |
| `objetivo` | text | no | Descripción del objetivo principal |
| `tipo_proyecto` | text | no | Clasificación del proyecto — valor controlado por catálogo `TIPOS_PROYECTO` |
| `created_at` | timestamptz | auto | Fecha y hora de creación del registro |

**SQL de creación:**

```sql
CREATE TABLE public.proyectos (
  id            bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre        text        NOT NULL,
  objetivo      text,
  tipo_proyecto text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública"    ON public.proyectos FOR SELECT TO anon        USING (true);
CREATE POLICY "Insert autenticado" ON public.proyectos FOR INSERT TO authenticated WITH CHECK (true);
```

**Migración SQL** (si la tabla ya existe sin `tipo_proyecto`):

```sql
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS tipo_proyecto text;
```

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

**SQL de creación:**

```sql
CREATE TABLE public.actores (
  id         bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombres    text        NOT NULL,
  apellido_p text        NOT NULL,
  apellido_m text        NOT NULL,
  email      text        NOT NULL,
  phone      text,
  posicion   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.actores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública"    ON public.actores FOR SELECT TO anon        USING (true);
CREATE POLICY "Insert autenticado" ON public.actores FOR INSERT TO authenticated WITH CHECK (true);
```

---

## Tablas intermedias

Estas tablas existen porque las relaciones entre entidades son de **muchos a muchos**: un proyecto puede tener varias instituciones, varias temáticas, varias ubicaciones geográficas; una institución puede participar en varios proyectos; un actor puede estar vinculado a varios proyectos.

### `proyectos_instituciones`

Vincula proyectos con instituciones. La combinación `(proyecto_id, institucion_id)` es única — no se puede registrar la misma institución dos veces en el mismo proyecto.

| Campo | Tipo | Descripción |
|---|---|---|
| `proyecto_id` | bigint FK | Referencia a `proyectos.id` |
| `institucion_id` | bigint FK | Referencia a `instituciones.id` |
| `tipo_participacion` | text | Rol de la institución — valor controlado por catálogo `cat_tipos_participacion` (en definición) |

**SQL de creación:**

```sql
CREATE TABLE public.proyectos_instituciones (
  proyecto_id        bigint NOT NULL REFERENCES public.proyectos(id)     ON DELETE CASCADE,
  institucion_id     bigint NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  tipo_participacion text,
  CONSTRAINT proyectos_instituciones_pkey PRIMARY KEY (proyecto_id, institucion_id)
);

ALTER TABLE public.proyectos_instituciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública"    ON public.proyectos_instituciones FOR SELECT TO anon        USING (true);
CREATE POLICY "Insert autenticado" ON public.proyectos_instituciones FOR INSERT TO authenticated WITH CHECK (true);
```

---

### `proyecto_tematicas`

Permite que un proyecto esté clasificado en **varias temáticas** simultáneamente. Los valores válidos están definidos en el catálogo `TEMATICAS_PROYECTOS` de `catalogos.js`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial | Identificador autoincremental |
| `proyecto_id` | int FK | Referencia a `proyectos.id` (cascade delete) |
| `tematica` | text | Temática del catálogo `TEMATICAS_PROYECTOS` |

**SQL de creación:**

```sql
CREATE TABLE proyecto_tematicas (
  id          serial PRIMARY KEY,
  proyecto_id int    NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tematica    text   NOT NULL
);

ALTER TABLE proyecto_tematicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read"   ON proyecto_tematicas FOR SELECT USING (true);
CREATE POLICY "auth insert" ON proyecto_tematicas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

---

### `proyecto_ubicaciones`

Permite que un proyecto tenga **varias ubicaciones geográficas** (multi-pin en el mapa). En la capa pública se genera un feature GeoJSON por cada ubicación.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial | Identificador autoincremental |
| `proyecto_id` | int FK | Referencia a `proyectos.id` (cascade delete) |
| `latitud` | float8 | Coordenada geográfica — latitud |
| `longitud` | float8 | Coordenada geográfica — longitud |
| `etiqueta` | text | Nombre opcional del lugar (ej. "Sede norte") |

**SQL de creación:**

```sql
CREATE TABLE proyecto_ubicaciones (
  id          serial PRIMARY KEY,
  proyecto_id int    NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  latitud     float8 NOT NULL,
  longitud    float8 NOT NULL,
  etiqueta    text
);

ALTER TABLE proyecto_ubicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read"   ON proyecto_ubicaciones FOR SELECT USING (true);
CREATE POLICY "auth insert" ON proyecto_ubicaciones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth delete" ON proyecto_ubicaciones FOR DELETE USING (auth.role() = 'authenticated');
```

---

### `proyecto_actores`

Vincula proyectos con actores. La combinación `(proyecto_id, actor_id)` es única. Un actor puede ser responsable técnico de varios proyectos.

| Campo | Tipo | Descripción |
|---|---|---|
| `proyecto_id` | bigint FK | Referencia a `proyectos.id` |
| `actor_id` | bigint FK | Referencia a `actores.id` |
| `posicion_proyecto` | text | Rol del actor en el proyecto. Valor actual: `responsable_tecnico` (campo preparado para catálogo futuro) |

**SQL de creación:**

```sql
create table public.proyecto_actores (
  proyecto_id       bigint not null references public.proyectos(id) on delete cascade,
  actor_id          bigint not null references public.actores(id)   on delete cascade,
  posicion_proyecto text null,
  constraint proyecto_actores_pkey primary key (proyecto_id, actor_id)
) tablespace pg_default;

alter table public.proyecto_actores enable row level security;

create policy "Lectura pública"
on public.proyecto_actores for select to anon using (true);

create policy "Insert autenticado"
on public.proyecto_actores for insert to authenticated with check (true);
```

---

## Catálogos en JavaScript

Algunos campos tienen valores controlados que se manejan directamente en el frontend (`assets/js/catalogos.js`), sin tabla en Supabase, porque son datos fijos que no cambian con frecuencia.

### Tipos de proyecto (`TIPOS_PROYECTO`)

Clasificación del tipo de proyecto según su naturaleza. Se muestra como `<select>` en el formulario y como filtro en el mapa.

```js
const TIPOS_PROYECTO = [
  'Generación de conocimiento',
  'Generación y aplicación de conocimiento',
  'Aplicación, implementación o institucionalización',
];
```

### Temáticas de proyectos (`TEMATICAS_PROYECTOS`)

Un proyecto puede pertenecer a **varias temáticas** simultáneamente (relación M:M vía `proyecto_tematicas`). El formulario muestra estos valores como checkboxes; el mapa los muestra como filtro.

```js
const TEMATICAS_PROYECTOS = [
  'Investigación científica básica y aplicada',
  'Ambiente, territorio y sustentabilidad',
  'Humanidades y ciencias sociales',
  'Ciencias de la Salud',
  'Innovación social',
  'Ciencia comunitaria/Ciencia ciudadana',
  'Investigación educativa',
  'Investigación artística',
  'Desarrollo tecnológico e ingeniería',
  'Tecnologías de la información y software',
];
```

### Alcaldías de la CDMX (`ALCALDIAS_CDMX`)

Las 16 alcaldías de la Ciudad de México. El formulario carga estas opciones en los selects de alcaldía al iniciar la página (sin requerir sesión).

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

### `cat_tipos_participacion`

Catálogo controlado del rol que tiene una institución dentro de un proyecto (ej. ejecutora, financiadora, aliada). El contenido está en definición; la tabla ya existe en Supabase lista para recibir valores.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | smallint | Identificador autoincremental |
| `nombre` | text | Nombre del tipo de participación (único) |

**SQL de creación:**

```sql
create table public.cat_tipos_participacion (
  id     smallint primary key generated always as identity,
  nombre text not null unique
);

alter table public.cat_tipos_participacion enable row level security;

create policy "Lectura pública"
on public.cat_tipos_participacion for select to anon using (true);
```

> Para agregar valores una vez definido el catálogo: `insert into cat_tipos_participacion (nombre) values ('Ejecutora'), ('Financiadora'), ...;`

---

## Queries útiles

Consultas SQL para ejecutar directamente en el **SQL Editor de Supabase**.

---

### Resumen general

```sql
-- Conteo de registros por tabla principal
SELECT
  (SELECT COUNT(*) FROM proyectos)     AS proyectos,
  (SELECT COUNT(*) FROM instituciones) AS instituciones,
  (SELECT COUNT(*) FROM actores)       AS actores;
```

---

### Proyectos

```sql
-- Todos los proyectos con sus temáticas, número de ubicaciones e instituciones vinculadas
SELECT
  p.id,
  p.nombre,
  p.tipo_proyecto,
  COUNT(DISTINCT pu.id)  AS num_ubicaciones,
  COUNT(DISTINCT pi.institucion_id) AS num_instituciones,
  STRING_AGG(DISTINCT pt.tematica, ' · ' ORDER BY pt.tematica) AS tematicas
FROM proyectos p
LEFT JOIN proyecto_ubicaciones  pu ON pu.proyecto_id = p.id
LEFT JOIN proyectos_instituciones pi ON pi.proyecto_id = p.id
LEFT JOIN proyecto_tematicas    pt ON pt.proyecto_id = p.id
GROUP BY p.id, p.nombre, p.tipo_proyecto
ORDER BY p.nombre;
```

```sql
-- Proyectos sin ubicación registrada
SELECT p.id, p.nombre
FROM proyectos p
WHERE NOT EXISTS (
  SELECT 1 FROM proyecto_ubicaciones pu WHERE pu.proyecto_id = p.id
);
```

```sql
-- Proyectos con más de una ubicación
SELECT p.id, p.nombre, COUNT(pu.id) AS num_ubicaciones
FROM proyectos p
JOIN proyecto_ubicaciones pu ON pu.proyecto_id = p.id
GROUP BY p.id, p.nombre
HAVING COUNT(pu.id) > 1
ORDER BY num_ubicaciones DESC;
```

```sql
-- Cantidad de proyectos por tipo
SELECT
  COALESCE(tipo_proyecto, '(sin tipo)') AS tipo,
  COUNT(*) AS total
FROM proyectos
GROUP BY tipo_proyecto
ORDER BY total DESC;
```

```sql
-- Cantidad de proyectos por temática
SELECT
  pt.tematica,
  COUNT(DISTINCT pt.proyecto_id) AS total
FROM proyecto_tematicas pt
GROUP BY pt.tematica
ORDER BY total DESC;
```

---

### Instituciones

```sql
-- Instituciones con su jerarquía (padre → hijo)
SELECT
  hijo.id,
  hijo.nombre                       AS institucion,
  hijo.nivel,
  padre.nombre                      AS pertenece_a,
  hijo.tipo,
  hijo.alcaldia
FROM instituciones hijo
LEFT JOIN instituciones padre ON padre.id = hijo.parent_id
ORDER BY padre.nombre NULLS FIRST, hijo.nombre;
```

```sql
-- Instituciones sin coordenadas (no aparecerán en el mapa)
SELECT id, nombre, nivel, alcaldia
FROM instituciones
WHERE latitud IS NULL OR longitud IS NULL
ORDER BY nombre;
```

```sql
-- Cantidad de instituciones por tipo
SELECT
  COALESCE(tipo, '(sin tipo)') AS tipo,
  COUNT(*) AS total
FROM instituciones
GROUP BY tipo
ORDER BY total DESC;
```

```sql
-- Cantidad de instituciones por alcaldía
SELECT
  COALESCE(alcaldia, '(sin alcaldía)') AS alcaldia,
  COUNT(*) AS total
FROM instituciones
GROUP BY alcaldia
ORDER BY total DESC;
```

---

### Actores

```sql
-- Actores con los proyectos en los que participan
SELECT
  a.nombres || ' ' || a.apellido_p || ' ' || a.apellido_m AS actor,
  a.email,
  a.posicion,
  STRING_AGG(p.nombre, ' · ' ORDER BY p.nombre) AS proyectos
FROM actores a
LEFT JOIN proyecto_actores pa ON pa.actor_id = a.id
LEFT JOIN proyectos p         ON p.id = pa.proyecto_id
GROUP BY a.id, a.nombres, a.apellido_p, a.apellido_m, a.email, a.posicion
ORDER BY a.apellido_p, a.apellido_m;
```

```sql
-- Actores sin proyecto asignado
SELECT a.id, a.nombres, a.apellido_p, a.email
FROM actores a
WHERE NOT EXISTS (
  SELECT 1 FROM proyecto_actores pa WHERE pa.actor_id = a.id
);
```

---

### Relaciones proyecto ↔ institución

```sql
-- Detalle completo: proyectos con todas sus instituciones vinculadas
SELECT
  p.nombre                          AS proyecto,
  p.tipo_proyecto,
  i.nombre                          AS institucion,
  i.tipo                            AS tipo_institucion,
  pi.tipo_participacion
FROM proyectos p
JOIN proyectos_instituciones pi ON pi.proyecto_id   = p.id
JOIN instituciones           i  ON i.id = pi.institucion_id
ORDER BY p.nombre, i.nombre;
```

```sql
-- Instituciones que participan en más de un proyecto
SELECT
  i.nombre,
  i.tipo,
  COUNT(DISTINCT pi.proyecto_id) AS num_proyectos
FROM instituciones i
JOIN proyectos_instituciones pi ON pi.institucion_id = i.id
GROUP BY i.id, i.nombre, i.tipo
HAVING COUNT(DISTINCT pi.proyecto_id) > 1
ORDER BY num_proyectos DESC;
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

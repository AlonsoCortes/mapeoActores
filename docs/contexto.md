# Contexto del proyecto — Registro y mapa de proyectos

## Descripción general

Estamos construyendo una aplicación web para **captura y visualización geográfica de proyectos**. El stack es completamente estático y gratuito:

- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks)
- **Base de datos**: Supabase (PostgreSQL hosted)
- **Hosting**: GitHub Pages
- **Mapas**: Leaflet.js con tiles de CartoDB

La app tiene dos partes:
1. `formulario.html` — formulario de captura protegido con login (solo usuarios autenticados)
2. `mapa.html` — mapa público que muestra todos los registros (sin login)

---

## Base de datos (Supabase)

### Tablas principales

```sql
-- Instituciones (tienen ubicación geográfica)
create table instituciones (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  tipo        text,
  alcaldia    text,
  colonia     text,
  latitud     float8,
  longitud    float8,
  created_at  timestamptz default now()
);

-- Proyectos (tienen ubicación geográfica)
create table proyectos (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  objetivo    text,
  latitud     float8,
  longitud    float8,
  created_at  timestamptz default now()
);

-- Actores / personas (sin ubicación)
create table actores (
  id          bigint generated always as identity primary key,
  nombres     text not null,
  apellido_p  text not null,
  apellido_m  text not null,
  email       text not null,
  phone       text,
  posicion    text,
  created_at  timestamptz default now()
);
```

### Tablas intermedias (relaciones muchos a muchos)

```sql
-- Un proyecto puede tener varias instituciones, y viceversa
create table proyectos_instituciones (
  proyecto_id        bigint references proyectos(id) on delete cascade,
  institucion_id     bigint references instituciones(id) on delete cascade,
  tipo_participacion text,
  primary key (proyecto_id, institucion_id)
);

-- Un proyecto puede tener varios actores, y viceversa
create table proyecto_actores (
  proyecto_id      bigint references proyectos(id) on delete cascade,
  actor_id         bigint references actores(id) on delete cascade,
  posicion_proyecto text,
  primary key (proyecto_id, actor_id)
);
```

### Permisos RLS

- **Lectura pública** en todas las tablas (`for select using (true)`)
- **Escritura solo autenticados** (`with check (auth.role() = 'authenticated')`)

---

## Conexión a Supabase

Siempre inicializar el cliente así:

```js
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Las credenciales viven en variables al inicio del script:

```js
const SUPABASE_URL       = 'https://XXXX.supabase.co';
const SUPABASE_ANON_KEY  = 'XXXX';
```

---

## Autenticación

Usamos el sistema de auth nativo de Supabase con email + password:

```js
// Login
const { data, error } = await db.auth.signInWithPassword({ email, password });

// Verificar sesión activa
const { data: { session } } = await db.auth.getSession();

// Logout
await db.auth.signOut();
```

---

## Formulario de captura (`formulario.html`)

Ya existe. Tiene tres pestañas:

- **Proyecto** — nombre, objetivo, coordenadas (clic en mapa Leaflet), instituciones vinculadas (con tipo de participación)
- **Institución** — nombre, tipo, alcaldía, colonia, coordenadas (clic en mapa Leaflet)
- **Actor** — nombres, apellidos, email, teléfono, posición

Flujo de guardado de un proyecto:
1. INSERT en `proyectos`
2. Por cada institución seleccionada → INSERT en `proyectos_instituciones`

---

## Lo que falta construir

### `mapa.html` — mapa público

Debe mostrar en un mapa interactivo (Leaflet.js):
- Puntos para cada **proyecto** (con popup: nombre, objetivo, instituciones vinculadas)
- Puntos para cada **institución** (con popup: nombre, tipo, alcaldía)
- Filtros opcionales por tipo de institución o nombre de proyecto
- Sin login — lectura pública

Consultas útiles para el mapa:

```js
// Proyectos con sus instituciones
const { data } = await db
  .from('proyectos')
  .select(`
    id, nombre, objetivo, latitud, longitud,
    proyectos_instituciones (
      tipo_participacion,
      instituciones ( nombre, tipo )
    )
  `);

// Instituciones
const { data } = await db
  .from('instituciones')
  .select('id, nombre, tipo, alcaldia, latitud, longitud');
```

---

## Convenciones de código

- Todo en **español** (nombres de variables, comentarios, textos de UI)
- Sin frameworks — HTML + CSS + JS vanilla únicamente
- Librería de mapas: **Leaflet.js** (`unpkg.com/leaflet@1.9.4`)
- Cliente Supabase: `unpkg.com/@supabase/supabase-js@2`
- Estética: tema oscuro (`#0f1117` fondo), acento verde (`#4ade9f`), tipografía `IBM Plex Mono` + `IBM Plex Sans`
- Tiles del mapa: CartoDB Dark — `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`

---

## Estructura de archivos esperada

```
/
├── index.html          ← redirige o es el mapa público
├── formulario.html     ← captura (requiere login)
├── mapa.html           ← visualización pública
└── README.md
```

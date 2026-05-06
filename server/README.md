# Servidor local — pruebas con PostgreSQL

Este directorio contiene un servidor Express mínimo para conectar el frontend
del proyecto a una base de datos PostgreSQL local, en lugar de Supabase.
Sirve como entorno de pruebas y como ejercicio para entender cómo funciona
la capa de acceso a datos que Supabase provee en producción.

---

## Por qué el navegador no puede hablar con PostgreSQL directamente

PostgreSQL es una base de datos que acepta conexiones **TCP** en un puerto
(por defecto el 5432). Ese protocolo no es HTTP — el navegador solo sabe hablar
HTTP/HTTPS, por lo que **no existe** una forma de conectar JavaScript en el
browser directamente a la BD.

Lo que sí puede hacer el navegador es hacer peticiones HTTP a un servidor, y
ese servidor sí puede abrir una conexión TCP a PostgreSQL:

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador                                                  │
│  mapa.html / admin/index.html                               │
│                                                             │
│  fetch('http://localhost:3000/api/proyectos')               │
└────────────────────┬────────────────────────────────────────┘
                     │  HTTP (petición GET)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Servidor Node.js — Express                                 │
│  server/server.js                                           │
│                                                             │
│  app.get('/api/proyectos', async (req, res) => {            │
│    const { rows } = await pool.query('SELECT ...')          │
│    res.json(rows)                                           │
│  })                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │  TCP puerto 5432
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL local                                           │
│  Base de datos: pruebaProyectos                             │
│                                                             │
│  Tablas: proyectos, instituciones, actores, ...             │
└─────────────────────────────────────────────────────────────┘
```

---

## Qué hace Supabase en producción

Supabase es exactamente ese intermediario, pero con más funcionalidades:

```
┌──────────────┐     HTTP/HTTPS      ┌─────────────────────┐     TCP     ┌────────────┐
│  Navegador   │ ──────────────────► │  Supabase           │ ──────────► │ PostgreSQL │
│  (frontend)  │ ◄────────────────── │  (PostgREST + Auth) │ ◄────────── │  en la     │
└──────────────┘       JSON          └─────────────────────┘    JSON     │  nube      │
                                                                          └────────────┘
```

| Característica | Supabase (producción) | Este servidor (local) |
|---|---|---|
| Protocolo hacia el cliente | HTTP/HTTPS | HTTP |
| Conexión a PostgreSQL | TCP interno | TCP a `localhost:5432` |
| Endpoints | Auto-generados del esquema | Escritos a mano en `server.js` |
| Autenticación | JWT + Row Level Security (RLS) | Sin auth (solo pruebas) |
| Credenciales | Secrets de GitHub Actions | Variables en `server.js` o `.env` |
| Deploy | Infraestructura gestionada | `node server.js` en tu máquina |

La diferencia clave es que Supabase usa **PostgREST**: un proceso que lee el
esquema de PostgreSQL y genera automáticamente endpoints REST para cada tabla.
En este servidor, los endpoints están escritos uno por uno en `server.js`.

---

## Cómo funciona `server.js` línea por línea

### 1. Conexión a la base de datos

```js
const { Pool } = require('pg');

const pool = new Pool({
  host:     'localhost',
  port:     5432,
  database: 'pruebaProyectos',
  user:     'postgres',
  password: 'postgres',
});
```

`Pool` mantiene un conjunto de conexiones abiertas a PostgreSQL. En lugar de
abrir y cerrar una conexión por cada petición (costoso), el pool reutiliza las
conexiones disponibles. `pg` es el driver oficial de Node.js para PostgreSQL.

### 2. Definición de un endpoint

```js
app.get('/api/proyectos', async (req, res) => {
  const { rows } = await pool.query('SELECT ...');
  res.json(rows);
});
```

- `app.get(ruta, handler)` — registra un endpoint que responde a peticiones GET
- `pool.query(sql)` — ejecuta SQL y devuelve las filas como objetos JavaScript
- `res.json(rows)` — serializa el resultado como JSON y lo envía al navegador

### 3. Agregaciones en SQL

El endpoint de proyectos usa `JSON_AGG` para anidar temáticas y ubicaciones
dentro de cada proyecto, en lugar de devolver tablas separadas:

```sql
JSON_AGG(DISTINCT pt.tematica) FILTER (WHERE pt.tematica IS NOT NULL)
```

Esto devuelve directamente:
```json
{
  "id": 1,
  "nombre": "Proyecto prueba",
  "tematicas": ["Innovación social", "Investigación educativa"],
  "ubicaciones": [
    { "lat": 19.4326, "lng": -99.1332, "etiqueta": "Centro CDMX" }
  ]
}
```

---

## Instalación y uso

```bash
cd server
npm install
npm start
```

El servidor queda escuchando en `http://localhost:3000`.

### Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ping` | Verifica conexión con la BD — devuelve la hora del servidor |
| GET | `/api/proyectos` | Proyectos con temáticas y ubicaciones anidadas |
| GET | `/api/instituciones` | Instituciones con coordenadas |
| GET | `/api/catalogos/tipos-institucion` | Catálogo de tipos de institución |

### Verificar la conexión

```
http://localhost:3000/api/ping
```

Respuesta esperada:
```json
{ "ok": true, "hora_servidor": "2026-05-06T19:46:39.093Z" }
```

Si hay un error de conexión, el mensaje indica exactamente qué falló:
contraseña incorrecta, base de datos inexistente, puerto bloqueado, etc.

---

## Qué hace falta para que la página web use la BD local

Para que `mapa.html` o `admin/index.html` hablen con la base de datos local en lugar de Supabase hacen falta tres cosas:

### 1. El servidor corriendo

```bash
cd server
npm start
```

Este paso ya lo tienes. El servidor escucha en `http://localhost:3000` y además **sirve los archivos HTML** del proyecto (está configurado con `express.static`).

### 2. Abrir la página a través del servidor

| Forma de abrir | ¿Funciona con BD local? |
|---|---|
| Doble clic en `mapa.html` (abre como `file://`) | ❌ — el navegador bloquea las peticiones HTTP desde `file://` |
| `http://localhost:3000/mapa.html` | ✅ — la página se sirve por HTTP y puede llamar al servidor |

Siempre usa la segunda forma mientras estás en pruebas locales.

### 3. Adaptar el frontend para llamar al servidor local

Esta es la pieza que falta. Actualmente `mapa.html` y `admin/index.html` usan el **cliente de Supabase**:

```javascript
// Así funciona ahora (Supabase)
const { data, error } = await supabase.from('proyectos').select('...');
```

Para usar el servidor local hay que reemplazar esas llamadas por `fetch` apuntando a los endpoints del servidor:

```javascript
// Así quedaría con el servidor local
const resp = await fetch('/api/proyectos');
const data = await resp.json();
```

La barra `/` al inicio significa "mismo origen" — como la página se abre desde `localhost:3000`, la petición va al mismo servidor, sin CORS.

### Resumen de qué hay que cambiar en el frontend

| Llamada Supabase actual | Equivalente con servidor local |
|---|---|
| `supabase.from('proyectos').select(...)` | `fetch('/api/proyectos')` |
| `supabase.from('instituciones').select(...)` | `fetch('/api/instituciones')` |
| `supabase.from('proyectos').insert(...)` | `fetch('/api/proyectos', { method: 'POST', body: JSON.stringify({...}) })` |
| `supabase.auth.signInWithPassword(...)` | Sin equivalente — el servidor local no tiene autenticación |

> El objetivo de esta rama es aprender cómo funciona la capa de datos, no reemplazar Supabase en producción. En producción, Supabase sigue siendo la solución recomendada porque ya incluye autenticación, RLS y endpoints autogenerados.

---

## Datos de prueba

Para probar los endpoints con datos reales, ejecuta en pgAdmin o psql:

```sql
INSERT INTO proyectos (nombre, objetivo, tipo_proyecto)
VALUES ('Proyecto prueba', 'Verificar conexión local', 'Generación de conocimiento')
RETURNING id;

-- Sustituye 1 por el id que devolvió el INSERT anterior
INSERT INTO proyecto_ubicaciones (proyecto_id, latitud, longitud, etiqueta) VALUES
  (1, 19.4326, -99.1332, 'Centro CDMX'),
  (1, 19.3600, -99.1700, 'Sede sur');

INSERT INTO proyecto_tematicas (proyecto_id, tematica) VALUES
  (1, 'Innovación social'),
  (1, 'Investigación educativa');

INSERT INTO instituciones (nombre, tipo, alcaldia, latitud, longitud)
VALUES ('UNAM', 'Institución educativa pública', 'Coyoacán', 19.3320, -99.1870);
```

# Mapeo de actores — SECTEI

Herramienta web para registrar y visualizar proyectos de ciencia, tecnología e innovación en la Ciudad de México, las instituciones que participan en ellos y los actores responsables.

Desarrollada por la Secretaría de Educación, Ciencia, Tecnología e Innovación (SECTEI CDMX).

---

## Funcionalidades

- **Mapa público** — visualización interactiva de proyectos e instituciones sobre un mapa de la CDMX
- **Multi-ubicación** — un proyecto puede tener varias coordenadas geográficas; cada una genera un pin independiente en el mapa
- **Multi-temática** — un proyecto puede clasificarse en varias temáticas simultáneamente (checkboxes en el formulario, filtro en el mapa)
- **Tipo de proyecto** — clasificación por tipo: generación de conocimiento, aplicación, etc.
- **Formulario de captura** — registro de instituciones, proyectos y actores con acceso protegido por login
- **Invitación de usuarios** — nuevos usuarios se incorporan mediante enlace de invitación de Supabase
- **Jerarquía institucional** — estructura de 3 niveles: Organización › Departamento › Grupo
- **Relaciones M:M** — instituciones, temáticas y ubicaciones pueden vincularse a múltiples proyectos

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML / CSS / JS vanilla |
| Base de datos | Supabase (PostgreSQL) |
| Mapa público | MapLibre GL v4 |
| Mapa admin | Leaflet.js |
| Deploy | GitHub Pages via GitHub Actions |

---

## Estructura del proyecto

```
mapeoActores/
├── mapa.html                    ← mapa público
├── admin/
│   └── index.html               ← formulario de captura (requiere login)
├── assets/
│   ├── css/styles.css
│   ├── geojson/                 ← capas de contexto (alcaldías, pilares, utopías…)
│   └── js/
│       ├── config.js            ← credenciales Supabase (en .gitignore, generado por CI)
│       └── catalogos.js         ← catálogos locales (tipos de proyecto, temáticas, alcaldías)
├── docs/
│   ├── base_de_datos.md         ← documentación de la base de datos
│   └── contexto.md              ← contexto del proyecto
├── server/                      ← servidor local para pruebas (rama local-postgres)
│   ├── server.js                ← Express + pg: API REST sobre PostgreSQL local
│   ├── package.json
│   └── README.md                ← cómo funciona la conexión BD ↔ servidor ↔ frontend
└── .github/
    └── workflows/
        └── deploy.yml           ← genera config.js e inyecta credenciales en cada deploy
```

---

## Desarrollo local con PostgreSQL

La rama `local-postgres` contiene un servidor Express que reemplaza Supabase
por una base de datos PostgreSQL local. Es útil para entender cómo funciona
la capa de acceso a datos y para pruebas sin depender de internet.

```bash
git checkout local-postgres
cd server
npm install
npm start
# → http://localhost:3000/api/ping
```

Ver [`server/README.md`](server/README.md) para la explicación completa de la
arquitectura, los endpoints disponibles y cómo difiere de Supabase.

---

## Deploy

El sitio se publica automáticamente en **GitHub Pages** al hacer `push` a `main`. El workflow de GitHub Actions genera `assets/js/config.js` con las credenciales de Supabase desde los secretos del repositorio.

### Secretos requeridos (Settings → Secrets and variables → Actions)

| Secreto | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON` | Llave pública anon de Supabase |

---

## Base de datos

Ver [`docs/base_de_datos.md`](docs/base_de_datos.md) para la documentación completa de tablas, relaciones, catálogos y políticas RLS.

### Tablas principales
- `instituciones` — organizaciones con jerarquía autorreferencial (3 niveles)
- `proyectos` — iniciativas con tipo de proyecto
- `actores` — personas de contacto

### Tablas intermedias
- `proyectos_instituciones` — rol de cada institución en cada proyecto
- `proyecto_actores` — actores vinculados como responsables técnicos de proyectos
- `proyecto_tematicas` — temáticas múltiples por proyecto (M:M)
- `proyecto_ubicaciones` — ubicaciones geográficas múltiples por proyecto (M:M)

### Catálogos en Supabase
- `cat_tipos_institucion` — 20 tipos de institución organizados por sector
- `cat_tipos_participacion` — roles de participación institución-proyecto (en definición)

### Catálogos en JavaScript (`assets/js/catalogos.js`)
- `TIPOS_PROYECTO` — 3 tipos de proyecto
- `TEMATICAS_PROYECTOS` — 10 áreas temáticas
- `ALCALDIAS_CDMX` — 16 alcaldías de la CDMX

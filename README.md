# Mapeo de actores — SECTEI

Herramienta web para registrar y visualizar proyectos de ciencia, tecnología e innovación en la Ciudad de México, las instituciones que participan en ellos y los actores responsables.

Desarrollada por la Secretaría de Educación, Ciencia, Tecnología e Innovación (SECTEI CDMX).

---

## Funcionalidades

- **Mapa público** — visualización interactiva de proyectos e instituciones sobre un mapa de la CDMX
- **Formulario de captura** — registro de instituciones, proyectos y actores con acceso protegido por login
- **Jerarquía institucional** — estructura de 3 niveles: Organización › Departamento › Grupo
- **Relaciones M:M** — una institución puede participar en varios proyectos; un actor puede ser responsable técnico de varios proyectos

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
│   └── js/
│       ├── config.js            ← credenciales Supabase (en .gitignore, generado por CI)
│       └── catalogos.js         ← catálogos locales (alcaldías CDMX)
├── docs/
│   └── base_de_datos.md         ← documentación de la base de datos
└── .github/
    └── workflows/
        └── deploy.yml           ← genera config.js e inyecta credenciales en cada deploy
```

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
- `instituciones` — organizaciones con jerarquía autorreferencial
- `proyectos` — iniciativas con coordenadas geográficas
- `actores` — personas de contacto

### Tablas intermedias
- `proyectos_instituciones` — rol de cada institución en cada proyecto
- `proyecto_actores` — actores vinculados como responsables técnicos de proyectos

### Catálogos
- `cat_tipos_institucion` — 20 tipos de institución organizados por sector
- `cat_tipos_participacion` — roles de participación institución-proyecto (en definición)

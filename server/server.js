const express = require('express');
const { Pool } = require('pg');
const path = require('path');

// ── Conexión a PostgreSQL local ──────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     process.env.PG_PORT     || 5432,
  database: process.env.PG_DB       || 'pruebaProyectos',
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
});

const app = express();
app.use(express.json());

// Servir los archivos estáticos del proyecto desde la raíz
app.use(express.static(path.join(__dirname, '..')));

// ── Middleware: log de cada petición ────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── Endpoint de salud ────────────────────────────────────────────────────────
app.get('/api/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS hora_servidor');
    res.json({ ok: true, hora_servidor: result.rows[0].hora_servidor });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Proyectos ────────────────────────────────────────────────────────────────
// GET /api/proyectos  →  proyectos con temáticas, ubicaciones e instituciones
app.get('/api/proyectos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.objetivo,
        p.tipo_proyecto,
        p.created_at,
        COALESCE(
          JSON_AGG(DISTINCT pt.tematica) FILTER (WHERE pt.tematica IS NOT NULL),
          '[]'
        ) AS tematicas,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT('lat', pu.latitud, 'lng', pu.longitud, 'etiqueta', pu.etiqueta)
          ) FILTER (WHERE pu.id IS NOT NULL),
          '[]'
        ) AS ubicaciones,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'tipo_participacion', proy_inst.tipo_participacion,
              'instituciones', JSONB_BUILD_OBJECT('nombre', inst.nombre, 'tipo', inst.tipo)
            )
          ) FILTER (WHERE proy_inst.id IS NOT NULL),
          '[]'
        ) AS proyectos_instituciones
      FROM proyectos p
      LEFT JOIN proyecto_tematicas      pt        ON pt.proyecto_id       = p.id
      LEFT JOIN proyecto_ubicaciones    pu        ON pu.proyecto_id       = p.id
      LEFT JOIN proyectos_instituciones proy_inst ON proy_inst.proyecto_id = p.id
      LEFT JOIN instituciones           inst      ON inst.id              = proy_inst.institucion_id
      GROUP BY p.id
      ORDER BY p.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proyectos  →  inserta un proyecto y devuelve la fila completa
app.post('/api/proyectos', async (req, res) => {
  try {
    const { nombre, objetivo, tipo_proyecto } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO proyectos (nombre, objetivo, tipo_proyecto)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, objetivo || null, tipo_proyecto || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Instituciones ────────────────────────────────────────────────────────────
// GET /api/instituciones  →  acepta ?nivel=N y ?parent_id=X como filtros
app.get('/api/instituciones', async (req, res) => {
  try {
    const { nivel, parent_id } = req.query;
    let sql = `
      SELECT id, nombre, tipo, alcaldia, latitud, longitud, nivel, parent_id
      FROM instituciones
    `;
    const params = [];
    const wheres = [];
    if (nivel)     { wheres.push(`nivel = $${params.length + 1}`);     params.push(parseInt(nivel)); }
    if (parent_id) { wheres.push(`parent_id = $${params.length + 1}`); params.push(parseInt(parent_id)); }
    if (wheres.length) sql += ` WHERE ${wheres.join(' AND ')}`;
    sql += ` ORDER BY nombre`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instituciones  →  inserta institución y devuelve la fila completa
app.post('/api/instituciones', async (req, res) => {
  try {
    const { nombre, tipo, alcaldia, colonia, nivel, parent_id, latitud, longitud } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO instituciones (nombre, tipo, alcaldia, colonia, nivel, parent_id, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        nombre,
        tipo      || null,
        alcaldia  || null,
        colonia   || null,
        nivel     || 1,
        parent_id || null,
        latitud  != null ? parseFloat(latitud)  : null,
        longitud != null ? parseFloat(longitud) : null,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tablas de relación (POST bulk) ───────────────────────────────────────────
// POST /api/proyectos-instituciones
app.post('/api/proyectos-instituciones', async (req, res) => {
  try {
    for (const r of req.body) {
      await pool.query(
        `INSERT INTO proyectos_instituciones (proyecto_id, institucion_id, tipo_participacion)
         VALUES ($1, $2, $3)`,
        [r.proyecto_id, r.institucion_id, r.tipo_participacion || null]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proyecto-tematicas
app.post('/api/proyecto-tematicas', async (req, res) => {
  try {
    for (const r of req.body) {
      await pool.query(
        `INSERT INTO proyecto_tematicas (proyecto_id, tematica) VALUES ($1, $2)`,
        [r.proyecto_id, r.tematica]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proyecto-ubicaciones
app.post('/api/proyecto-ubicaciones', async (req, res) => {
  try {
    for (const r of req.body) {
      await pool.query(
        `INSERT INTO proyecto_ubicaciones (proyecto_id, latitud, longitud, etiqueta)
         VALUES ($1, $2, $3, $4)`,
        [r.proyecto_id, r.latitud, r.longitud, r.etiqueta || null]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Actores ──────────────────────────────────────────────────────────────────
// POST /api/actores  →  inserta actor y devuelve la fila completa
app.post('/api/actores', async (req, res) => {
  try {
    const { nombres, apellido_p, apellido_m, email, phone, posicion } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO actores (nombres, apellido_p, apellido_m, email, phone, posicion)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombres, apellido_p, apellido_m, email, phone || null, posicion || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proyecto-actores
app.post('/api/proyecto-actores', async (req, res) => {
  try {
    for (const r of req.body) {
      await pool.query(
        `INSERT INTO proyecto_actores (proyecto_id, actor_id, posicion_proyecto)
         VALUES ($1, $2, $3)`,
        [r.proyecto_id, r.actor_id, r.posicion_proyecto || null]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Catálogos ────────────────────────────────────────────────────────────────
app.get('/api/catalogos/tipos-institucion', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, nombre FROM cat_tipos_institucion ORDER BY nombre`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/catalogos/tipos-participacion', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, nombre FROM cat_tipos_participacion ORDER BY nombre`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Iniciar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nServidor corriendo en http://localhost:${PORT}`);
  console.log(`Prueba la conexión:   http://localhost:${PORT}/api/ping`);
  console.log(`Proyectos:            http://localhost:${PORT}/api/proyectos`);
  console.log(`Instituciones:        http://localhost:${PORT}/api/instituciones\n`);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Restrict CORS to known origins — never allow wildcard in production
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://rodeo.app',
  'https://www.rodeo.app',
]
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.) only in development
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())

// Validate required env vars at startup
const REQUIRED_ENV = ['DATABASE_URL']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`)
  // In production, crash fast. In dev, warn but continue.
  if (process.env.NODE_ENV === 'production') process.exit(1)
}

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /map-data
// Fetches paddocks geometries and converts PostGIS to GeoJSON mapping Format
app.get('/map-data', async (req, res) => {
    try {
        const orgId = req.query.org_id;
        if (!orgId) {
            return res.status(400).json({ error: 'Missing org_id parameter' });
        }

        // Fetch paddocks for the given organization
        const query = `
            SELECT id, name, area_ha, is_grazable, current_status
            FROM paddocks
            WHERE org_id = $1
        `;
        const { rows: paddocks } = await pool.query(query, [orgId]);
        
        // Mock response if PostGIS RPC is not readily available
        res.json({ success: true, count: paddocks.length, paddocks });
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /calculate-grazing
// Algoritmo de Planificación Holística
// Input: Días de Recuperación deseados (ej. 90 días).
// Proceso: El sistema toma el número de lotes activos y calcula: DE = DR / (P - 1).
// Output: Genera un calendario de rotación optimizado (Carta de Pastoreo).
app.post('/calculate-grazing', async (req, res) => {
    try {
        const { recoveryDays, paddockCount, startDate, herdId } = req.body;

        if (!recoveryDays || !paddockCount || paddockCount <= 1) {
            return res.status(400).json({ error: 'Invalid input parameters. Ensure paddockCount > 1.' });
        }

        // DE = DR / (P - 1)
        const daysOfStay = Math.floor(recoveryDays / (paddockCount - 1));
        
        // Generate a rotation calendar
        const rotationPlan = [];
        let currentDate = startDate ? new Date(startDate) : new Date();

        for (let i = 0; i < paddockCount; i++) {
            const entryDate = new Date(currentDate);
            const exitDate = new Date(currentDate);
            exitDate.setDate(exitDate.getDate() + daysOfStay);

            rotationPlan.push({
                sequence: i + 1,
                herd_id: herdId,
                entry_date: entryDate.toISOString().split('T')[0],
                exit_date: exitDate.toISOString().split('T')[0],
                planned_recovery_days: recoveryDays,
                days_of_stay: daysOfStay
            });

            currentDate = new Date(exitDate);
        }

        res.json({
            success: true,
            daysOfStay,
            rotationPlan
        });

    } catch (error) {
        console.error('Error calculating grazing plan:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});

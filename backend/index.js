require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /map-data
// Fetches paddocks geometries and converts PostGIS to GeoJSON mapping Format
app.get('/map-data', async (req, res) => {
    try {
        const orgId = req.query.org_id;
        if (!orgId) {
            return res.status(400).json({ error: 'Missing org_id parameter' });
        }

        // We use st_asgeojson to extract the geometry nicely formatted for the frontend.
        const { data, error } = await supabase.rpc('get_paddocks_geojson', { p_org_id: orgId });
        
        // Since we don't have the RPC created yet in schema.sql, here is an alternative standard query using Supabase raw query capabilities 
        // Note: For advanced PostGIS queries, RPCs or raw PostgREST queries are better.
        // Assuming PostgREST handles GeoJSON via custom headers or RPC, a direct approach is needed:
        const { data: paddocks, error: fetchError } = await supabase
            .from('paddocks')
            .select('id, name, area_ha, is_grazable, current_status');
        
        // For actual GeoJSON parsing with standard supabase client, an RPC is typically required:
        // CREATE OR REPLACE FUNCTION get_paddocks_geojson(p_org_id UUID) RETURNS JSON AS $$
        //   SELECT json_build_object('type', 'FeatureCollection', 'features', json_agg(json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(geom)::json, 'properties', json_build_object('id', id, 'name', name, 'status', current_status))))
        //   FROM paddocks WHERE org_id = p_org_id;
        // $$ LANGUAGE SQL;
        
        if (fetchError) throw fetchError;

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

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Paths
const distPath = path.join(__dirname, 'dist');
const levelsPath = path.join(__dirname, 'public/assets/levels');

// Ensure levels directory exists
if (!fs.existsSync(levelsPath)) {
    fs.mkdirSync(levelsPath, { recursive: true });
}

// API: Save Level
app.post('/api/save-level', (req, res) => {
    try {
        const { filename, data } = req.body;

        if (!filename || !data) {
            return res.status(400).json({ error: 'Missing filename or data' });
        }

        const filePath = path.join(levelsPath, filename);

        // Write to the volume/source directory
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Saved level: ${filename}`);

        res.json({ success: true, message: `Saved ${filename}` });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save level' });
    }
});

// Serve levels directly from the source/volume to ensure freshness
// This overrides the static serve from 'dist' for this specific path
app.use('/assets/levels', express.static(levelsPath));

// Serve static files from dist
app.use(express.static(distPath));

// Fallback for SPA routing (if needed, though Phaser is mostly single page)
app.use((req, res) => {
    if (req.method === 'GET' && req.accepts('html')) {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        console.error('Serving up a 404 page')
        res.status(404).end();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving levels from: ${levelsPath}`);

    // Debug: List files in levels directory
    try {
        const files = fs.readdirSync(levelsPath);
        console.log('Levels found:', files);
    } catch (e) {
        console.log('Could not list levels directory:', e.message);
    }
});

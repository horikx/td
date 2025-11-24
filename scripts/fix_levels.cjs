const fs = require('fs');
const path = require('path');

const levelsToFix = ['level2.json', 'level3.json'];
const shiftQ = -3;

levelsToFix.forEach(filename => {
    const filePath = path.join(__dirname, '../public/assets/levels', filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`Processing ${filename}...`);

    // Shift endpoints
    if (data.endpoints) {
        if (data.endpoints.start) data.endpoints.start.q += shiftQ;
        if (data.endpoints.end) data.endpoints.end.q += shiftQ;
    }

    // Shift paths
    if (data.paths) {
        data.paths.forEach(path => {
            path.forEach(node => {
                node.q += shiftQ;
            });
        });
    }

    // Shift obstacles
    if (data.obstacles) {
        data.obstacles.forEach(obs => {
            obs.q += shiftQ;
        });
    }

    // Shift tiles
    if (data.tiles) {
        data.tiles.forEach(tile => {
            tile.q += shiftQ;
        });
    }

    // Shift waypoints
    if (data.waypoints) {
        data.waypoints.forEach(wp => {
            wp.q += shiftQ;
        });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    console.log(`Saved ${filename}`);
});

export default class HexGrid {
    constructor(scene, levelData) {
        this.scene = scene;
        this.levelData = levelData;
        this.hexSize = levelData.hexSize || 30; // Use configured size or default
        this.hexWidth = Math.sqrt(3) * this.hexSize;
        this.hexHeight = 2 * this.hexSize;

        // Offset to center the grid or place it nicely
        this.offsetX = 100;
        this.offsetY = 100;
    }

    draw() {
        this.drawTerrain();
        this.drawPaths();
        this.drawObstacles();
        this.drawEndpoints();
        this.drawEnemies(); // Placeholder
    }

    hexToPixel(q, r) {
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexSize * (3 / 2 * r);
        return { x: x + this.offsetX, y: y + this.offsetY };
    }

    drawTerrain() {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0xffffff, 1);

        // 1. Fill the entire background with water
        // Calculate how many hexes fit on screen (approximate)
        const cols = Math.ceil(this.scene.scale.width / this.hexWidth) + 5;
        const rows = Math.ceil(this.scene.scale.height / (this.hexHeight * 0.75)) + 5;

        // We need to cover negative coordinates too if the offset is in the middle,
        // but currently offset is 100,100.
        // Due to axial skew, as r increases (down), q needs to decrease (left) to stay on screen.
        // At r=15, q needs to be around -10 to be at x=0. So we start q lower.
        for (let r = -5; r < rows; r++) {
            for (let q = -15; q < cols; q++) {
                // Simple check to see if this hex is explicitly defined in levelData
                // (This is inefficient O(N^2) but fine for small maps.
                // For larger maps, we'd convert tiles to a Map/Set)
                const explicitTile = this.levelData.tiles ? this.levelData.tiles.find(t => t.q === q && t.r === r) : null;

                if (explicitTile) {
                    const pos = this.hexToPixel(explicitTile.q, explicitTile.r);
                    let color;
                    switch (explicitTile.type) {
                        case 'water': color = 0x4444ff; break;
                        case 'path': color = 0xd2b48c; break; // Tan for path
                        default: color = 0x22cc22; // Grass
                    }
                    this.drawHex(graphics, pos.x, pos.y, color);
                } else {
                    // Default to water
                    const pos = this.hexToPixel(q, r);
                    // Only draw if within reasonable bounds of the screen to save performance?
                    // For now just draw them all.
                    this.drawHex(graphics, pos.x, pos.y, 0x4444ff);
                }
            }
        }
    }
    drawHex(graphics, x, y, color) {
        graphics.fillStyle(color, 1);

        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // Pointy topped
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: x + this.hexSize * Math.cos(angle_rad),
                y: y + this.hexSize * Math.sin(angle_rad)
            });
        }

        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);
    }

    drawPaths() {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(4, 0xd2b48c, 0.8); // Tan color for path

        this.levelData.paths.forEach(path => {
            if (path.length < 2) return;

            const start = this.hexToPixel(path[0].q, path[0].r);
            graphics.beginPath();
            graphics.moveTo(start.x, start.y);

            for (let i = 1; i < path.length; i++) {
                const p = this.hexToPixel(path[i].q, path[i].r);
                graphics.lineTo(p.x, p.y);
            }
            graphics.strokePath();

            // Highlight path hexes
            path.forEach(node => {
                const pos = this.hexToPixel(node.q, node.r);
                this.drawHex(graphics, pos.x, pos.y, 0xd2b48c);
            });
        });
    }

    drawObstacles() {
        const graphics = this.scene.add.graphics();
        this.levelData.obstacles.forEach(obs => {
            const pos = this.hexToPixel(obs.q, obs.r);
            // Draw a different color or shape
            this.drawHex(graphics, pos.x, pos.y, 0x555555); // Grey for rock
        });
    }

    drawEndpoints() {
        const graphics = this.scene.add.graphics();
        const start = this.levelData.endpoints.start;
        const end = this.levelData.endpoints.end;

        const startPos = this.hexToPixel(start.q, start.r);
        const endPos = this.hexToPixel(end.q, end.r);

        // Start (Green circle)
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillCircle(startPos.x, startPos.y, 15);

        // End (Red circle)
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(endPos.x, endPos.y, 15);
    }

    drawEnemies() {
        // Placeholder removed, actual enemies spawned in GameScene
    }

    getPixelPath() {
        if (!this.levelData.paths || this.levelData.paths.length === 0) return [];
        // Assuming single path for now
        return this.levelData.paths[0].map(node => this.hexToPixel(node.q, node.r));
    }

    pixelToHex(x, y) {
        const q = (Math.sqrt(3) / 3 * (x - this.offsetX) - 1 / 3 * (y - this.offsetY)) / this.hexSize;
        const r = (2 / 3 * (y - this.offsetY)) / this.hexSize;
        return this.axialRound(q, r);
    }

    axialRound(q, r) {
        let x = q;
        let z = r;
        let y = -x - z;

        let rx = Math.round(x);
        let rz = Math.round(z);
        let ry = Math.round(y);

        const x_diff = Math.abs(rx - x);
        const y_diff = Math.abs(ry - y);
        const z_diff = Math.abs(rz - z);

        if (x_diff > y_diff && x_diff > z_diff) {
            rx = -ry - rz;
        } else if (y_diff > z_diff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        return { q: rx, r: rz };
    }

    canBuildAt(q, r) {
        // Check if tile exists and is grass
        const tile = this.levelData.tiles ? this.levelData.tiles.find(t => t.q === q && t.r === r) : null;
        if (!tile) return false; // Default is water (not buildable)
        if (tile.type !== 'grass') return false; // Can't build on path/water

        // Check obstacles
        const obstacle = this.levelData.obstacles.find(o => o.q === q && o.r === r);
        if (obstacle) return false;

        // Check if on path
        if (this.levelData.paths) {
            for (const path of this.levelData.paths) {
                if (path.find(node => node.q === q && node.r === r)) {
                    return false;
                }
            }
        }

        return true;
    }
}

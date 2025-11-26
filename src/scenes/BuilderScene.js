import Phaser from 'phaser';
import HexGrid from '../game/HexGrid';
import LevelBalancer from '../game/LevelBalancer';

export default class BuilderScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BuilderScene' });
    }

    preload() {
        // Load assets (same as GameScene for now)
        this.load.json('level1', '/assets/levels/level1.json');
        this.load.json('level2', '/assets/levels/level2.json');
        this.load.json('level3', '/assets/levels/level3.json');
        this.load.json('enemies', '/assets/config/enemies.json');
        this.load.json('towers', '/assets/config/towers.json');
    }

    create() {
        // Initialize state
        this.loadedLevels = {}; // key -> data
        this.campaignLevels = ['level1', 'level2', 'level3']; // Ordered list of keys

        // Load initial data from cache
        this.campaignLevels.forEach(key => {
            const data = this.cache.json.get(key);
            if (data) {
                this.loadedLevels[key] = JSON.parse(JSON.stringify(data));
                if (!this.loadedLevels[key].waypoints) {
                    this.loadedLevels[key].waypoints = [];
                }
            }
        });

        // Current active level
        this.currentLevelKey = 'level1';
        this.levelData = this.loadedLevels[this.currentLevelKey];

        this.hexGrid = new HexGrid(this, this.levelData);
        this.selectedHexes = new Set(); // Stores "q,r" strings
        this.isDragging = false;
        this.dragMode = 'select'; // 'select' or 'pan' (if we add panning later)
        this.hexGrid.draw();

        this.createSidebar();
        this.createInputHandlers();
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'builder-sidebar';
        sidebar.style.position = 'absolute';
        sidebar.style.left = '0';
        sidebar.style.top = '0';
        sidebar.style.width = '250px';
        sidebar.style.height = '100vh';
        sidebar.style.backgroundColor = '#333';
        sidebar.style.color = '#fff';
        sidebar.style.padding = '10px';
        sidebar.style.boxSizing = 'border-box';
        sidebar.style.overflowY = 'auto';
        sidebar.style.fontFamily = 'Arial, sans-serif';
        sidebar.style.zIndex = '1001';

        // Shift canvas
        const app = document.getElementById('app');
        if (app) {
            app.style.marginLeft = '250px';
            app.style.width = 'calc(100% - 250px)';
        }

        // Title
        const title = document.createElement('h2');
        title.innerText = 'Level Builder';
        sidebar.appendChild(title);

        // Tabs
        const tabContainer = document.createElement('div');
        tabContainer.style.display = 'flex';
        tabContainer.style.marginBottom = '15px';

        const settingsTab = this.createTabButton('Settings', true);
        const wavesTab = this.createTabButton('Waves', false);

        tabContainer.appendChild(settingsTab);
        tabContainer.appendChild(wavesTab);
        sidebar.appendChild(tabContainer);

        // Content Containers
        const settingsContent = document.createElement('div');
        settingsContent.id = 'tab-settings';
        sidebar.appendChild(settingsContent);

        const wavesContent = document.createElement('div');
        wavesContent.id = 'tab-waves';
        wavesContent.style.display = 'none';
        sidebar.appendChild(wavesContent);

        // Tab Logic
        settingsTab.onclick = () => {
            settingsTab.style.backgroundColor = '#555';
            wavesTab.style.backgroundColor = '#333';
            settingsContent.style.display = 'block';
            wavesContent.style.display = 'none';
        };
        wavesTab.onclick = () => {
            wavesTab.style.backgroundColor = '#555';
            settingsTab.style.backgroundColor = '#333';
            wavesContent.style.display = 'block';
            settingsContent.style.display = 'none';
            this.renderWaveEditor(wavesContent);
        };

        // --- Settings Content ---
        // --- Settings Content ---

        // Level Manager Container
        const levelManager = document.createElement('div');
        levelManager.style.marginBottom = '20px';
        levelManager.style.borderBottom = '1px solid #555';
        levelManager.style.paddingBottom = '10px';
        settingsContent.appendChild(levelManager);

        this.renderLevelList(levelManager);

        // Inputs (bound to current levelData)
        this.nameInput = this.createInput(settingsContent, 'Name', 'text', this.levelData.name, (v) => {
            this.levelData.name = v;
            this.renderLevelList(levelManager); // Update name in list
        });
        this.healthInput = this.createInput(settingsContent, 'Base Health', 'number', this.levelData.baseHealth, (v) => this.levelData.baseHealth = parseInt(v));
        this.moneyInput = this.createInput(settingsContent, 'Starting Money', 'number', this.levelData.startingMoney, (v) => this.levelData.startingMoney = parseInt(v));

        // Save to Server Button
        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save Level to Server';
        saveBtn.style.width = '100%';
        saveBtn.style.marginTop = '10px';
        saveBtn.style.padding = '10px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.backgroundColor = '#4a4';
        saveBtn.style.color = '#fff';
        saveBtn.onclick = () => this.saveLevelToServer();
        saveBtn.onclick = () => this.saveLevelToServer();
        sidebar.appendChild(saveBtn);

        // Analyze Button
        const analyzeBtn = document.createElement('button');
        analyzeBtn.innerText = 'Analyze Difficulty';
        analyzeBtn.style.width = '100%';
        analyzeBtn.style.marginTop = '10px';
        analyzeBtn.style.padding = '10px';
        analyzeBtn.style.cursor = 'pointer';
        analyzeBtn.style.backgroundColor = '#44a';
        analyzeBtn.style.color = '#fff';
        analyzeBtn.onclick = () => this.analyzeLevel();
        sidebar.appendChild(analyzeBtn);

        // Analysis Result Container
        this.analysisResult = document.createElement('div');
        this.analysisResult.style.marginTop = '10px';
        this.analysisResult.style.padding = '5px';
        this.analysisResult.style.backgroundColor = '#222';
        this.analysisResult.style.fontSize = '12px';
        this.analysisResult.style.display = 'none';
        sidebar.appendChild(this.analysisResult);

        // Export Button (Global)
        const exportBtn = document.createElement('button');
        exportBtn.innerText = 'Export All Levels (JSON)';
        exportBtn.style.width = '100%';
        exportBtn.style.marginTop = '10px';
        exportBtn.style.padding = '10px';
        exportBtn.style.cursor = 'pointer';
        exportBtn.onclick = () => this.exportAllLevels();
        sidebar.appendChild(exportBtn);
        sidebar.appendChild(exportBtn);

        document.body.appendChild(sidebar);
    }

    renderLevelList(container) {
        container.innerHTML = '';

        const label = document.createElement('div');
        label.innerText = 'Campaign Levels';
        label.style.fontWeight = 'bold';
        label.style.marginBottom = '5px';
        container.appendChild(label);

        this.campaignLevels.forEach((key, index) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginBottom = '5px';
            row.style.backgroundColor = (key === this.currentLevelKey) ? '#555' : '#444';
            row.style.padding = '5px';

            const name = document.createElement('span');
            name.innerText = this.loadedLevels[key].name || key;
            name.style.flex = '1';
            name.style.fontSize = '12px';
            name.style.cursor = 'pointer';
            name.onclick = () => this.selectLevel(key);
            row.appendChild(name);

            // Up
            if (index > 0) {
                const upBtn = document.createElement('button');
                upBtn.innerText = '↑';
                upBtn.style.fontSize = '10px';
                upBtn.onclick = () => {
                    this.campaignLevels[index] = this.campaignLevels[index - 1];
                    this.campaignLevels[index - 1] = key;
                    this.renderLevelList(container);
                };
                row.appendChild(upBtn);
            }

            // Down
            if (index < this.campaignLevels.length - 1) {
                const downBtn = document.createElement('button');
                downBtn.innerText = '↓';
                downBtn.style.fontSize = '10px';
                downBtn.onclick = () => {
                    this.campaignLevels[index] = this.campaignLevels[index + 1];
                    this.campaignLevels[index + 1] = key;
                    this.renderLevelList(container);
                };
                row.appendChild(downBtn);
            }

            // Delete
            const delBtn = document.createElement('button');
            delBtn.innerText = 'X';
            delBtn.style.fontSize = '10px';
            delBtn.style.backgroundColor = '#f44';
            delBtn.style.color = '#fff';
            delBtn.style.marginLeft = '5px';
            delBtn.onclick = () => {
                if (confirm(`Delete ${key}?`)) {
                    this.campaignLevels.splice(index, 1);
                    delete this.loadedLevels[key];
                    if (this.currentLevelKey === key) {
                        this.selectLevel(this.campaignLevels[0] || null);
                    } else {
                        this.renderLevelList(container);
                    }
                }
            };
            row.appendChild(delBtn);

            container.appendChild(row);
        });

        // Add Level Button
        const addBtn = document.createElement('button');
        addBtn.innerText = '+ Add Level';
        addBtn.style.width = '100%';
        addBtn.style.marginTop = '5px';
        addBtn.onclick = () => this.addNewLevel(container);
        container.appendChild(addBtn);
    }

    selectLevel(key) {
        if (!key) {
            // No levels left
            this.currentLevelKey = null;
            this.levelData = null;
            // Clear grid?
            return;
        }
        this.currentLevelKey = key;
        this.levelData = this.loadedLevels[key];
        this.hexGrid.levelData = this.levelData;
        this.hexGrid.draw();

        // Update inputs
        // Note: This is a bit hacky, ideally we'd use a framework or better binding
        // We need to refresh the sidebar or update input values manually
        const inputs = document.querySelectorAll('#tab-settings input');
        if (inputs.length >= 3) {
            inputs[0].value = this.levelData.name;
            inputs[1].value = this.levelData.baseHealth;
            inputs[2].value = this.levelData.startingMoney;
        }

        // Re-render list to show active state
        const container = document.querySelector('#tab-settings > div'); // The level manager div
        if (container) this.renderLevelList(container);
    }

    addNewLevel(container) {
        const newKey = `level${Date.now()}`; // Unique ID
        const newLevel = {
            id: newKey,
            name: 'New Level',
            baseHealth: 100,
            startingMoney: 100,
            hexSize: 30,
            availableTowers: ['basic', 'sniper', 'mortar', 'ice'],
            waves: [],
            endpoints: { start: { q: 0, r: 0 }, end: { q: 10, r: 5 } },
            paths: [],
            obstacles: [],
            tiles: [],
            waypoints: []
        };

        this.loadedLevels[newKey] = newLevel;
        this.campaignLevels.push(newKey);
        this.selectLevel(newKey);
    }

    async saveLevelToServer() {
        if (!this.currentLevelKey || !this.levelData) return;

        // Ensure nextLevel logic is applied before saving (optional, but good for consistency)
        const index = this.campaignLevels.indexOf(this.currentLevelKey);
        if (index !== -1 && index < this.campaignLevels.length - 1) {
            this.levelData.nextLevel = this.campaignLevels[index + 1];
        } else {
            delete this.levelData.nextLevel;
        }

        const filename = `${this.currentLevelKey}.json`;
        console.log(`Saving ${filename} to server...`);

        try {
            const response = await fetch('/api/save-level', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    data: this.levelData
                })
            });

            const result = await response.json();
            if (result.success) {
                alert(`Saved ${filename} successfully!`);
            } else {
                alert(`Error saving: ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to server. Is it running?');
        }
    }

    exportAllLevels() {
        // Link nextLevel properties
        this.campaignLevels.forEach((key, index) => {
            const level = this.loadedLevels[key];
            if (index < this.campaignLevels.length - 1) {
                level.nextLevel = this.campaignLevels[index + 1];
            } else {
                delete level.nextLevel;
            }
        });

        console.log('--- EXPORT START ---');
        this.campaignLevels.forEach(key => {
            console.log(`File: ${key}.json`);
            console.log(JSON.stringify(this.loadedLevels[key], null, 2));
        });
        console.log('--- EXPORT END ---');
        alert('Check console for all level JSONs!');
    }

    createTabButton(text, active) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.flex = '1';
        btn.style.padding = '5px';
        btn.style.cursor = 'pointer';
        btn.style.backgroundColor = active ? '#555' : '#333';
        btn.style.border = '1px solid #555';
        btn.style.color = '#fff';
        return btn;
    }

    renderWaveEditor(container) {
        container.innerHTML = ''; // Clear

        // Add Wave Button
        const addWaveBtn = document.createElement('button');
        addWaveBtn.innerText = '+ Add Wave';
        addWaveBtn.style.width = '100%';
        addWaveBtn.style.marginBottom = '10px';
        addWaveBtn.onclick = () => {
            this.levelData.waves.push({ name: `Wave ${this.levelData.waves.length + 1}`, enemies: [] });
            this.renderWaveEditor(container);
        };
        container.appendChild(addWaveBtn);

        // List Waves
        this.levelData.waves.forEach((wave, wIndex) => {
            const waveDiv = document.createElement('div');
            waveDiv.style.border = '1px solid #555';
            waveDiv.style.padding = '5px';
            waveDiv.style.marginBottom = '10px';
            waveDiv.style.backgroundColor = '#444';

            // Wave Header
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.marginBottom = '5px';

            const nameInput = document.createElement('input');
            nameInput.value = wave.name;
            nameInput.style.width = '70%';
            nameInput.onchange = (e) => wave.name = e.target.value;
            header.appendChild(nameInput);

            const delWaveBtn = document.createElement('button');
            delWaveBtn.innerText = 'X';
            delWaveBtn.style.backgroundColor = '#f44';
            delWaveBtn.style.color = '#fff';
            delWaveBtn.style.border = 'none';
            delWaveBtn.onclick = () => {
                this.levelData.waves.splice(wIndex, 1);
                this.renderWaveEditor(container);
            };
            header.appendChild(delWaveBtn);
            waveDiv.appendChild(header);

            // Enemy Groups
            wave.enemies.forEach((group, gIndex) => {
                const groupDiv = document.createElement('div');
                groupDiv.style.marginLeft = '10px';
                groupDiv.style.marginBottom = '5px';
                groupDiv.style.padding = '5px';
                groupDiv.style.backgroundColor = '#555';
                groupDiv.style.fontSize = '12px';

                // Type Select
                const typeSelect = document.createElement('select');
                ['basic', 'fast', 'tank', 'boss'].forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.innerText = t;
                    if (t === group.type) opt.selected = true;
                    typeSelect.appendChild(opt);
                });
                typeSelect.onchange = (e) => group.type = e.target.value;
                groupDiv.appendChild(typeSelect);

                // Count Input
                const countInput = document.createElement('input');
                countInput.type = 'number';
                countInput.value = group.count;
                countInput.style.width = '40px';
                countInput.placeholder = '#';
                countInput.onchange = (e) => group.count = parseInt(e.target.value);
                groupDiv.appendChild(countInput);

                // Interval Input
                const intervalInput = document.createElement('input');
                intervalInput.type = 'number';
                intervalInput.value = group.interval;
                intervalInput.style.width = '50px';
                intervalInput.placeholder = 'ms';
                intervalInput.onchange = (e) => group.interval = parseInt(e.target.value);
                groupDiv.appendChild(intervalInput);

                // Remove Group
                const delGroupBtn = document.createElement('button');
                delGroupBtn.innerText = '-';
                delGroupBtn.style.marginLeft = '5px';
                delGroupBtn.onclick = () => {
                    wave.enemies.splice(gIndex, 1);
                    this.renderWaveEditor(container);
                };
                groupDiv.appendChild(delGroupBtn);

                waveDiv.appendChild(groupDiv);
            });

            // Add Group Button
            const addGroupBtn = document.createElement('button');
            addGroupBtn.innerText = '+ Add Enemy Group';
            addGroupBtn.style.fontSize = '10px';
            addGroupBtn.style.width = '100%';
            addGroupBtn.onclick = () => {
                wave.enemies.push({ type: 'basic', count: 5, interval: 1000 });
                this.renderWaveEditor(container);
            };
            waveDiv.appendChild(addGroupBtn);

            container.appendChild(waveDiv);
        });
    }

    createInput(parent, label, type, value, onChange) {
        const container = document.createElement('div');
        container.style.marginBottom = '5px';

        const lbl = document.createElement('label');
        lbl.innerText = label;
        lbl.style.display = 'block';
        lbl.style.fontSize = '12px';
        container.appendChild(lbl);

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.style.width = '100%';
        input.onchange = (e) => onChange(e.target.value);
        container.appendChild(input);

        parent.appendChild(container);
        return input; // Return input element for manual updates
    }

    createInputHandlers() {
        this.input.on('pointerdown', (pointer) => {
            // Left click: Start selection/drag
            this.isDragging = true;
            const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);

            if (this.isHexInBounds(hex)) {
                if (!pointer.event.shiftKey) {
                    this.selectedHexes.clear();
                }
                this.selectedHexes.add(`${hex.q},${hex.r}`);
                this.hexGrid.draw();
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.isDragging) {
                const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);
                if (this.isHexInBounds(hex)) {
                    this.selectedHexes.add(`${hex.q},${hex.r}`);
                    this.hexGrid.draw();
                }
            }
        });

        this.input.on('pointerup', (pointer) => {
            this.isDragging = false;
            // Show menu on mouse up if we have a selection
            if (this.selectedHexes.size > 0) {
                this.showContextMenu(pointer.event.pageX, pointer.event.pageY);
            }
        });
    }

    isHexInBounds(hex) {
        const pixel = this.hexGrid.hexToPixel(hex.q, hex.r);
        const padding = this.hexGrid.hexSize;
        const width = this.scale.width;
        const height = this.scale.height;
        return !(pixel.x < padding || pixel.x > width - padding || pixel.y < padding || pixel.y > height - padding);
    }

    showContextMenu(x, y) {
        // Remove existing context menu
        const existing = document.getElementById('context-menu');
        if (existing) document.body.removeChild(existing);

        if (this.selectedHexes.size === 0) return;

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.style.position = 'absolute';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.backgroundColor = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.padding = '5px';
        menu.style.zIndex = '1000';
        menu.style.color = '#000';

        const info = document.createElement('div');
        info.innerText = `Selected: ${this.selectedHexes.size} hexes`;
        info.style.fontWeight = 'bold';
        info.style.marginBottom = '5px';
        menu.appendChild(info);

        // Determine current terrain (use first selected as reference)
        const firstKey = this.selectedHexes.values().next().value;
        const [q, r] = firstKey.split(',').map(Number);

        let currentType = 'water'; // Default
        const obstacle = this.levelData.obstacles.find(o => o.q === q && o.r === r);
        if (obstacle) {
            currentType = obstacle.type;
        } else {
            const tile = this.levelData.tiles.find(t => t.q === q && t.r === r);
            if (tile) currentType = tile.type;
        }

        // Terrain Select
        const terrainSelect = document.createElement('select');
        ['grass', 'water', 'rock', 'tree'].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            if (t === currentType) opt.selected = true;
            terrainSelect.appendChild(opt);
        });
        terrainSelect.onchange = (e) => {
            this.setTerrain(e.target.value);
            document.body.removeChild(menu);
        };
        menu.appendChild(terrainSelect);

        // Actions
        if (this.selectedHexes.size === 1) {
            const [q, r] = this.selectedHexes.values().next().value.split(',').map(Number);

            this.createMenuButton(menu, 'Set Start', () => {
                this.levelData.endpoints.start = { q, r };
                this.updatePath();
                document.body.removeChild(menu);
            });

            this.createMenuButton(menu, 'Set End', () => {
                this.levelData.endpoints.end = { q, r };
                this.updatePath();
                document.body.removeChild(menu);
            });

            // Check if it's already a waypoint
            const waypointIndex = this.levelData.waypoints.findIndex(w => w.q === q && w.r === r);

            if (waypointIndex === -1) {
                this.createMenuButton(menu, 'Add Waypoint', () => {
                    this.levelData.waypoints.push({ q, r });
                    this.updatePath();
                    document.body.removeChild(menu);
                });
            } else {
                this.createMenuButton(menu, 'Remove Waypoint', () => {
                    this.levelData.waypoints.splice(waypointIndex, 1);
                    this.updatePath();
                    document.body.removeChild(menu);
                });
            }
        }

        this.createMenuButton(menu, 'Close', () => {
            document.body.removeChild(menu);
        });

        document.body.appendChild(menu);
    }

    createMenuButton(parent, text, onClick) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.marginTop = '5px';
        btn.onclick = onClick;
        parent.appendChild(btn);
    }

    setTerrain(type) {
        // Batch update: Filter out all selected hexes from existing arrays first
        this.levelData.tiles = this.levelData.tiles.filter(t => !this.selectedHexes.has(`${t.q},${t.r}`));
        this.levelData.obstacles = this.levelData.obstacles.filter(o => !this.selectedHexes.has(`${o.q},${o.r}`));

        // Add new tiles/obstacles for all selected hexes
        this.selectedHexes.forEach(key => {
            const [q, r] = key.split(',').map(Number);

            if (type === 'rock' || type === 'tree') {
                this.levelData.tiles.push({ q, r, type: 'grass' }); // Obstacles sit on grass
                this.levelData.obstacles.push({ q, r, type: type });
            } else {
                this.levelData.tiles.push({ q, r, type: type });
            }
        });

        this.hexGrid.draw();
        this.updatePath();
    }

    updatePath() {
        const points = [
            this.levelData.endpoints.start,
            ...this.levelData.waypoints,
            this.levelData.endpoints.end
        ];

        let fullPath = [];

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const segment = this.findPath(start, end);

            if (segment.length === 0) {
                console.warn('No path found between points');
                this.levelData.paths = []; // Invalid path
                this.hexGrid.draw();
                return;
            }

            // Avoid duplicating the join point
            if (i > 0) segment.shift();
            fullPath = fullPath.concat(segment);
        }

        this.levelData.paths = [fullPath];
        this.hexGrid.draw();
    }

    findPath(start, end) {
        // A* Implementation
        const openSet = [start];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const key = (h) => `${h.q},${h.r}`;

        gScore.set(key(start), 0);
        fScore.set(key(start), this.heuristic(start, end));

        while (openSet.length > 0) {
            // Get node with lowest fScore
            let current = openSet.reduce((a, b) =>
                (fScore.get(key(a)) || Infinity) < (fScore.get(key(b)) || Infinity) ? a : b
            );

            if (current.q === end.q && current.r === end.r) {
                return this.reconstructPath(cameFrom, current, key);
            }

            openSet.splice(openSet.indexOf(current), 1);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (!this.isWalkable(neighbor)) continue;

                const currentG = gScore.get(key(current));
                const tentativeGScore = (currentG !== undefined ? currentG : Infinity) + 1; // Cost is 1 for now
                const neighborG = gScore.get(key(neighbor));
                const neighborGVal = neighborG !== undefined ? neighborG : Infinity;

                if (tentativeGScore < neighborGVal) {
                    cameFrom.set(key(neighbor), current);
                    gScore.set(key(neighbor), tentativeGScore);
                    fScore.set(key(neighbor), tentativeGScore + this.heuristic(neighbor, end));

                    if (!openSet.some(n => n.q === neighbor.q && n.r === neighbor.r)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return []; // No path
    }

    heuristic(a, b) {
        // Axial distance
        return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
    }

    getNeighbors(hex) {
        const directions = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
        ];
        return directions.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
    }

    isWalkable(hex) {
        // Check bounds (optional, but good for performance)
        if (Math.abs(hex.q) > 20 || Math.abs(hex.r) > 20) return false;

        // Check obstacles
        if (this.levelData.obstacles.some(o => o.q === hex.q && o.r === hex.r)) return false;

        // Check terrain type (must be grass or existing path/start/end)
        // In builder, we assume undefined is water (not walkable) unless explicitly set to grass
        const tile = this.levelData.tiles.find(t => t.q === hex.q && t.r === hex.r);
        if (!tile || tile.type !== 'grass') return false;

        return true;
    }

    reconstructPath(cameFrom, current, key) {
        const totalPath = [current];
        while (cameFrom.has(key(current))) {
            current = cameFrom.get(key(current));
            totalPath.unshift(current);
        }
        return totalPath;
    }

    // Removed loadLevel method as it is replaced by selectLevel logic

    analyzeLevel() {
        if (!this.levelData || !this.hexGrid) return;

        // Calculate path length in pixels
        const pathPixels = this.hexGrid.getPixelPath();
        if (pathPixels.length < 2) {
            alert('No valid path found!');
            return;
        }

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 0; i < pathPixels.length - 1; i++) {
            const p1 = pathPixels[i];
            const p2 = pathPixels[i + 1];
            totalDistance += Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        }

        const enemyConfig = this.cache.json.get('enemies');
        const towerConfig = this.cache.json.get('towers');

        const result = LevelBalancer.calculateDifficulty(this.levelData, enemyConfig, towerConfig, totalDistance);

        // Display Result
        this.analysisResult.style.display = 'block';
        let color = '#fff';
        if (result.rating === 'Impossible') color = '#f44';
        else if (result.rating === 'Hard') color = '#fa4';
        else if (result.rating === 'Medium') color = '#ff4';
        else if (result.rating === 'Easy') color = '#4f4';

        this.analysisResult.innerHTML = `
            <div style="font-weight:bold; color:${color}; margin-bottom:5px;">Rating: ${result.rating}</div>
            <div>Score: ${result.score.toFixed(2)}</div>
            <div>Best Tower: ${result.bestTower}</div>
            <div style="margin-top:5px; max-height:100px; overflow-y:auto;">
                ${result.details.map(d => `
                    <div style="border-bottom:1px solid #444; padding:2px;">
                        ${d.wave}: ${d.score} (HP: ${d.health})
                    </div>
                `).join('')}
            </div>
        `;
    }
}

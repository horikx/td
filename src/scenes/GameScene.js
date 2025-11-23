import Phaser from 'phaser';
import HexGrid from '../game/HexGrid';
import Enemy from '../game/Enemy';
import Tower from '../game/Tower';
import Projectile from '../game/Projectile'; // Ensure it's loaded if needed by scene
import WaveManager from '../game/WaveManager';
import GameManager from '../game/GameManager';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load assets here
        this.load.json('level1', '/assets/levels/level1.json');
        this.load.json('level2', '/assets/levels/level2.json');
        this.load.json('level3', '/assets/levels/level3.json');
        this.load.json('towers', '/assets/config/towers.json');
        this.load.json('enemies', '/assets/config/enemies.json');
    }

    create() {
        this.enemyConfig = this.cache.json.get('enemies');
        this.towerConfig = this.cache.json.get('towers');

        // Start with level 1
        this.currentLevelKey = 'level1';
        // Load initial level
        this.loadLevel(this.currentLevelKey);
    }

    loadLevel(levelKey) {
        // Clear existing entities
        if (this.towers) this.towers.clear(true, true);
        if (this.enemies) this.enemies.clear(true, true);
        if (this.projectiles) this.projectiles.clear(true, true);

        // Reset managers
        if (this.waveManager) {
            // Stop any active timers
            // Ideally WaveManager should have a cleanup method
        }

        // Load Level Data
        this.currentLevelKey = levelKey;
        this.levelData = this.cache.json.get(levelKey);

        if (!this.levelData) {
            console.error(`Level data for ${levelKey} not found!`);
            return;
        }

        // Clear existing game objects
        if (this.hexGrid) {
            this.children.removeAll(true); // This removes everything, including HUD, debug, etc.
            // Better to selectively remove game-specific elements
            // For now, let's assume a full scene reset is intended for simplicity
        }

        console.log('Loading Level:', this.levelData.name);

        // Game Manager
        this.gameManager = new GameManager(this);

        // Wave Manager
        this.waveManager = new WaveManager(this, this.levelData.waves);

        // HUD
        this.createHUD();

        this.hexGrid = new HexGrid(this, this.levelData);
        this.hexGrid.draw();

        // Convert hex path to pixel path for enemies
        this.pixelPath = this.hexGrid.getPixelPath();

        this.enemies = this.add.group();
        this.towers = this.add.group(); // Group for towers
        this.projectiles = this.add.group();

        // Selection Graphics
        this.selectionGraphics = this.add.graphics();
        this.selectionGraphics.setDepth(10); // Above towers

        // Range Preview Graphics
        this.rangePreviewGraphics = this.add.graphics();
        this.rangePreviewGraphics.setDepth(100); // Top layer

        // Selected tower type state
        this.selectedTowerType = null;

        // Create UI
        this.createTowerUI(this.levelData.availableTowers, this.towerConfig);

        // Input for tower placement
        this.input.off('pointerdown'); // Remove old listener
        this.input.on('pointerdown', (pointer) => {
            this.placeTower(pointer, this.towerConfig);
        });

        // Debug: Mouse coordinates
        if (!this.debugText) {
            this.debugText = this.add.text(600, 10, 'Mouse: (0, 0)', { font: '16px Arial', color: '#ffffff' });
            this.debugText.setDepth(100);
            this.input.on('pointermove', (pointer) => {
                const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);
                this.debugText.setText(`Mouse: (${Math.round(pointer.x)}, ${Math.round(pointer.y)}) Hex: (${hex.q}, ${hex.r})`);

                // Range Preview
                this.rangePreviewGraphics.clear();
                if (this.selectedTowerType) {
                    const config = this.towerConfig[this.selectedTowerType];
                    if (config) {
                        this.rangePreviewGraphics.fillStyle(0xffffff, 0.3);
                        this.rangePreviewGraphics.fillCircle(pointer.x, pointer.y, config.range);
                        this.rangePreviewGraphics.lineStyle(1, 0xffffff, 0.5);
                        this.rangePreviewGraphics.strokeCircle(pointer.x, pointer.y, config.range);
                    }
                }
            });

            // Expose helper for browser automation
            window.getHexPosition = (q, r) => {
                const pixel = this.hexGrid.hexToPixel(q, r);
                // Adjust for camera if needed (currently static, but good practice)
                const canvas = this.game.canvas;
                const rect = canvas.getBoundingClientRect();
                return {
                    x: pixel.x + rect.left,
                    y: pixel.y + rect.top
                };
            };

            // Debug: Toggle Hex Coordinates
            this.input.keyboard.on('keydown-D', () => {
                this.toggleDebugCoordinates();
            });
        }
    }

    toggleDebugCoordinates() {
        if (this.debugCoordinatesGroup) {
            this.debugCoordinatesGroup.destroy(true);
            this.debugCoordinatesGroup = null;
        } else {
            this.debugCoordinatesGroup = this.add.group();
            // Loop through a reasonable range
            for (let r = -5; r < 20; r++) {
                for (let q = -15; q < 20; q++) {
                    const pos = this.hexGrid.hexToPixel(q, r);
                    const text = this.add.text(pos.x, pos.y, `${q},${r}`, {
                        font: '10px Arial',
                        color: '#ffffff',
                        align: 'center'
                    }).setOrigin(0.5);
                    this.debugCoordinatesGroup.add(text);
                }
            }
            this.debugCoordinatesGroup.setDepth(100);
        }
    }

    createHUD() {
        this.hudText = this.add.text(10, 10, '', { font: '20px Arial', color: '#ffffff' });
        this.hudText.setDepth(100); // Ensure HUD is on top
        this.updateHUD();

        this.gameManager.events.on('statsChanged', this.updateHUD, this);
        this.gameManager.events.on('gameOver', this.showGameOver, this);

        // Start Wave Button
        const startBtn = document.createElement('button');
        startBtn.innerText = 'Start Wave';
        startBtn.style.position = 'absolute';
        startBtn.style.top = '10px';
        startBtn.style.right = '200px'; // Left of debug text
        startBtn.style.padding = '10px';
        startBtn.style.cursor = 'pointer';
        startBtn.onclick = () => {
            if (!this.waveManager.isWaveActive) {
                this.waveManager.startNextWave();
                this.updateHUD();
            }
        };
        document.body.appendChild(startBtn);
    }

    updateHUD() {
        const waveNum = this.waveManager.currentWaveIndex + 1;
        const totalWaves = this.waveManager.waves.length;
        this.hudText.setText(`Lives: ${this.gameManager.lives}   Money: $${this.gameManager.money}   Wave: ${waveNum}/${totalWaves}`);

        // Update Upgrade UI if active (reactive state)
        if (this.selectedTower) {
            this.showUpgradeUI(this.selectedTower);
        }
    }

    showGameOver() {
        this.add.text(400, 300, 'GAME OVER', { font: '64px Arial', color: '#ff0000' }).setOrigin(0.5);
    }

    showWin() {
        // Create a semi-transparent background
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRect(0, 0, this.game.config.width, this.game.config.height);
        bg.setDepth(199);

        const centerX = this.game.config.width / 2;
        const centerY = this.game.config.height / 2;

        // Create a container for all win screen elements
        const container = this.add.container(centerX, centerY);
        container.setDepth(200);

        // Title
        const winText = this.add.text(0, -150, 'LEVEL COMPLETE!', {
            font: '64px Arial',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        container.add(winText);

        // Stats
        const statsStyle = { font: '24px Arial', color: '#ffffff' };

        container.add(this.add.text(0, -50, `Gold Earned: $${this.gameManager.levelGoldEarned}`, statsStyle).setOrigin(0.5));
        container.add(this.add.text(0, 0, `Enemies Killed: ${this.gameManager.levelEnemiesKilled}`, statsStyle).setOrigin(0.5));
        container.add(this.add.text(0, 50, `Lives Lost: ${this.gameManager.levelLivesLost}`, statsStyle).setOrigin(0.5));

        // Perfect Bonus
        if (this.gameManager.levelLivesLost === 0) {
            container.add(this.add.text(0, 100, 'PERFECT LEVEL!', {
                font: '32px Arial',
                color: '#ffff00',
                fontStyle: 'bold'
            }).setOrigin(0.5));
        }

        // Next Level Button or Campaign Complete
        if (this.levelData.nextLevel) {
            const nextBtn = this.add.text(0, 180, 'Next Level', {
                fontSize: '24px',
                fill: '#fff',
                backgroundColor: '#4a4',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    bg.destroy(); // Remove background
                    container.destroy(); // Remove all win screen elements
                    this.loadLevel(this.levelData.nextLevel);
                });
            container.add(nextBtn);
        } else {
            const completeText = this.add.text(0, 180, 'Campaign Complete!', {
                fontSize: '32px',
                fill: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            container.add(completeText);
        }
    }

    createTowerUI(availableTowers, towerConfig) {
        const uiContainer = document.getElementById('ui-layer');
        uiContainer.innerHTML = ''; // Clear existing

        availableTowers.forEach(type => {
            const config = towerConfig[type];
            if (!config) return;

            const btn = document.createElement('button');
            btn.innerText = `${config.name} ($${config.cost})`;
            btn.style.pointerEvents = 'auto';
            btn.style.padding = '10px';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = '#fff';
            btn.style.border = '2px solid #333';
            btn.style.borderRadius = '5px';

            btn.onclick = () => {
                // Deselect others
                Array.from(uiContainer.children).forEach(c => c.style.backgroundColor = '#fff');

                if (this.selectedTowerType === type) {
                    this.selectedTowerType = null; // Toggle off
                    btn.style.backgroundColor = '#fff';
                } else {
                    this.selectedTowerType = type;
                    btn.style.backgroundColor = '#87CEEB'; // Highlight
                }
            };

            uiContainer.appendChild(btn);
        });
    }

    placeTower(pointer, towerConfig) {
        // Convert pixel to hex
        const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);
        const pixel = this.hexGrid.hexToPixel(hex.q, hex.r);

        // Check if clicking an existing tower
        const clickedTower = this.towers.getChildren().find(t =>
            Phaser.Math.Distance.Between(t.x, t.y, pixel.x, pixel.y) < 20
        );

        if (clickedTower) {
            this.selectTower(clickedTower);
            return;
        }

        // If not clicking a tower, and we have a type selected, try to build
        if (this.selectedTowerType) {
            // Check if valid
            if (this.hexGrid.canBuildAt(hex.q, hex.r)) {
                const config = towerConfig[this.selectedTowerType];

                // Check money
                if (this.gameManager.spendMoney(config.cost)) {
                    // Clone config so upgrades don't affect base config
                    const instanceConfig = { ...config };
                    const tower = new Tower(this, pixel.x, pixel.y, instanceConfig);
                    this.towers.add(tower);
                    console.log('Placed tower at', hex);

                    // Select the new tower
                    this.selectTower(tower);
                } else {
                    console.log('Not enough money!');
                }
            } else {
                console.log('Cannot build at', hex);
                this.deselectTower();
            }
        } else {
            this.deselectTower();
        }
    }

    selectTower(tower) {
        this.selectedTower = tower;
        this.selectedTowerType = null; // Clear build selection

        // Clear build UI highlights
        const uiContainer = document.getElementById('ui-layer');
        Array.from(uiContainer.children).forEach(c => c.style.backgroundColor = '#fff');

        // Draw selection outline
        this.selectionGraphics.clear();
        this.selectionGraphics.lineStyle(3, 0xffff00, 1); // Yellow outline

        // Draw hex outline at tower position
        const points = [];
        const radius = this.hexGrid.hexSize;
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30;
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: tower.x + radius * Math.cos(angle_rad),
                y: tower.y + radius * Math.sin(angle_rad)
            });
        }
        this.selectionGraphics.strokePoints(points, true);

        this.showUpgradeUI(tower);
    }

    deselectTower() {
        this.selectedTower = null;
        if (this.selectionGraphics) this.selectionGraphics.clear();
        if (this.rangePreviewGraphics) this.rangePreviewGraphics.clear();
        const upgradeContainer = document.getElementById('upgrade-layer');
        if (upgradeContainer) upgradeContainer.style.display = 'none';
    }

    showUpgradeUI(tower) {
        let upgradeContainer = document.getElementById('upgrade-layer');
        if (!upgradeContainer) {
            upgradeContainer = document.createElement('div');
            upgradeContainer.id = 'upgrade-layer';
            upgradeContainer.style.position = 'absolute';
            upgradeContainer.style.backgroundColor = 'rgba(0,0,0,0.8)';
            upgradeContainer.style.padding = '10px';
            upgradeContainer.style.borderRadius = '5px';
            upgradeContainer.style.color = '#fff';
            upgradeContainer.style.pointerEvents = 'auto'; // Ensure clicks work
            upgradeContainer.style.zIndex = '1000';
            document.body.appendChild(upgradeContainer);
        }

        upgradeContainer.style.display = 'block';
        upgradeContainer.innerHTML = '';

        // Position UI below the tower
        // Convert world (game) coordinates to screen (DOM) coordinates
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();

        // Camera logic (if camera moves, this needs update, but camera is static for now)
        const screenX = (tower.x - this.cameras.main.worldView.x) * this.cameras.main.zoom + rect.left;
        const screenY = (tower.y - this.cameras.main.worldView.y) * this.cameras.main.zoom + rect.top;

        // Offset to bottom of tower (approx hex height/2 + padding)
        const offsetY = this.hexGrid.hexSize + 10;

        upgradeContainer.style.left = `${screenX}px`;
        upgradeContainer.style.top = `${screenY + offsetY}px`;
        upgradeContainer.style.transform = 'translateX(-50%)'; // Center horizontally

        // Info
        const info = document.createElement('div');
        info.innerHTML = `
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">${tower.config.name} L${tower.level}</h3>
            <div style="font-size: 12px;">
                <div>Dmg: ${tower.config.damage.toFixed(1)}</div>
                <div>Rng: ${tower.config.range.toFixed(0)}</div>
                <div>Rate: ${tower.config.fireRate.toFixed(0)}ms</div>
            </div>
        `;
        upgradeContainer.appendChild(info);

        // Upgrade Button
        if (tower.canUpgrade()) {
            const cost = tower.getUpgradeCost();
            const btn = document.createElement('button');
            btn.innerText = `Upgrade ($${cost})`;
            btn.style.padding = '5px 10px';
            btn.style.marginTop = '5px';
            btn.style.cursor = 'pointer';
            btn.style.width = '100%';

            if (this.gameManager.money >= cost) {
                btn.onclick = (e) => {
                    e.stopPropagation(); // Prevent click from bubbling to game
                    if (this.gameManager.spendMoney(cost)) {
                        tower.upgrade();
                        this.deselectTower(); // Close menu on upgrade
                    }
                };
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }

            upgradeContainer.appendChild(btn);
        } else {
            upgradeContainer.appendChild(max);
        }

        // Sell Button
        const sellValue = tower.getSellValue();
        const sellBtn = document.createElement('button');
        sellBtn.innerText = `Sell ($${sellValue})`;
        sellBtn.style.padding = '5px 10px';
        sellBtn.style.marginTop = '5px';
        sellBtn.style.cursor = 'pointer';
        sellBtn.style.width = '100%';
        sellBtn.style.backgroundColor = '#ff4444';
        sellBtn.style.color = 'white';
        sellBtn.style.border = 'none';
        sellBtn.style.borderRadius = '3px';

        sellBtn.onclick = (e) => {
            e.stopPropagation();
            this.sellTower(tower);
        };

        upgradeContainer.appendChild(sellBtn);
    }

    sellTower(tower) {
        const value = tower.getSellValue();
        this.gameManager.addMoney(value);

        // Remove from group and destroy
        this.towers.remove(tower);
        tower.destroy();

        this.deselectTower();
    }

    getEnemyStats(type) {
        const stats = this.enemyConfig[type] || this.enemyConfig.basic;
        // Convert hex color string to number
        return {
            ...stats,
            color: parseInt(stats.color)
        };
    }

    spawnEnemy(type) {
        if (this.pixelPath.length === 0) return;

        const startNode = this.pixelPath[0];
        const stats = this.getEnemyStats(type);

        const enemy = new Enemy(this, startNode.x, startNode.y, this.pixelPath, stats,
            () => {
                this.gameManager.takeDamage(1); // Deduct 1 life
            },
            (bounty) => {
                this.gameManager.addMoney(bounty); // Add money
                this.gameManager.enemyKilled();
            }
        );

        this.enemies.add(enemy);
    }

    update(time, delta) {
        this.enemies.children.iterate(enemy => {
            if (enemy) {
                enemy.update(time, delta);
            }
        });

        // Check for wave completion
        if (this.waveManager) {
            this.waveManager.checkWaveCompletion(this.enemies.getLength());
        }
    }
}

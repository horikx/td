import Phaser from 'phaser';
import Projectile from './Projectile';

export default class Tower extends Phaser.GameObjects.Container {
    constructor(scene, x, y, config) {
        super(scene, x, y);
        this.scene = scene;
        this.config = config;

        // Visuals
        this.drawTower();

        // Turret container for rotation
        this.turret = this.scene.add.container(0, 0);
        this.add(this.turret);

        this.drawTurret();

        this.scene.add.existing(this);

        // Add to update list
        this.scene.events.on('update', this.update, this);

        // State
        this.lastFired = 0;
        this.level = 1;
        this.maxLevel = 3;
        this.totalInvestment = config.cost;
    }

    drawTower() {
        this.removeAll(true); // Clear previous graphics
        const graphics = this.scene.add.graphics();
        // Base
        graphics.fillStyle(parseInt(this.config.color), 1);
        graphics.fillRect(-15, -15, 30, 30);

        // Level Indicators (Stars/Dots)
        graphics.fillStyle(0xffff00, 1);
        for (let i = 0; i < this.level; i++) {
            // Draw stars floating above the tower (y = -20)
            // Center them based on count
            const spacing = 8;
            const startX = -((this.level - 1) * spacing) / 2;
            graphics.fillCircle(startX + (i * spacing), -20, 3);
        }

        this.add(graphics);

        // Re-add turret since we cleared container
        this.turret = this.scene.add.container(0, 0);
        this.add(this.turret);
        this.drawTurret();
    }

    getUpgradeCost() {
        if (!this.canUpgrade()) return 0;
        // upgrades array is 0-indexed.
        // Level 1 -> Level 2 uses upgrades[0]
        // Level 2 -> Level 3 uses upgrades[1]
        const upgradeIndex = this.level - 1;
        if (this.config.upgrades && this.config.upgrades[upgradeIndex]) {
            return this.config.upgrades[upgradeIndex].cost;
        }
        return 999999; // Fallback
    }

    canUpgrade() {
        if (!this.config.upgrades) return false;
        // Max level is 1 (base) + number of upgrades
        const maxLevel = 1 + this.config.upgrades.length;
        return this.level < maxLevel;
    }

    upgrade() {
        if (!this.canUpgrade()) return;

        const upgradeIndex = this.level - 1;
        const upgradeData = this.config.upgrades[upgradeIndex];

        if (upgradeData) {
            this.level++;

            // Apply new stats
            this.config.damage = upgradeData.damage;
            this.config.range = upgradeData.range;
            this.config.fireRate = upgradeData.fireRate;

            this.totalInvestment += upgradeData.cost;

            this.drawTower();
        }
    }

    getSellValue() {
        return Math.floor(this.totalInvestment * 0.4);
    }

    drawTurret() {
        const graphics = this.scene.add.graphics();
        // Turret body
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(0, 0, 10);
        // Barrel
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(0, -5, 20, 10);
        this.turret.add(graphics);
    }

    update(time, delta) {
        this.findTarget();
        if (this.target) {
            this.rotateToTarget();
            if (time > this.lastFired + this.config.fireRate) {
                this.shoot(time);
            }
        }
    }

    shoot(time) {
        this.lastFired = time;
        // Create projectile
        // Assuming config has projectileSpeed, default to 300 if not
        const speed = this.config.projectileSpeed || 300;
        new Projectile(this.scene, this.x, this.y, this.target, this.config.damage, speed, 0xffff00);
    }

    findTarget() {
        const enemies = this.scene.enemies.getChildren();
        let bestTarget = null;
        let maxProgress = -1;

        enemies.forEach(enemy => {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist <= this.config.range) {
                // "Most in front" means highest path index + t
                const progress = enemy.pathIndex + enemy.t;
                if (progress > maxProgress) {
                    maxProgress = progress;
                    bestTarget = enemy;
                }
            }
        });

        this.target = bestTarget;
    }

    rotateToTarget() {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        this.turret.setRotation(angle);
    }

    destroy() {
        if (this.scene) {
            this.scene.events.off('update', this.update, this);
        }
        super.destroy();
    }
}

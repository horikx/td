import Phaser from 'phaser';

export default class Enemy extends Phaser.GameObjects.Container {
    constructor(scene, x, y, path, stats, onReachEnd, onDeath) {
        super(scene, x, y);
        this.scene = scene;
        this.path = path; // Array of {x, y} pixel coordinates
        this.stats = stats;
        this.onReachEnd = onReachEnd;
        this.onDeath = onDeath; // New: Callback for when enemy is killed

        // State
        this.pathIndex = 0;
        this.health = stats.health;
        this.maxHealth = stats.health; // Track max health for bar
        this.t = 0; // Progress between current node and next node (0 to 1)

        // Visuals
        this.drawEnemy();
        this.drawHealthBar();

        // Physics/Logic
        // Initialize drift properties
        this.driftX = 0;
        this.driftY = 0;
        this.targetDriftX = (Math.random() - 0.5) * 16; // Random target within range
        this.targetDriftY = (Math.random() - 0.5) * 16;
        this.driftLerpFactor = 0.02; // How fast to move towards target

        this.setPosition(this.path[0].x, this.path[0].y);
        this.scene.add.existing(this);
    }

    drawEnemy() {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(this.stats.color, 1);

        // Draw shape based on type or just a circle/rect for now
        // Using size from stats
        const size = this.stats.size || 10;

        if (this.stats.shape === 'square') {
            graphics.fillRect(-size, -size, size * 2, size * 2);
        } else if (this.stats.shape === 'triangle') {
            graphics.fillTriangle(0, -size, size, size, -size, size);
        } else {
            graphics.fillCircle(0, 0, size);
        }

        this.add(graphics);
    }

    drawHealthBar() {
        this.healthBar = this.scene.add.graphics();
        this.add(this.healthBar);
        this.updateHealthBar();
    }

    updateHealthBar() {
        this.healthBar.clear();
        const width = 20;
        const height = 4;
        const x = -width / 2;
        const y = -20; // Above enemy

        // Background (Red)
        this.healthBar.fillStyle(0xff0000);
        this.healthBar.fillRect(x, y, width, height);

        // Health (Green)
        const healthPercent = this.health / this.maxHealth;
        this.healthBar.fillStyle(0x00ff00);
        this.healthBar.fillRect(x, y, width * healthPercent, height);
    }

    update(time, delta) {
        if (this.pathIndex >= this.path.length - 1) {
            this.reachBase();
            return;
        }

        const startNode = this.path[this.pathIndex];
        const endNode = this.path[this.pathIndex + 1];

        const dist = Phaser.Math.Distance.Between(startNode.x, startNode.y, endNode.x, endNode.y);
        const speed = this.stats.speed; // pixels per second

        // Calculate how much we move this frame
        const moveDist = (speed * delta) / 1000;

        // t increment based on distance
        const tStep = moveDist / dist;
        this.t += tStep;

        this.updateDrift();

        // Check if reached end of current segment
        if (this.t >= 1) {
            this.t = 0;
            this.pathIndex++;

            if (this.pathIndex >= this.path.length - 1) {
                // Reached end of path
                if (this.onReachEnd) this.onReachEnd();
                this.destroy();
                return;
            }
            // Snap to next node (plus drift)
            this.setPosition(
                this.path[this.pathIndex].x + this.driftX,
                this.path[this.pathIndex].y + this.driftY
            );
        } else {
            // Interpolate
            const x = Phaser.Math.Linear(startNode.x, endNode.x, this.t);
            const y = Phaser.Math.Linear(startNode.y, endNode.y, this.t);
            this.setPosition(x + this.driftX, y + this.driftY);
        }
    }

    updateDrift() {
        // Smoothly interpolate current drift towards target drift
        this.driftX = Phaser.Math.Linear(this.driftX, this.targetDriftX, this.driftLerpFactor);
        this.driftY = Phaser.Math.Linear(this.driftY, this.targetDriftY, this.driftLerpFactor);

        // Occasionally pick a new target drift
        if (Math.random() < 0.02) {
            this.targetDriftX = (Math.random() - 0.5) * 16;
            this.targetDriftY = (Math.random() - 0.5) * 16;
        }
    }

    reachBase() {
        console.log('Enemy reached base!');
        // TODO: Deduct lives from GameManager
        this.destroy();
    }

    takeDamage(amount) {
        this.health -= amount;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        console.log('Enemy died!');
        if (this.onDeath) this.onDeath(this.stats.bounty);
        this.destroy();
    }
}

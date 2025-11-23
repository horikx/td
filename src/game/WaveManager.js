export default class WaveManager {
    constructor(scene, waves) {
        this.scene = scene;
        this.waves = waves;
        this.currentWaveIndex = -1;
        this.isWaveActive = false; // True if we are currently in a wave (spawning or fighting)
        this.isSpawning = false;   // True if we are still spawning enemies
        this.enemiesRemainingToSpawn = [];
        this.spawnTimer = null;
    }

    startNextWave() {
        if (this.currentWaveIndex >= this.waves.length - 1) {
            return;
        }

        this.currentWaveIndex++;
        this.isWaveActive = true;
        this.isSpawning = true;
        const wave = this.waves[this.currentWaveIndex];
        console.log(`Starting ${wave.name}`);

        // Flatten enemy list for spawning
        this.enemiesRemainingToSpawn = [];
        wave.enemies.forEach(group => {
            for (let i = 0; i < group.count; i++) {
                this.enemiesRemainingToSpawn.push({
                    type: group.type,
                    interval: group.interval
                });
            }
        });

        this.spawnNextEnemy();
    }

    spawnNextEnemy() {
        if (this.enemiesRemainingToSpawn.length === 0) {
            this.isSpawning = false;
            return;
        }

        const nextEnemy = this.enemiesRemainingToSpawn.shift();

        // Spawn enemy
        this.scene.spawnEnemy(nextEnemy.type);

        // Schedule next spawn
        this.spawnTimer = this.scene.time.delayedCall(nextEnemy.interval, () => {
            this.spawnNextEnemy();
        });
    }
    checkWaveCompletion(activeEnemiesCount) {
        if (!this.isSpawning && activeEnemiesCount === 0 && this.isWaveActive) {
            console.log('Wave Complete!');
            this.isWaveActive = false;

            if (this.currentWaveIndex >= this.waves.length - 1) {
                console.log('All waves complete!');
                this.scene.showWin();
            }
        }
    }
}

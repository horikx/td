export default class GameManager {
    constructor(scene) {
        this.scene = scene;
        this.lives = 20;
        this.money = 100;
        this.isGameOver = false;

        // UI Events
        this.events = new Phaser.Events.EventEmitter();

        // Level Stats
        this.levelGoldEarned = 0;
        this.levelEnemiesKilled = 0;
        this.levelLivesLost = 0;
    }

    takeDamage(amount) {
        if (this.isGameOver) return;

        this.lives -= amount;
        this.levelLivesLost += amount;
        if (this.lives <= 0) {
            this.lives = 0;
            this.triggerGameOver();
        }
        this.events.emit('statsChanged', { lives: this.lives, money: this.money });
    }

    addMoney(amount) {
        this.money += amount;
        this.levelGoldEarned += amount;
        this.events.emit('statsChanged', { lives: this.lives, money: this.money });
    }

    enemyKilled() {
        this.levelEnemiesKilled++;
    }

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            this.events.emit('statsChanged', { lives: this.lives, money: this.money });
            return true;
        }
        return false;
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.events.emit('gameOver');
        console.log('Game Over!');
        // Stop spawning
        this.scene.waveManager.isWaveActive = false;
        this.scene.physics.pause(); // If using physics
    }
}

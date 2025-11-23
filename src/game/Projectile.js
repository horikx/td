import Phaser from 'phaser';

export default class Projectile extends Phaser.GameObjects.Container {
    constructor(scene, x, y, target, damage, speed, color) {
        super(scene, x, y);
        this.scene = scene;
        this.target = target;
        this.damage = damage;
        this.speed = speed || 300;
        this.color = color || 0xffffff;

        this.drawProjectile();
        this.scene.add.existing(this);
        this.scene.events.on('update', this.update, this);
    }

    drawProjectile() {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(this.color, 1);
        graphics.fillCircle(0, 0, 4);
        this.add(graphics);
    }

    update(time, delta) {
        if (!this.target || !this.target.active) {
            this.destroy();
            return;
        }

        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
        const moveDist = (this.speed * delta) / 1000;

        if (moveDist >= dist) {
            this.hitTarget();
        } else {
            this.x += Math.cos(angle) * moveDist;
            this.y += Math.sin(angle) * moveDist;
        }
    }

    hitTarget() {
        if (this.target && this.target.active) {
            this.target.takeDamage(this.damage);
        }
        this.destroy();
    }

    destroy() {
        this.scene.events.off('update', this.update, this);
        super.destroy();
    }
}

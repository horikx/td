import Phaser from 'phaser';
import BuilderScene from './scenes/BuilderScene';
import GameScene from './scenes/GameScene';

const isBuilder = window.location.pathname.includes('builder');

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#87CEEB', // Sky blue default
  scene: isBuilder ? [BuilderScene] : [GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: true
    }
  }
};

new Phaser.Game(config);

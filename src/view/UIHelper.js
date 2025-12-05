import { APP_VERSION } from '../core/Game.js';

export function createVersionWatermark(scene) {
    const { width, height } = scene.scale;

    const text = scene.add.text(width - 10, height - 10, `v${APP_VERSION}`, {
        font: '14px Arial',
        fill: '#ffffff',
        alpha: 0.3
    }).setOrigin(1, 1).setDepth(1000).setScrollFactor(0); // ScrollFactor 0 to stick to screen in MapScene

    return text;
}

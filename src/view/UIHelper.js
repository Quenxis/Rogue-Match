import { APP_VERSION } from '../core/Game.js';

export function createVersionWatermark(scene) {
    const { width, height } = scene.scale;

    const text = scene.add.text(width - 10, height - 10, `v${APP_VERSION}`, {
        font: '16px monospace', // Increased from 12px
        fill: '#ffffff',
        alpha: 0.5
    }).setOrigin(1, 1).setDepth(1000).setScrollFactor(0).setResolution(2);

    return text;
}

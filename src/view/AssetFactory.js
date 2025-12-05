/**
 * @file AssetFactory.js
 * @description Generates programmatic placeholder textures for the game elements using Phaser.Graphics.
 * @dependencies Phaser
 */

import { ITEM_TYPES } from '../logic/GridDetails.js';

export class AssetFactory {
    /**
     * @param {Phaser.Scene} scene 
     */
    constructor(scene) {
        this.scene = scene;
    }

    generateAssets() {
        const size = 60; // Base size for icons
        const radius = size / 2;

        // SWORD (Red Square/Box)
        this.createTexture(ITEM_TYPES.SWORD, size, (graphics) => {
            graphics.fillStyle(0xe53935, 1); // Red
            graphics.fillRect(0, 0, size, size);
            // Detail
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.moveTo(10, 10);
            graphics.lineTo(size - 10, size - 10);
        });

        // SHIELD (Blue Circle)
        this.createTexture(ITEM_TYPES.SHIELD, size, (graphics) => {
            graphics.fillStyle(0x1e88e5, 1); // Blue
            graphics.fillCircle(radius, radius, radius);
            // Detail
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.strokeCircle(radius, radius, radius - 5);
        });

        // MANA (Purple Diamond/Triangle)
        this.createTexture(ITEM_TYPES.MANA, size, (graphics) => {
            graphics.fillStyle(0x9c27b0, 1); // Purple
            graphics.beginPath();
            graphics.moveTo(radius, 0);
            graphics.lineTo(size, radius);
            graphics.lineTo(radius, size);
            graphics.lineTo(0, radius);
            graphics.closePath();
            graphics.fillPath();
        });

        // POTION (Green Cross)
        this.createTexture(ITEM_TYPES.POTION, size, (graphics) => {
            graphics.fillStyle(0x43a047, 1); // Green
            const thickness = size / 3;
            // Vertical bar
            graphics.fillRect(radius - thickness / 2, 0, thickness, size);
            // Horizontal bar
            graphics.fillRect(0, radius - thickness / 2, size, thickness);
        });

        // COIN (Yellow Circle)
        this.createTexture(ITEM_TYPES.COIN, size, (graphics) => {
            graphics.fillStyle(0xfdd835, 1); // Yellow
            graphics.fillCircle(radius, radius, radius * 0.8);
            graphics.fillStyle(0xfff176, 1); // Inner shine
            graphics.fillCircle(radius, radius, radius * 0.5);
        });

        console.log('Programmatic Assets Generated');
    }

    createTexture(key, size, drawFn) {
        if (this.scene.textures.exists(key)) return;

        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        drawFn(graphics);

        // Generate texture from graphics
        graphics.generateTexture(key, size, size);
        graphics.destroy();
    }
}

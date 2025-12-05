import { runManager } from '../core/RunManager.js';

export class MapScene extends Phaser.Scene {
    constructor() {
        super('MapScene');
    }

    create() {
        // If no run matches, start one
        if (!runManager.map.length) {
            runManager.startNewRun();
        }

        const titleText = this.add.text(550, 50, 'The Map', { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);

        const tiers = runManager.map;

        // CHECK IF RUN COMPLETED
        if (runManager.currentTier >= tiers.length) {
            this.add.text(550, 300, 'VICTORY ROYALE!', { font: '48px Arial', fill: '#ffd700' }).setOrigin(0.5);
            this.add.text(550, 380, `Final Gold: ${runManager.player.gold}`, { font: '24px Arial', fill: '#ffffff' }).setOrigin(0.5);

            const restartBtn = this.add.text(550, 450, 'START NEW RUN', {
                font: '24px Arial',
                fill: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            restartBtn.on('pointerdown', () => {
                runManager.startNewRun();
                this.scene.restart();
            });
            return;
        }

        // Draw Map Nodes
        const startY = 500;
        const gapY = 150;

        tiers.forEach((tierNodes, tierIndex) => {
            const y = startY - (tierIndex * gapY);
            // Center nodes horizontally
            const gapX = 150;
            const totalWidth = (tierNodes.length - 1) * gapX;
            const startX = 550 - (totalWidth / 2);

            tierNodes.forEach((node, nodeIndex) => {
                // If tier is higher then max, don't draw (handled by Victory check above, but safety)
                const x = startX + (nodeIndex * gapX);
                this.drawNode(x, y, node, tierIndex);
            });
        });

        // Debug info
        this.add.text(10, 10, `HP: ${runManager.player.currentHP}/${runManager.player.maxHP} | Gold: ${runManager.player.gold}`, { font: '16px Arial', fill: '#ffffff' });
    }

    drawNode(x, y, node, tierIndex) {
        let color = 0x888888; // Locked
        if (node.status === 'AVAILABLE') color = 0x00ff00; // Available
        if (node.status === 'COMPLETED') color = 0x444444; // Done
        if (node.type === 'BOSS') color = 0xff0000;

        // Visual connection lines (simplified, just draw line to next tier logic if we had graph structure)
        // Skipping lines for now, focusing on nodes.

        const circle = this.add.circle(x, y, 30, color);

        // Interaction
        if (tierIndex === runManager.currentTier && node.status !== 'COMPLETED') {
            circle.setInteractive({ useHandCursor: true });
            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });

            // Pulse effect for available
            this.tweens.add({
                targets: circle,
                scale: 1.1,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        // Icon/Label
        let label = '⚔️';
        if (node.type === 'BOSS') label = '💀';
        this.add.text(x, y, label, { fontSize: '24px' }).setOrigin(0.5);
    }

    handleNodeClick(node) {
        // Assume simple progression: Entering a node locks it or we just go to battle
        console.log('Entering node', node);

        // Pass node type and enemyId to battle scene
        this.scene.start('BattleScene', {
            nodeType: node.type,
            enemyId: node.enemyId
        });
    }
}

import { runManager } from '../core/RunManager.js';
import { EventBus } from '../core/EventBus.js';
import { RELICS } from '../data/relics.js';

export class TopBar {
    constructor(scene) {
        this.scene = scene;
        this.width = 1252;
        this.height = 40;

        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // High depth
        this.container.setScrollFactor(0); // Fix to camera

        // Background Strip
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, 0x222222).setOrigin(0, 0);
        this.container.add(this.bg);

        // --- HP Display ---
        this.hpText = this.scene.add.text(20, 10, '', { font: 'bold 15px Verdana', fill: '#ff4444' }).setResolution(2);

        // --- Gold Display ---
        this.goldText = this.scene.add.text(200, 10, '', { font: 'bold 15px Verdana', fill: '#ffd700' }).setResolution(2);

        this.container.add([this.hpText, this.goldText]);

        // --- Relics (Dynamic) ---
        this.relicContainer = this.scene.add.container(400, 20);
        this.container.add(this.relicContainer);
        this.relicIcons = [];
        this.relicTooltip = this.scene.add.text(0, 0, '', { font: '13px Verdana', fill: '#ffffff', backgroundColor: '#000000', padding: 4 })
            .setDepth(2001)
            .setVisible(false)
            .setResolution(2)
            .setScrollFactor(0);
        this.container.add(this.relicTooltip);

        // --- Potions (Right Side) ---
        // Slots at x=800, 850, 900
        this.potionSlots = [];
        this.createPotionSlots(700);

        // Initial Render
        this.render();

        // Listen for updates? 
        // Ideally we update on specific events, or just providing a .refresh() method that CombatManager calls.
        // Or we subscribe to 'player:updated' if we had that.
        // For now, let's expose refresh().

        // --- Scene Title (Top Right) ---
        this.titleText = this.scene.add.text(1080, 20, '', {
            font: 'bold 18px Verdana', // Monospace/Tech look
            fill: '#ffffff',
            align: 'right'
        }).setOrigin(1, 0.5).setResolution(2);
        this.container.add(this.titleText);

        // Invoked is better.

        // Listen for updates
        this.render = this.render.bind(this);
        EventBus.on('ui:refresh_topbar', this.render);

        // Cleanup on scene shutdown
        if (this.scene.events) {
            this.scene.events.once('shutdown', this.destroy, this);
            this.scene.events.once('destroy', this.destroy, this);
        }
    }

    destroy() {
        EventBus.off('ui:refresh_topbar', this.render);
        if (this.container) this.container.destroy();
    }

    setTitle(text) {
        this.titleText.setText(text.toUpperCase());
    }

    createPotionSlots(startX) {
        this.scene.add.text(startX - 60, 12, 'Potions:', { font: '13px Verdana', fill: '#aaaaaa' }).setResolution(2);

        for (let i = 0; i < 3; i++) {
            const x = startX + (i * 50);
            const y = 20;

            const slotBg = this.scene.add.circle(x, y, 16, 0x000000).setStrokeStyle(1, 0x666666);
            this.container.add(slotBg);

            // Container for item sprite
            const icon = this.scene.add.circle(x, y, 12, 0x888888).setVisible(false);
            const btn = this.scene.add.circle(x, y, 16, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.usePotion(i));

            // Tooltip (simple)
            btn.on('pointerover', () => {
                const p = runManager.player.potions[i];
                if (p) this.showTooltip(x, y + 30, `${p.name}\n${p.effect}`);
            });
            btn.on('pointerout', () => this.hideTooltip());

            this.container.add([icon, btn]);
            this.potionSlots.push({ bg: slotBg, icon: icon, btn: btn });
        }

        // Tooltip Text
        this.tooltip = this.scene.add.text(0, 0, '', { font: '13px Verdana', fill: '#ffffff', backgroundColor: '#000000', padding: 4 })
            .setDepth(2000)
            .setVisible(false)
            .setResolution(2)
            .setScrollFactor(0); // Fix to HUD
        // Note: Adding to container usually handles scroll factor, BUT if MapScene camera moves, 
        // global position calculations might be off if we rely on container relative pos?
        // Actually, container is factor 0. Children inherit. 
        // But let's be explicit.
        this.container.add(this.tooltip);
    }

    render() {
        // Update Stats
        const p = runManager.player;
        this.hpText.setText(`HP: ${p.currentHP}/${p.maxHP}`);
        this.goldText.setText(`Gold: ${p.gold}`);

        // --- Render Relics ---
        this.relicIcons.forEach(icon => {
            if (icon.destroy) icon.destroy();
        });
        this.relicIcons = [];
        this.relicContainer.removeAll(true);

        const relics = runManager.getRelics();
        relics.forEach((relicId, index) => {
            const data = RELICS[relicId];
            if (!data) return;

            const x = index * 40;
            const y = 0;

            const icon = this.scene.add.text(x, y, data.icon, { fontSize: '24px' }).setOrigin(0, 0.5);

            // Interaction for Tooltip
            const hitArea = this.scene.add.rectangle(x + 12, y, 30, 30, 0x000000, 0).setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0); // Ensure input works with camera scroll

            hitArea.on('pointerover', () => {
                // Ensure tooltip is top-most
                this.relicTooltip.setDepth(9999);
                this.relicTooltip.setText(`${data.name}\n${data.description}`);
                // Position relative to container (which is 0,0 fixed)
                this.relicTooltip.setPosition(400 + x, 50);
                this.relicTooltip.setVisible(true);
            });
            hitArea.on('pointerout', () => {
                this.relicTooltip.setVisible(false);
            });

            this.relicContainer.add([icon, hitArea]);
            this.relicIcons.push(icon); // Keep track if needed, but removeAll handles container
        });


        // Update Potions
        this.potionSlots.forEach((slot, index) => {
            const potion = p.potions[index];
            if (potion) {
                slot.icon.setVisible(true);
                slot.icon.setFillStyle(potion.color || 0xffffff);
                slot.btn.setInteractive();
            } else {
                slot.icon.setVisible(false);
                slot.btn.disableInteractive();
            }
        });
    }

    usePotion(index) {
        this.hideTooltip(); // Fix: Force hide tooltip immediately on use
        console.log(`TopBar: Clicked Potion ${index}`);
        // Emit event for CombatManager to handle
        EventBus.emit('potion:use_requested', index);
    }

    showTooltip(x, y, text) {
        this.tooltip.setPosition(x, y);
        this.tooltip.setText(text);
        this.tooltip.setVisible(true);
    }

    hideTooltip() {
        this.tooltip.setVisible(false);
    }
}

import { runManager } from '../core/RunManager.js';
import { EventBus } from '../core/EventBus.js';

export class TopBar {
    constructor(scene) {
        this.scene = scene;
        this.width = 1100;
        this.height = 40;

        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // High depth

        // Background Strip
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, 0x222222).setOrigin(0, 0);
        this.container.add(this.bg);

        // --- HP Display ---
        this.hpText = this.scene.add.text(20, 10, '', { font: 'bold 16px Arial', fill: '#ff4444' });

        // --- Gold Display ---
        this.goldText = this.scene.add.text(200, 10, '', { font: 'bold 16px Arial', fill: '#ffd700' });

        this.container.add([this.hpText, this.goldText]);

        // --- Relics (Placeholder) ---
        this.scene.add.text(400, 12, 'Relics:', { font: '12px Arial', fill: '#aaaaaa' });
        // Draw relic icons dynamically... for now just text list?
        // Let's implement dynamic icons later.

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

        // Hack: Update loop or invoked by CombatManager?
        // Invoked is better.
    }

    createPotionSlots(startX) {
        this.scene.add.text(startX - 60, 12, 'Potions:', { font: '12px Arial', fill: '#aaaaaa' });

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
        this.tooltip = this.scene.add.text(0, 0, '', { font: '12px Arial', fill: '#ffffff', backgroundColor: '#000000', padding: 4 }).setDepth(2000).setVisible(false);
        this.container.add(this.tooltip);
    }

    render() {
        // Update Stats
        const p = runManager.player;
        this.hpText.setText(`HP: ${p.currentHP}/${p.maxHP}`);
        this.goldText.setText(`Gold: ${p.gold}`);

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

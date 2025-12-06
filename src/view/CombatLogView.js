import { EventBus } from '../core/EventBus.js';

export class CombatLogView {
    constructor(scene, x, bottomY, width, height) {
        this.scene = scene;
        this.baseX = x;
        this.anchorBottomY = bottomY; // Fixed Bottom Y
        this.width = width;
        this.maxHeight = 200; // Expanded Height
        this.minHeight = 30;  // Collapsed Height (Header only)

        this.isExpanded = true; // Default to open? Or user wants minimized first? User said "Minimize/Maximize". Let's start Open.

        // Initial Dimensions
        this.currentHeight = this.maxHeight;

        this.lines = [];
        this.textObjects = [];
        this.totalTextHeight = 0;

        // Container pivot is Top-Left, but position will be adjusted to simulate Bottom-Left anchor
        this.container = this.scene.add.container(x, this.anchorBottomY - this.currentHeight);
        this.container.setDepth(1000);

        // Background
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.currentHeight, 0x111111, 0.9)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x444444)
            .setInteractive();

        // Header (Click to Toggle)
        // Positioned at the TOP of the container (0, 0)
        this.headerBg = this.scene.add.rectangle(0, 0, this.width, 30, 0x333333).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        this.headerText = this.scene.add.text(this.width / 2, 15, 'COMBAT LOG [-]', {
            font: 'bold 12px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.headerBg.on('pointerdown', this.toggleExpand.bind(this));

        // Content Container (Below Header)
        this.contentContainer = this.scene.add.container(0, 30);

        // Mask
        this.maskShape = this.scene.make.graphics();
        this.updateMask(); // Initial mask

        const mask = this.maskShape.createGeometryMask();
        this.contentContainer.setMask(mask);

        this.container.add([this.bg, this.contentContainer, this.headerBg, this.headerText]);

        this.bindEvents();

        // Mouse Wheel Scrolling
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!this.isExpanded) return;

            // Check bounds (World coords)
            const bounds = this.bg.getBounds();
            if (bounds.contains(pointer.x, pointer.y)) {
                this.scroll(deltaY * 0.5);
            }
        });
    }

    updateMask() {
        this.maskShape.clear();
        this.maskShape.fillStyle(0xffffff);
        // Mask covers area from y=30 to height (relative to world? No, maskShape needs world coords if not in container?)
        // Phaser Masks are tricky. GeometryMask uses World Coordinates.

        // Container World Position
        const wx = this.container.x;
        const wy = this.container.y;

        this.maskShape.fillRect(wx, wy + 30, this.width, this.currentHeight - 30);
    }

    bindEvents() {
        this.addEntryBind = this.addEntry.bind(this);
        this.clearBind = this.clear.bind(this);

        EventBus.on('log:entry', this.addEntryBind);
        EventBus.on('log:clear', this.clearBind);
    }

    destroy() {
        EventBus.off('log:entry', this.addEntryBind);
        EventBus.off('log:clear', this.clearBind);
        if (this.container) this.container.destroy();
        if (this.maskShape) this.maskShape.destroy();
    }

    toggleExpand() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.resize(this.maxHeight);
            this.headerText.setText('COMBAT LOG [-]');
            this.contentContainer.setVisible(true);
        } else {
            this.resize(this.minHeight);
            this.headerText.setText('COMBAT LOG [+]');
            this.contentContainer.setVisible(false);
        }
    }

    resize(h) {
        this.currentHeight = h;

        // Reposition container to keep bottom fixed
        this.container.y = this.anchorBottomY - this.currentHeight;

        // Resize BG
        this.bg.setSize(this.width, this.currentHeight);

        // Update Mask (Since world Y changed)
        this.updateMask();

        // Ensure scroll is valid
        this.scrollToBottom();
    }

    addEntry(entry) {
        if (!this.contentContainer || !this.scene) return;

        const colors = {
            'info': '#cccccc',
            'damage': '#ff6666',
            'heal': '#66ff66',
            'block': '#66ccff',
            'gold': '#ffd700',
            'turn': '#aaaaff'
        };

        const color = colors[entry.type] || '#ffffff';
        const textStr = `> ${entry.message}`;

        this.lines.push({ text: textStr, color: color });

        if (this.lines.length > 50) this.lines.shift();

        this.render();
        this.scrollToBottom();
    }

    clear() {
        this.lines = [];
        this.render();
    }

    render() {
        this.textObjects.forEach(t => t.destroy());
        this.textObjects = [];

        let currentY = 0;
        this.lines.forEach(line => {
            const t = this.scene.add.text(5, currentY, line.text, {
                font: '12px monospace',
                fill: line.color,
                wordWrap: { width: this.width - 10 }
            });
            this.contentContainer.add(t);
            this.textObjects.push(t);
            currentY += t.height + 4; // Spacing
        });

        this.totalTextHeight = currentY;
    }

    scroll(amount) {
        // Scrolling means moving contentContainer.y
        // Visible Height
        const visibleH = this.currentHeight - 30;

        if (this.totalTextHeight <= visibleH) {
            this.contentContainer.y = 30;
            return;
        }

        // Min Y: Since content is taller, we move it UP (negative Y relative to 30)
        // Bottom alignment: 30 - (total - visible)
        const minY = 30 - (this.totalTextHeight - visibleH);
        const maxY = 30;

        let newY = this.contentContainer.y - amount;
        newY = Phaser.Math.Clamp(newY, minY, maxY);
        this.contentContainer.y = newY;
    }

    scrollToBottom() {
        const visibleH = this.currentHeight - 30;
        if (this.totalTextHeight > visibleH) {
            // Move content up so bottom is visible
            this.contentContainer.y = 30 - (this.totalTextHeight - visibleH);
        } else {
            this.contentContainer.y = 30;
        }
    }
}

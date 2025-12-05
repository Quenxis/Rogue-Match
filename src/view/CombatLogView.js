import { EventBus } from '../core/EventBus.js';

export class CombatLogView {
    constructor(scene, x, y, width, height) {
        this.scene = scene;
        this.baseX = x; // Capture initial X
        this.baseY = y; // Capture initial Y
        this.minWidth = width;
        this.minHeight = 200; // Small height
        this.maxWidth = width; // Fixed Width (Same as min)
        this.maxHeight = 500;

        this.isExpanded = false;

        // Current Dimensions
        this.currentWidth = this.minWidth;
        this.currentHeight = this.minHeight;

        this.lines = [];
        this.scrollOffset = 0; // Pixels from top

        this.container = this.scene.add.container(x, y);
        this.container.setDepth(1000); // Top layer

        // Background
        this.bg = this.scene.add.rectangle(0, 0, this.currentWidth, this.currentHeight, 0x111111, 0.9)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x444444)
            .setInteractive(); // Intercept clicks

        // Header (Click to Expand)
        this.headerBg = this.scene.add.rectangle(0, 0, this.currentWidth, 25, 0x333333).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        this.headerText = this.scene.add.text(this.currentWidth / 2, 12.5, 'COMBAT LOG [+] ', {
            font: 'bold 11px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.headerBg.on('pointerdown', this.toggleExpand.bind(this));

        // Mask for Scrolling
        // Content Area: y=30 to height
        this.contentHeight = this.currentHeight - 30;
        const maskShape = this.scene.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(x, y + 30, this.currentWidth, this.contentHeight);
        const mask = maskShape.createGeometryMask();

        // Content Container
        this.contentContainer = this.scene.add.container(0, 30);
        this.contentContainer.setMask(mask);
        this.maskShape = maskShape; // Keep ref to update

        this.container.add([this.bg, this.contentContainer, this.headerBg, this.headerText]);

        this.textObjects = [];
        this.totalTextHeight = 0;

        this.bindEvents();

        // Mouse Wheel
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            // Check if mouse is over log
            // Note: pointer.x/y are world coordinates. Container opacity doesn't affect detection but position does.
            // Since container is at x,y, we check relative bounds.
            if (pointer.x >= this.container.x && pointer.x <= this.container.x + this.currentWidth &&
                pointer.y >= this.container.y && pointer.y <= this.container.y + this.currentHeight) {

                this.scroll(deltaY * 0.5); // Speed multiplier
            }
        });
    }

    bindEvents() {
        EventBus.on('log:entry', this.addEntry.bind(this));
        EventBus.on('log:clear', this.clear.bind(this));
    }

    destroy() {
        EventBus.off('log:entry');
        EventBus.off('log:clear');
        this.container.destroy();
    }

    toggleExpand() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.resize(this.maxWidth, this.maxHeight);
            this.headerText.setText('COMBAT LOG [-]');
            // Bring to very top z-index if needed
            this.container.setDepth(2000);
        } else {
            this.resize(this.minWidth, this.minHeight);
            this.headerText.setText('COMBAT LOG [+]');
            this.container.setDepth(1000);
        }
    }

    resize(w, h) {
        this.currentWidth = w;
        this.currentHeight = h;

        // Update BG
        this.bg.setSize(w, h);
        this.headerBg.setSize(w, 25);
        this.headerText.setPosition(w / 2, 12.5);

        // Update Mask
        this.contentHeight = h - 30;
        this.maskShape.clear();
        this.maskShape.fillStyle(0xffffff);
        this.maskShape.fillRect(this.baseX, this.baseY + 30, w, this.contentHeight);

        // Re-render text (wrapping might change if width changed)
        this.render();
    }

    scroll(amount) {
        // Amount > 0 = Scroll Down (Content moves UP)
        // Offset is strictly positive (distance from top)
        // wait, let's say scrollY is the y-position of contentContainer.
        // It generally goes from 0 down to -(totalHeight - viewHeight).

        if (this.totalTextHeight <= this.contentHeight) {
            this.contentContainer.y = 30; // Reset to top
            return;
        }

        const minY = 30 - (this.totalTextHeight - this.contentHeight) - 10; // Extra padding
        const maxY = 30;

        let newY = this.contentContainer.y - amount;
        newY = Phaser.Math.Clamp(newY, minY, maxY);
        this.contentContainer.y = newY;
    }

    addEntry(entry) {
        const colors = {
            'info': '#cccccc',
            'damage': '#ff6666',
            'heal': '#66ff66',
            'block': '#66ccff',
            'gold': '#ffd700',
            'turn': '#aaaaff'
        };

        const color = colors[entry.type] || '#ffffff';
        const textStr = `[${entry.time}] ${entry.message}`;

        this.lines.push({ text: textStr, color: color });

        // Limit history for performance
        if (this.lines.length > 50) {
            this.lines.shift();
        }

        this.render();
        // Auto-scroll to bottom
        // To do this, we want contentContainer.y to be at its minimum (scrolled all the way up/content moved up)
        // Except if user is scrolling up? Let's just force snap for now as demanded by logs usually.

        // Calculate min Y
        if (this.totalTextHeight > this.contentHeight) {
            const minY = 30 - (this.totalTextHeight - this.contentHeight) - 10;
            this.contentContainer.y = minY;
        }
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
                font: '10px monospace',
                fill: line.color,
                wordWrap: { width: this.currentWidth - 10 }
            });
            this.contentContainer.add(t);
            this.textObjects.push(t);
            currentY += t.height + 2;
        });

        this.totalTextHeight = currentY;
    }
}

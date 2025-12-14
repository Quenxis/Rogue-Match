
import { EventBus } from '../core/EventBus.js';
import { settingsManager } from '../core/SettingsManager.js';

export class CombatLogView {
    constructor(scene, x, topY, width, height) {
        this.scene = scene;
        this.baseX = x;
        this.anchorTopY = topY;
        this.width = width;
        this.maxHeight = 200;
        this.minHeight = 30;

        // Settings State
        this.isExpanded = false;
        this.currentHeight = this.minHeight;

        // New State
        this.fontSize = 14;
        this.isLocked = true;
        this.savedX = x;
        this.savedY = topY;

        this.lines = [];
        this.textObjects = [];
        this.totalTextHeight = 0;

        // Load Settings FIRST to apply position/font
        this.loadSettings();

        // Container
        this.container = this.scene.add.container(this.savedX, this.savedY);
        this.container.setDepth(2000); // Higher depth to stay on top of other UI

        // 1. Background
        this.bg = this.scene.add.rectangle(0, 0, this.width, this.currentHeight, 0x111111, 0.9)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x444444)
            .setInteractive();

        // 2. Header
        this.headerBg = this.scene.add.rectangle(0, 0, this.width, 30, 0x333333)
            .setOrigin(0, 0)
            .setInteractive(); // Draggable only if unlocked

        // Title
        this.headerText = this.scene.add.text(10, 8, 'COMBAT LOG', {
            font: 'bold 14px Arial',
            fill: '#ffffff'
        }).setOrigin(0, 0).setResolution(2);

        // --- HEADER BUTTONS ---

        // Lock / Unlock
        this.btnLock = this.createHeaderButton('🔒', -120, () => this.toggleLock());

        // Font Size - / +
        this.btnFontDown = this.createHeaderButton('A-', -80, () => this.changeFontSize(-2));
        this.btnFontUp = this.createHeaderButton('A+', -45, () => this.changeFontSize(2));

        // Collapse / Expand
        this.btnToggle = this.createHeaderButton(this.isExpanded ? '[-]' : '[+]', -10, () => this.toggleExpand());
        // Align from Right will be handled in updateLayout

        // Header Interaction (Drag)
        this.scene.input.setDraggable(this.headerBg);

        this.headerBg.on('drag', (pointer, dragX, dragY) => {
            if (this.isLocked) return;
            // dragX/Y are local to parent? No, for gameobject it's world.
            // Better to use raw pointer delta.

            this.container.x += (pointer.x - pointer.prevPosition.x);
            this.container.y += (pointer.y - pointer.prevPosition.y);

            // Constrain Y to not go off-top (prevent getting stuck under browser/game frame)
            if (this.container.y < 0) this.container.y = 0;

            // Optional: Constrain X well?
            // Let's safe-guard against losing it.
            const gameW = this.scene.scale.width;
            const gameH = this.scene.scale.height;

            // Keep at least 20px visible
            if (this.container.x < -this.width + 20) this.container.x = -this.width + 20;
            if (this.container.x > gameW - 20) this.container.x = gameW - 20;
            if (this.container.y > gameH - 30) this.container.y = gameH - 30;
        });

        this.headerBg.on('dragend', () => this.saveSettings());

        // Also click header to toggle? Maybe confusing if dragging.
        // Let's rely on Button for Toggle now, or double click?
        // Let's keep click on header for toggle ONLY if Locked.
        this.headerBg.on('pointerdown', () => {
            if (this.isLocked) {
                // But we have buttons now.
                // Maybe just rely on button.
            }
        });


        // 3. Content Container
        this.contentContainer = this.scene.add.container(0, 30);

        // Mask
        this.maskShape = this.scene.make.graphics();
        const mask = this.maskShape.createGeometryMask();
        this.contentContainer.setMask(mask);
        this.updateMask();

        // 4. Resize Handle (Bottom-Left Corner)
        this.resizeHandle = this.scene.add.graphics();
        this.resizeHandle.fillStyle(0x666666, 1);
        this.resizeZone = this.scene.add.rectangle(0, 0, 20, 20, 0xff0000, 0.0)
            .setOrigin(0, 1)
            .setInteractive({ useHandCursor: true, draggable: true });

        this.drawResizeHandle(this.resizeHandle);
        this.resizeHandleContainer = this.scene.add.container(0, 0, [this.resizeHandle, this.resizeZone]);

        // Add to Container
        this.container.add([
            this.bg,
            this.contentContainer,
            this.headerBg,
            this.headerText,
            this.btnLock, this.btnFontDown, this.btnFontUp, this.btnToggle,
            this.resizeHandleContainer
        ]);

        // --- Event Listeners ---
        this.bindEvents();
        this.bindResizeEvents();

        // GLOBAL VISIBILITY SETTING
        const shouldShow = settingsManager.get('showCombatLog', true);
        this.container.setVisible(shouldShow);

        // Scroll
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!this.container.visible) return; // Ignore if hidden
            if (!this.isExpanded) return;
            const bounds = this.bg.getBounds();
            if (bounds.contains(pointer.x, pointer.y)) {
                this.scroll(deltaY * 0.5);
            }
        });

        // Init Layout
        if (!this.isExpanded) {
            this.resize(this.width, this.minHeight);
            this.contentContainer.setVisible(false);
            this.resizeHandleContainer.setVisible(false);
        } else {
            this.updateLayout();
        }

        this.updateLockVisuals();
    }

    createHeaderButton(text, xOffsetFromRight, callback) {
        const btn = this.scene.add.text(this.width + xOffsetFromRight, 8, text, {
            font: 'bold 16px monospace', fill: '#cccccc'
        })
            .setOrigin(1, 0) // Anchor Right
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback)
            .on('pointerover', () => btn.setColor('#ffffff'))
            .on('pointerout', () => btn.setColor('#cccccc'));
        return btn;
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        this.updateLockVisuals();
        this.saveSettings();
    }

    updateLockVisuals() {
        this.btnLock.setText(this.isLocked ? '🔒' : '🔓');
        this.btnLock.setColor(this.isLocked ? '#cccccc' : '#00ff00');

        if (this.isLocked) {
            this.headerBg.setAlpha(0.2); // Dim header
            this.resizeHandleContainer.setVisible(false); // Hide resize
        } else {
            this.headerBg.setAlpha(0.5); // Highlight header as active zone
            if (this.isExpanded) this.resizeHandleContainer.setVisible(true); // Show resize only if expanded
        }
    }

    changeFontSize(delta) {
        this.fontSize = Phaser.Math.Clamp(this.fontSize + delta, 10, 24);
        this.render();
        this.saveSettings();
    }

    drawResizeHandle(graphics) {
        graphics.clear();
        graphics.fillStyle(0x444444, 1);
        graphics.beginPath();
        graphics.moveTo(0, 0);
        graphics.lineTo(15, 0);
        graphics.lineTo(0, -15);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(2, 0xaaaaaa, 0.8);
        graphics.beginPath();
        graphics.moveTo(3, -3);
        graphics.lineTo(6, 0);
        graphics.moveTo(6, -6);
        graphics.lineTo(12, 0);
        graphics.moveTo(9, -9);
        graphics.lineTo(18, 0);
        graphics.strokePath();
    }

    bindEvents() {
        this.addEntryBind = this.addEntry.bind(this);
        this.clearBind = this.clear.bind(this);
        EventBus.on('log:entry', this.addEntryBind);
        EventBus.on('log:clear', this.clearBind);

        // Toggle Visibility Setting
        this.toggleVisibilityBind = (isVisible) => {
            this.container.setVisible(isVisible);
        };
        EventBus.on('settings:toggle_combat_log', this.toggleVisibilityBind);
    }

    bindResizeEvents() {
        this.resizeZone.on('drag', (pointer, dragX, dragY) => {
            if (!this.isExpanded) return;
            const relY = pointer.worldY - this.container.y;
            const rightEdgeWorld = this.container.x + this.width;

            let newWidth = rightEdgeWorld - pointer.worldX;
            let newHeight = relY;

            newWidth = Phaser.Math.Clamp(newWidth, 250, 600);
            newHeight = Phaser.Math.Clamp(newHeight, 100, 800);

            this.width = newWidth;
            this.maxHeight = newHeight;
            this.currentHeight = newHeight;
            this.container.x = rightEdgeWorld - newWidth;

            this.updateLayout();
        });

        this.resizeZone.on('dragend', () => this.saveSettings());
    }

    toggleExpand() {
        this.isExpanded = !this.isExpanded;
        this.btnToggle.setText(this.isExpanded ? '[-]' : '[+]');

        if (this.isExpanded) {
            this.currentHeight = this.maxHeight;
            this.contentContainer.setVisible(true);
            this.resizeHandleContainer.setVisible(true);
        } else {
            this.currentHeight = this.minHeight;
            this.contentContainer.setVisible(false);
            this.resizeHandleContainer.setVisible(false);
        }

        this.updateLayout();
        this.saveSettings();
    }

    updateLayout() {
        // Update BG
        this.bg.setSize(this.width, this.currentHeight);

        // Update Header
        this.headerBg.setSize(this.width, 30);

        // Update Buttons Positions (Right Aligned)
        this.btnToggle.x = this.width - 10;
        this.btnFontUp.x = this.width - 45;
        this.btnFontDown.x = this.width - 80;
        this.btnLock.x = this.width - 120;

        // Update Handle Position (Bottom-Left)
        this.resizeHandleContainer.setPosition(0, this.currentHeight);

        // Update Mask
        this.updateMask();

        // Re-render text (width changed)
        this.render();
        this.scrollToBottom();
    }

    updateMask() {
        this.maskShape.clear();
        this.maskShape.fillStyle(0xffffff);
        this.maskShape.fillRect(this.container.x, this.container.y + 30, this.width, this.currentHeight - 30);
    }

    addEntry(entry) {
        if (!this.contentContainer || !this.scene) return;

        const colors = {
            'info': '#cccccc',
            'damage': '#ff6666',
            'heal': '#66ff66',
            'block': '#66ccff',
            'gold': '#ffd700',
            'turn': '#aaaaff',
            'relic': '#da70d6', // Orchid for Relics
            'combat': '#ffaa88',
            'warning': '#ffa500',
            'positive': '#00ff00',
            'negative': '#ff0000'
        };

        const color = colors[entry.type] || '#ffffff';
        // Simplified string construction
        const textStr = '> ' + entry.message;

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
            // Corrected font string syntax
            const fontStr = this.fontSize + 'px monospace';

            const t = this.scene.add.text(5, currentY, line.text, {
                font: fontStr,
                fill: line.color,
                wordWrap: { width: this.width - 10 }
            }).setResolution(2);
            this.contentContainer.add(t);
            this.textObjects.push(t);
            currentY += t.height + (this.fontSize * 0.2);
        });

        this.totalTextHeight = currentY;
    }

    resize(w, h) {
        this.width = w;
        this.currentHeight = h;
        this.updateLayout();
    }

    scroll(amount) {
        const visibleH = this.currentHeight - 30;
        if (this.totalTextHeight <= visibleH) {
            this.contentContainer.y = 30;
            return;
        }
        const minY = 30 - (this.totalTextHeight - visibleH);
        const maxY = 30;
        let newY = this.contentContainer.y - amount;
        newY = Phaser.Math.Clamp(newY, minY, maxY);
        this.contentContainer.y = newY;
    }

    scrollToBottom() {
        if (!this.isExpanded) return;
        const visibleH = this.currentHeight - 30;
        if (this.totalTextHeight > visibleH) {
            this.contentContainer.y = 30 - (this.totalTextHeight - visibleH);
        } else {
            this.contentContainer.y = 30;
        }
    }

    saveSettings() {
        const settings = {
            expanded: this.isExpanded,
            width: this.width,
            height: this.maxHeight,
            x: this.container.x,
            y: this.container.y,
            fontSize: this.fontSize,
            isLocked: this.isLocked
        };
        localStorage.setItem('rogue_match_log_settings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem('rogue_match_log_settings');
            if (raw) {
                const s = JSON.parse(raw);
                if (s.width) this.width = s.width;
                if (s.height) this.maxHeight = s.height;
                if (s.x !== undefined) this.savedX = s.x;
                if (s.y !== undefined) this.savedY = s.y;
                if (s.fontSize) this.fontSize = s.fontSize;
                if (s.isLocked !== undefined) this.isLocked = s.isLocked;

                this.isExpanded = !!s.expanded;
            }
        } catch (e) {
            console.error('Log Settings Load Error', e);
        }
    }

    destroy() {
        EventBus.off('log:entry', this.addEntryBind);
        EventBus.off('log:clear', this.clearBind);
        if (this.container) this.container.destroy();
        if (this.maskShape) this.maskShape.destroy();
    }
}


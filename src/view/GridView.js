/**
 * @file GridView.js
 * @description Manages the visual representation (Sprites) of the grid and user input.
 * @dependencies Phaser, EventBus, GridData
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, ENTITIES, GAME_SETTINGS } from '../core/Constants.js';

const DEBUG = false;

export class GridView {
    /**
     * @param {Phaser.Scene} scene 
     * @param {number} x - Center X position of the grid
     * @param {number} y - Center Y position of the grid
     */
    constructor(scene, x, y) {
        this.scene = scene;
        this.gridCenterX = x;
        this.gridCenterX = x;
        this.gridCenterY = y;
        this.tileSize = 60; // Reduced from 70 to fit 600px height with UI
        this.sprites = {}; // Map: id -> Phaser.GameObjects.Sprite

        this.isInputLocked = false;
        this.isAnimating = false;
        this.selectedTile = null; // {r, c, sprite}
        this.animatingIds = new Set(); // Track sprites being animated (e.g. matches) to prevent Sync destruction

        // Create Container for Sprites
        this.tokenContainer = this.scene.add.container(0, 0);
        this.tokenContainer.setDepth(1); // Ensure it's above background but below UI? UI is depth 100.

        // Create Mask
        // Grid Dimensions: cols * tileSize, rows * tileSize
        // Position: Top-Left of grid is (gridCenterX - width/2, gridCenterY - height/2)
        // Note: Using hardcoded logic from createGridVisuals is risky if params change. 
        // Better to create mask in createGridVisuals.

        this.bindEvents();

        // GLOBAL DEBUG INPUT
        this.scene.input.on('pointerdown', (pointer) => {
            console.log(`Global Click: WorldX=${pointer.worldX.toFixed(0)}, WorldY=${pointer.worldY.toFixed(0)}`);
            // Check against grid bounds
            const gridItemHeight = this.tileSize; // 60
            // Row 0 Y approx 140.
            // If user clicks 145, it is Row 0.
            // If user clicks 205, it is Row 1.
        });
    }

    bindEvents() {
        this.createGridVisualsBind = this.createGridVisuals.bind(this);
        this.animateSwapBind = this.animateSwap.bind(this);
        this.animateSwapRevertBind = this.animateSwapRevert.bind(this);
        this.animateMatchesBind = this.animateMatches.bind(this);
        this.animateGravityBind = this.animateGravity.bind(this);
        this.animateRefillBind = this.animateRefill.bind(this);

        EventBus.on(EVENTS.GRID_CREATED, this.createGridVisualsBind);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.animateSwapBind);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.animateSwapRevertBind);
        EventBus.on(EVENTS.MATCHES_FOUND, this.animateMatchesBind);
        EventBus.on(EVENTS.GRID_GRAVITY, this.animateGravityBind);
        EventBus.on(EVENTS.GRID_REFILLED, this.animateRefillBind);
    }

    destroy() {
        EventBus.off(EVENTS.GRID_CREATED, this.createGridVisualsBind);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.animateSwapBind);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.animateSwapRevertBind);
        EventBus.off(EVENTS.MATCHES_FOUND, this.animateMatchesBind);
        EventBus.off(EVENTS.GRID_GRAVITY, this.animateGravityBind);
        EventBus.off(EVENTS.GRID_REFILLED, this.animateRefillBind);

        if (this.tokenContainer) {
            this.tokenContainer.destroy();
        }

        if (this.refillTimer) {
            this.refillTimer.remove(false);
            this.refillTimer = null;
        }
    }

    createGridVisuals({ grid, rows, cols }) {
        this.rows = rows;
        this.cols = cols;

        // Calculate top-left offset to center the grid
        this.offsetX = this.gridCenterX - (cols * this.tileSize) / 2 + this.tileSize / 2;
        this.offsetY = this.gridCenterY - (rows * this.tileSize) / 2 + this.tileSize / 2;

        // Clear existing
        Object.values(this.sprites).forEach(s => s.destroy());
        this.sprites = {};

        // Create Items
        grid.forEach((row, r) => {
            row.forEach((item, c) => {
                this.createToken(r, c, item);
            });
        });

        // Setup Mask
        const width = this.cols * this.tileSize;
        const height = this.rows * this.tileSize;

        // Correct Top-Left calculation (border, not center of first tile)
        const startX = this.gridCenterX - (width / 2);
        const startY = this.gridCenterY - (height / 2);

        const shape = this.scene.make.graphics();
        shape.fillStyle(0xffffff);
        shape.fillRect(startX, startY, width, height);

        const mask = shape.createGeometryMask();
        this.tokenContainer.setMask(mask);
    }

    createToken(r, c, item) {
        const x = this.getX(c);
        const y = this.getY(r);

        const sprite = this.scene.add.sprite(x, y, item.type);
        this.tokenContainer.add(sprite); // Add to container for masking
        sprite.setDisplaySize(50, 50);
        sprite.setInteractive();
        sprite.setData('row', r);
        sprite.setData('col', c);
        sprite.setData('id', item.id);

        // Input Handling - Pass sprite only, so we read fresh data later
        sprite.on('pointerdown', () => this.handleInput(sprite));

        if (this.sprites[item.id]) {
            this.sprites[item.id].destroy();
            if (this.debugRects && this.debugRects[item.id]) {
                this.debugRects[item.id].destroy();
            }
        }
        this.sprites[item.id] = sprite;

        // DEBUG: Draw Hitbox
        if (DEBUG) {
            if (!this.debugRects) this.debugRects = {};
            const debugGraphics = this.scene.add.graphics();
            debugGraphics.lineStyle(2, 0xff0000);
            debugGraphics.strokeRect(x - 25, y - 25, 50, 50); // Assumes 50x50 display size
            this.tokenContainer.add(debugGraphics);
            this.debugRects[item.id] = debugGraphics;
        }
    }

    getX(col) {
        return this.offsetX + col * this.tileSize;
    }

    getY(row) {
        return this.offsetY + row * this.tileSize;
    }

    handleInput(sprite) {
        if (this.isInputLocked) {
            console.log('Input ignored: Locked');
            return;
        }
        if (window.combat && !window.combat.canInteract()) {
            console.log('Input ignored: Combat Turn/Moves');

            // Visual Feedback for No Moves
            if (window.combat.turn === ENTITIES.PLAYER && window.combat.currentMoves <= 0) {
                const text = this.scene.add.text(sprite.x, sprite.y - 40, "NO MOVES!", {
                    font: 'bold 24px Arial',
                    fill: '#ff0000',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5).setDepth(200);

                this.scene.tweens.add({
                    targets: text,
                    y: sprite.y - 80,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => text.destroy()
                });

                // Shake button hint
                if (window.combat.endTurnBtn) {
                    this.scene.tweens.killTweensOf(window.combat.endTurnBtn);
                    window.combat.endTurnBtn.setScale(1);

                    this.scene.tweens.add({
                        targets: window.combat.endTurnBtn,
                        scale: 1.2,
                        yoyo: true,
                        duration: 100,
                        repeat: 1,
                        onComplete: () => {
                            window.combat.endTurnBtn.setScale(1);
                        }
                    });
                }
            }
            return;
        }

        // READ FRESH COORDINATES
        const r = sprite.getData('row');
        const c = sprite.getData('col');
        const id = sprite.getData('id');

        console.log(`Clicked Item: ID=${id}, Row=${r}, Col=${c}, Type=${sprite.texture.key}`);

        if (!this.selectedTile) {
            // Select First
            this.selectedTile = { r, c, sprite };
            sprite.setAlpha(0.6); // Visual feedback
            console.log('Selected FIRST tile');
        } else {
            // Select Second
            const first = this.selectedTile;
            console.log(`Selected SECOND tile. First=${first.r},${first.c} Second=${r},${c}`);

            // If clicked same tile, deselect
            if (first.sprite === sprite) {
                console.log('Deselected (Sample Tile)');
                this.selectedTile = null;
                sprite.setAlpha(1);
                return;
            }

            this.selectedTile = null;
            first.sprite.setAlpha(1); // Reset feedback

            // Check adjacency
            const dist = Math.abs(first.r - r) + Math.abs(first.c - c);
            if (dist === 1) {
                // Execute Swap Logic
                console.log('Valid Swap. Executing...');
                this.isInputLocked = true;
                window.grid.swapItems(first.r, first.c, r, c);
            } else {
                // Clicked far away, select new
                console.log('Invalid Swap (Distance mismatch). New Selection.');
                this.selectedTile = { r, c, sprite };
                sprite.setAlpha(0.6);
            }
        }
    }

    async animateSwap({ r1, c1, r2, c2 }) {
        const item1 = window.grid.getItemAt(r2, c2); // Note: Logic already swapped, so check NEW positions
        const item2 = window.grid.getItemAt(r1, c1);

        // We need to find sprites by ID to be robust, or map from coords?
        // Let's rely on Logic data being updated.
        const gridItem1 = window.grid.grid[r1][c1];
        const gridItem2 = window.grid.grid[r2][c2];

        const sprite1 = this.sprites[gridItem1.id];
        const sprite2 = this.sprites[gridItem2.id];

        // Update internal data
        sprite1.setData('row', r1);
        sprite1.setData('col', c1);
        sprite2.setData('row', r2);
        sprite2.setData('col', c2);

        // Debug Rects
        const rect1 = (DEBUG && this.debugRects) ? this.debugRects[gridItem1.id] : null;
        const rect2 = (DEBUG && this.debugRects) ? this.debugRects[gridItem2.id] : null;

        // Tween
        this.scene.tweens.add({
            targets: sprite1,
            x: this.getX(c1),
            y: this.getY(r1),
            duration: 300,
            ease: 'Power2'
        });

        if (rect1) {
            // Graphics clears? No, graphics is absolute. Need to clear and redraw or move?
            // Graphics object position is 0,0 usually. We drew at X,Y.
            // Moving graphics object is easier if we drew at 0,0 and moved object.
            // But we drew at X,Y relative to 0,0 graphics object.
            // Actually, created new graphics for each token.
            // Let's destroy and redraw? Or just assume static for now?
            // Better: Move graphics object? 
            // In createToken: debugGraphics is at 0,0. Drawn at x,y.
            // We should have cleared and drawn at 0,0 and set x,y of graphics.
            // Let's fix createToken logic in next step or ignore movement for debug?
            // If debug doesn't move, it's confusing.

            // Tweens can't easily animate drawn shapes inside graphics unless we redraw in update.
            // Hack: Just hide them during animation or redraw at end?
            rect1.clear();
            rect1.lineStyle(2, 0xff0000);
            rect1.strokeRect(this.getX(c1) - 25, this.getY(r1) - 25, 50, 50);

            // This won't animate. It will jump. That's fine for debug.
        }
        if (rect2) {
            rect2.clear();
            rect2.lineStyle(2, 0xff0000);
            rect2.strokeRect(this.getX(c2) - 25, this.getY(r2) - 25, 50, 50);
        }

        this.scene.tweens.add({
            targets: sprite2,
            x: this.getX(c2),
            y: this.getY(r2),
            duration: 300,
            ease: 'Power2'
        });
    }

    animateSwapRevert({ r1, c1, r2, c2 }) {
        const gridItem1 = window.grid.grid[r1][c1];
        const gridItem2 = window.grid.grid[r2][c2];

        const sprite1 = this.sprites[gridItem1.id];
        const sprite2 = this.sprites[gridItem2.id];

        // Update internal data (Restore original positions)
        sprite1.setData('row', r1);
        sprite1.setData('col', c1);
        sprite2.setData('row', r2);
        sprite2.setData('col', c2);

        // Tween back
        this.scene.tweens.add({
            targets: sprite1,
            x: this.getX(c1),
            y: this.getY(r1),
            duration: 300,
            ease: 'Power2'
        });

        this.scene.tweens.add({
            targets: sprite2,
            x: this.getX(c2),
            y: this.getY(r2),
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.isInputLocked = false; // Unlock input
                this.syncVisuals(); // Safety sync
            }
        });
    }

    setSkipMode(enabled) {
        this.skipMode = enabled;
        if (enabled) {
            this.skipAnimations();
        }
    }

    animateMatches({ matches }) {
        if (!this.scene || !this.scene.sys) return;
        // If skipping, destroy instantly
        if (this.skipMode) {
            matches.forEach(coord => {
                const currentItem = window.grid.grid[coord.r][coord.c];
                if (currentItem && this.sprites[currentItem.id]) {
                    this.sprites[currentItem.id].destroy();
                    delete this.sprites[currentItem.id];
                }
            });
            return;
        }

        this.isInputLocked = true; // Lock

        matches.forEach(coord => {
            const currentItem = window.grid.grid[coord.r][coord.c];

            if (currentItem && this.sprites[currentItem.id]) {
                const sprite = this.sprites[currentItem.id];
                const id = currentItem.id;
                this.animatingIds.add(id);

                this.scene.tweens.add({
                    targets: sprite,
                    scaleX: 0,
                    scaleY: 0,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        this.animatingIds.delete(id);
                        if (this.sprites[id]) {
                            this.sprites[id].destroy();
                            delete this.sprites[id];
                        }
                    }
                });
            }
        });
    }

    animateGravity({ moves }) {
        if (!this.scene || !this.scene.sys) return;
        if (this.skipMode) {
            moves.forEach(move => {
                const sprite = this.sprites[move.id];
                if (sprite) {
                    sprite.setData('row', move.toRow);
                    sprite.setData('col', move.toCol);
                    sprite.y = this.getY(move.toRow); // Snap
                }
            });
            return;
        }

        // moves: [{ id, fromRow, fromCol, toRow, toCol }]
        moves.forEach(move => {
            const sprite = this.sprites[move.id];
            if (sprite) {
                // Update internal data
                sprite.setData('row', move.toRow);
                sprite.setData('col', move.toCol);

                this.scene.tweens.add({
                    targets: sprite,
                    y: this.getY(move.toRow),
                    duration: 400,
                    ease: 'Bounce.easeOut', // Fun bounce
                    delay: 200 // Wait for match disappear
                });
            }
        });
    }

    animateRefill({ newItems }) {
        if (!this.scene || !this.scene.sys) return;
        if (this.skipMode) {
            newItems.forEach(entry => {
                const { item, row, col } = entry;
                const targetY = this.getY(row);
                const x = this.getX(col);

                const sprite = this.scene.add.sprite(x, targetY, item.type);
                this.tokenContainer.add(sprite);
                sprite.setDisplaySize(50, 50);
                sprite.setInteractive();
                sprite.setData('row', row);
                sprite.setData('col', col);
                sprite.setData('id', item.id);

                sprite.on('pointerdown', () => this.handleInput(sprite));

                if (this.sprites[item.id]) this.sprites[item.id].destroy();
                this.sprites[item.id] = sprite;
            });
            return;
        }

        // newItems: [{ item, row, col }]
        newItems.forEach(entry => {
            const { item, row, col } = entry;

            // Spawn ABOVE the grid (at negative row)
            const startY = this.getY(-2);
            const targetY = this.getY(row);
            const x = this.getX(col);

            const sprite = this.scene.add.sprite(x, startY, item.type);
            this.tokenContainer.add(sprite);
            sprite.setDisplaySize(50, 50);
            sprite.setInteractive();
            sprite.setData('row', row);
            sprite.setData('col', col);
            sprite.setData('id', item.id);

            // Input Handling
            sprite.on('pointerdown', () => this.handleInput(sprite));

            if (this.sprites[item.id]) {
                this.sprites[item.id].destroy();
            }
            this.sprites[item.id] = sprite;

            // Drop Animation
            this.scene.tweens.add({
                targets: sprite,
                y: targetY,
                duration: 500,
                ease: 'Bounce.easeOut',
                delay: 400 + (row * 50) // Cascade effect
            });
        });

        // Unlock input after everything settles
        if (this.refillTimer) this.refillTimer.remove();
        this.refillTimer = this.scene.time.delayedCall(1200, () => {
            // Perform a self-healing sync to ensure no ghosts exist
            this.syncVisuals();
            this.isInputLocked = false;
            this.refillTimer = null;
        });
    }

    /**
     * Instantly finish all grid animations and sync state.
     */
    skipAnimations() {
        if (!this.scene || !this.scene.sys) return;
        console.log('Skipping/Fast-forwarding animations...');

        // Kill all tweens on sprites
        Object.values(this.sprites).forEach(sprite => {
            this.scene.tweens.killTweensOf(sprite);
        });

        // Kill refill timer
        if (this.refillTimer) {
            this.refillTimer.remove(false);
            this.refillTimer = null;
        }

        // Force Sync immediately
        this.syncVisuals();
        this.isInputLocked = false;
    }

    syncVisuals() {
        if (!this.scene || !this.scene.sys) return;
        console.log('Syncing Visuals...');
        const logicGrid = window.grid.grid;
        const validIds = new Set();
        const occupiedCells = {}; // "r,c" -> itemId

        // 1. Validate Logic
        logicGrid.forEach((row, r) => {
            row.forEach((item, c) => {
                if (item.type !== 'EMPTY') {
                    validIds.add(item.id);
                    occupiedCells[`${r},${c}`] = item.id;

                    // Ensure sprite exists
                    if (!this.sprites[item.id]) {
                        console.log(`Sync: Creating missing sprite ${item.id} at ${r},${c}`);
                        this.createToken(r, c, item);
                    }

                    const sprite = this.sprites[item.id];
                    sprite.setAlpha(1); // Ensure visible
                    sprite.setDisplaySize(50, 50); // Reset size correctly (Do NOT use setScale(1) if texture is large)

                    // Fix Data (Logic is truth)
                    sprite.setData('row', r);
                    sprite.setData('col', c);

                    // Fix Position
                    const expectedX = this.getX(c);
                    const expectedY = this.getY(r);

                    if (Math.abs(sprite.x - expectedX) > 2 || Math.abs(sprite.y - expectedY) > 2) {
                        // console.log(`Sync: Correcting sprite pos ${item.id}.`);
                        sprite.x = expectedX;
                        sprite.y = expectedY;
                    }
                }
            });
        });

        // 2. Destroy Orphans and Ghosts
        Object.keys(this.sprites).forEach(id => {
            // Check validity (Loose equality for string/number safety)
            let isValid = false;
            // Iterate Set to check (safer than cast sometimes)
            if (validIds.has(id) || validIds.has(Number(id)) || validIds.has(String(id))) {
                isValid = true;
            }

            if (!isValid) {
                // Protect animating sprites (e.g. dying matches)
                if (this.animatingIds.has(id)) {
                    // console.log(`Sync: Skipping destruction of animating sprite ${id}`);
                    return;
                }

                console.log(`Sync: Destroying Orphan Sprite ${id}`);
                this.sprites[id].destroy();
                if (this.debugRects && this.debugRects[id]) this.debugRects[id].destroy();
                delete this.sprites[id];
            }
        });
    }
}

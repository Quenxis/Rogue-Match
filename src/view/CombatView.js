/**
 * @file CombatView.js
 * @description Manages all UI/Visuals for combat (Observer Pattern). Decoupled from logic.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, ASSETS, SKILLS, SKILL_DATA, ENTITIES, STATUS_TYPES, GAME_SETTINGS } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { RichTextHelper } from './RichTextHelper.js';

export class CombatView {
    constructor(scene, combatManager) {
        this.scene = scene;
        this.combatManager = combatManager; // Command Pattern: Only for invoking actions!

        this.centerText = null;
        this.skillButtons = {};
        this.endTurnBtn = null;
        this.heroSprite = null;
        this.enemySprite = null;
        this.playerHPBar = null;
        this.enemyHPBar = null;
        this.actionBar = null;
        this.tooltipContainer = null;
        this.intentContainer = null;

        // Visual State
        this.currentTurn = ENTITIES.PLAYER;

        // Animation Queue Logic
        this.animationQueue = [];
        this.isAnimating = false;

        this.createUI();
        this.bindEvents();
    }

    /**
     * Queues an animation function to be played sequentially.
     * @param {Function} animationTask - Function that accepts a 'done' callback.
     */
    queueAnimation(animationTask) {
        this.animationQueue.push(animationTask);
        this.processQueue();
    }

    processQueue() {
        if (this.isAnimating) return;
        if (this.animationQueue.length === 0) return;

        this.isAnimating = true;
        const nextTask = this.animationQueue.shift();

        // Execute task, passing a callback to signal completion
        nextTask(() => {
            this.isAnimating = false;
            // Small delay between animations for clarity?
            // this.scene.time.delayedCall(50, () => this.processQueue());
            this.processQueue();
        });
    }

    bindEvents() {
        this.updateUIBind = this.updateUI.bind(this);
        this.showNotificationBind = (data) => this.showNotification(data.text, data.color);

        // Store references for cleanup
        // Store references for cleanup
        this.onPlayerAttack = (data) => {
            if (data && data.skipAnimation) return; // Skip lunge if requested
            this.queueAnimation(done => this.animateAttack(this.heroSprite, this.enemySprite, 50, 0xff0000, done));
        };
        this.onEnemyAttack = (data) => {
            const damage = data ? (data.damage || 0) : 0;
            const tint = damage > 0 ? 0xff0000 : 0x888888; // Red if dmg, Gray if blocked
            this.queueAnimation(done => this.animateAttack(this.enemySprite, this.heroSprite, -50, tint, done));
        };
        this.onPlayerDefend = () => {
            this.queueAnimation(done => this.animateDefend(this.heroSprite, done));
        };
        this.onPlayerHeal = (data) => {
            if (data && data.skipAnimation) return;
            this.queueAnimation(done => this.animateHeal(this.heroSprite, done));
        };
        this.onEnemyDefend = () => {
            this.queueAnimation(done => this.animateDefend(this.enemySprite, done));
        };
        this.onEnemyHeal = () => {
            this.queueAnimation(done => this.animateHeal(this.enemySprite, done));
        };

        EventBus.on(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.on(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        this.onEnemyLock = (data) => {
            // data contains { value, targets }
            this.queueAnimation(done => this.animateGridLock(done, data.targets));
        };
        this.onEnemyTrash = () => {
            this.queueAnimation(done => this.animateGridShake(done));
        };
        this.onToxinApplied = () => {
            this.queueAnimation(done => this.animateToxicApply(this.enemySprite, done));
        };
        this.onOutbreakCast = (data) => {
            this.queueAnimation(done => this.animateOutbreak(data, done));
        };
        this.onExtractionCast = (data) => {
            this.queueAnimation(done => this.animateExtraction(data, done));
        };
        this.onPrismaticResonance = (data) => {
            this.queueAnimation(done => this.animatePrismaticResonance(data, done));
        };
        EventBus.on('enemy:prismatic_resonance', this.onPrismaticResonance);

        this.onVisualShake = (data) => {
            if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                this.scene.cameras.main.shake(data.duration || 300, data.intensity || 0.01);
            }
        };
        EventBus.on('visual:shake', this.onVisualShake);

        this.onManaDevour = (data) => {
            this.queueAnimation(done => this.animateManaDevour(data, done));
        };
        EventBus.on('enemy:mana_devour', this.onManaDevour);


        EventBus.on(EVENTS.PLAYER_ATTACK, this.onPlayerAttack);
        EventBus.on(EVENTS.ENEMY_ATTACK, this.onEnemyAttack);
        EventBus.on(EVENTS.PLAYER_DEFEND, this.onPlayerDefend);
        EventBus.on(EVENTS.PLAYER_HEAL, this.onPlayerHeal);
        EventBus.on(EVENTS.ENEMY_DEFEND, this.onEnemyDefend);
        EventBus.on(EVENTS.ENEMY_HEAL, this.onEnemyHeal);
        EventBus.on(EVENTS.ENEMY_LOCK, this.onEnemyLock);
        EventBus.on(EVENTS.ENEMY_TRASH, this.onEnemyTrash);
        EventBus.on(EVENTS.TOXIN_APPLIED, this.onToxinApplied);
        EventBus.on(EVENTS.OUTBREAK_CAST, this.onOutbreakCast);
        EventBus.on(EVENTS.EXTRACTION_CAST, this.onExtractionCast);
    }

    destroy() {
        // 1. Unbind Events
        EventBus.off(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.off(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
        EventBus.off(EVENTS.PLAYER_ATTACK, this.onPlayerAttack);
        EventBus.off(EVENTS.ENEMY_ATTACK, this.onEnemyAttack);
        EventBus.off(EVENTS.PLAYER_DEFEND, this.onPlayerDefend);
        EventBus.off(EVENTS.PLAYER_HEAL, this.onPlayerHeal);
        EventBus.off(EVENTS.ENEMY_DEFEND, this.onEnemyDefend);
        EventBus.off(EVENTS.ENEMY_HEAL, this.onEnemyHeal);
        EventBus.off(EVENTS.ENEMY_LOCK, this.onEnemyLock);
        EventBus.off(EVENTS.ENEMY_TRASH, this.onEnemyTrash);
        EventBus.off('enemy:prismatic_resonance', this.onPrismaticResonance);
        EventBus.off('visual:shake', this.onVisualShake);
        EventBus.off('enemy:mana_devour', this.onManaDevour);

        // 2. Destroy UI Elements
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();
        if (this.heroSprite) this.heroSprite.destroy();
        if (this.enemySprite) this.enemySprite.destroy();
        if (this.actionBar) this.actionBar.destroy();
        if (this.tooltipContainer) this.tooltipContainer.destroy();
        if (this.intentContainer) this.intentContainer.destroy();
        if (this.movesText) this.movesText.destroy();

        // HP Bars (Complex objects)
        if (this.playerHPBar) this.playerHPBar.container.destroy();
        if (this.enemyHPBar) this.enemyHPBar.container.destroy();

        this.skillButtons = {};
    }

    createUI() {
        // Layout Constants (Dynamic 1080p)
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;
        const centerX = w * 0.5;
        const centerY = h * 0.5;

        // Ground/Entity Level (Approx 70% down)
        this.groundY = h * 0.72;

        // Entity Positions
        this.leftX = w * 0.18;  // Player
        this.rightX = w * 0.82; // Enemy (Symmetrical to 0.19)

        // 1. Entities & HUD (HP, Shield, Status)
        this.createEntityDisplay(true);  // Player
        this.createEntityDisplay(false); // Enemy

        // 2. Action Bar (Mana + Skills) - Bottom Center
        this.createActionBar(centerX, h * 0.85);

        // 3. Turn Controls (Moves + End Turn) - Bottom Right
        this.createTurnControls(w * 0.9, h * 0.85);

        // Center Notification
        this.centerText = this.scene.add.text(centerX, centerY, '', {
            font: 'bold 60px Arial', // Larger font for 1080p
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false).setResolution(2);

        // --- TOOLTIP ---
        this.createTooltip();
    }

    createTooltip() {
        this.tooltipContainer = this.scene.add.container(0, 0).setDepth(2000).setVisible(false);
        this.tooltipBg = this.scene.add.rectangle(0, 0, 200, 100, 0x000000, 0.9).setOrigin(0, 0);
        this.tooltipContainer.add(this.tooltipBg);
    }

    showTooltip(x, y, text) {
        // Clear previous content (except BG)
        this.tooltipContainer.each(child => {
            if (child !== this.tooltipBg) child.destroy();
        });

        // Use Helper with Defaults but enforce wrapping
        const { width, height } = RichTextHelper.renderRichText(
            this.scene,
            this.tooltipContainer,
            text,
            { maxWidth: 320 } // Wrap earlier to avoid huge wide lines
        );

        this.tooltipBg.setSize(width, height);

        // --- SMART POSITIONING ---
        const screenW = this.scene.scale.width;
        const screenH = this.scene.scale.height;

        let finalX = x;
        let finalY = y;

        // 1. Horizontal Clamp
        if (finalX + width > screenW) {
            finalX = screenW - width - 10; // Align with right edge
        }
        if (finalX < 10) {
            finalX = 10; // Align with left edge
        }

        // 2. Vertical Clamp (Flip if bottom overflow)
        if (finalY + height > screenH) {
            // Try flipping up instead of just clamping
            // Assuming 'y' was top-left, we might want to put it ABOVE the cursor/target
            // But we don't know the target height here easily unless passed.
            // Check if we can move it UP by height.
            finalY = y - height - 20;

            // If still out of bounds (top), just clamp to bottom
            if (finalY < 0) {
                finalY = screenH - height - 10;
            }
        }

        this.tooltipContainer.setPosition(finalX, finalY);
        this.tooltipContainer.setVisible(true);
    }

    hideTooltip() {
        if (this.tooltipContainer) {
            this.tooltipContainer.setVisible(false);
        }
    }

    createEntityDisplay(isPlayer) {
        const x = isPlayer ? this.leftX : this.rightX;
        // fetch selected hero ID or default to warrior
        const heroId = runManager.selectedHeroId || 'warrior';
        const config = isPlayer ? (HEROES[heroId] || HEROES['warrior']) : (ENEMIES['slime'] || {}); // Placeholder config

        // 1. Sprite
        let sprite;
        const maxDim = 410; // Increased sprite size (was 300/350)

        if (isPlayer) {
            const textureKey = config.texture || ASSETS.HERO;
            if (this.scene.textures.exists(textureKey)) {
                sprite = this.scene.add.image(x, this.groundY, textureKey);
                sprite.setOrigin(0.5, 1);
                this.fitSprite(sprite, maxDim, maxDim, config.scale || 1);
                sprite.y += (config.yOffset || 0);
                sprite.x += (config.xOffset || 0);
            } else {
                sprite = this.scene.add.rectangle(x, this.groundY - 50, 100, 100, 0x6666ff);
            }
            this.heroSprite = sprite;
        } else {
            sprite = this.scene.add.sprite(x, this.groundY, ASSETS.ENEMY_PLACEHOLDER);
            sprite.setOrigin(0.5, 1);
            this.fitSprite(sprite, maxDim, maxDim);
            this.enemySprite = sprite;

            // --- INTENT DISPLAY (Above Enemy Head) ---
            // Calculate top of sprite approx
            const spriteTop = this.groundY - (sprite.displayHeight || 200);
            const intentY = spriteTop - 10; // Moved UP above the head (was +90 overlapping)

            this.intentContainer = this.scene.add.container(x, intentY);
            this.intentContainer.setDepth(150);

            // Icon (Larger)
            this.intentIcon = this.scene.add.image(0, 0, ASSETS.ICON_SWORD).setDisplaySize(48, 48).setOrigin(0.5);
            this.intentIcon.setInteractive({ useHandCursor: true });

            // Tooltip on hover
            this.intentIcon.on('pointerover', (pointer) => {
                if (this.currentIntentTooltip) {
                    this.showTooltip(pointer.x, pointer.y, this.currentIntentTooltip);
                }
            });
            this.intentIcon.on('pointerout', () => this.hideTooltip());
            this.intentIcon.on('pointermove', (pointer) => {
                if (this.tooltipContainer && this.tooltipContainer.visible) {
                    this.tooltipContainer.setPosition(pointer.x, pointer.y - 25);
                }
            });

            // Value Text (next to icon)
            this.intentText = this.scene.add.text(28, 0, '', {
                font: 'bold 24px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0, 0.5).setResolution(2);

            this.intentContainer.add([this.intentIcon, this.intentText]);
        }
        sprite.setDepth(100);

        // 2. HP Bar & Overlay (Moved BELOW sprite)
        // groundY is where feet are. Move down by ~20px padding.
        const barY = this.groundY + 30;
        const barObj = this.createHealthBar(x, barY, 250, 30, 0xff4444, isPlayer); // Even larger bars

        if (isPlayer) this.playerHPBar = barObj;
        else this.enemyHPBar = barObj;
    }

    createActionBar(x, y) {
        // Position: Align Left with Grid
        // Grid is approx 600px wide centered at screen width/2 (960). 
        // Left edge ~= 960 - 300 = 660.
        // We want the Mana Crystal (which is at -40 relative) to start roughly there.
        // So Container X = 660 + 50 = 710.

        const gridLeftX = this.scene.scale.width / 2 - 320; // Approx left edge of grid frame
        const bottomY = this.scene.scale.height - 140; // Lowered (was -150)

        this.actionBar = this.scene.add.container(gridLeftX, bottomY);
        this.actionBar.setDepth(100);

        // Mana
        // Mana (Text centered ON the crystal)
        if (this.scene.textures.exists(ASSETS.ICON_MANA)) {
            this.manaIcon = this.scene.add.image(-40, 0, ASSETS.ICON_MANA).setDisplaySize(80, 80).setOrigin(0.5);
        } else {
            this.manaIcon = this.scene.add.text(-40, 0, '💎', { fontSize: '64px' }).setOrigin(0.5);
        }

        this.manaText = this.scene.add.text(-40, 0, '0', {
            font: 'bold 32px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.actionBar.add([this.manaIcon, this.manaText]);

        // --- SPELL ICONS ---
        // Dynamically create icons based on Player Deck
        const deck = runManager.player.deck || [];
        deck.forEach((skillId, index) => {
            const xPos = 80 + (index * 170); // Dynamic Spacing (80, 250, 420...)
            this.createSpellIcon(skillId, xPos, 0);
        });
    }







    createTurnControls(x, y) {


        // Moves Counter
        this.movesText = this.scene.add.text(x - 140, y, 'Moves: 3/3', {
            font: '24px Arial', fill: '#ffffff' // Larger Font
        }).setOrigin(1, 0.5).setDepth(100).setResolution(2);

        // End Turn Button
        this.endTurnBtn = this.scene.add.text(x, y, 'END TURN', {
            font: 'bold 24px Arial', // Larger Font
            fill: '#ffffff',
            backgroundColor: '#cc0000',
            padding: { x: 30, y: 16 } // Larger Padding
        })
            .setOrigin(0.5)
            .setResolution(2)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.combatManager.endTurn())
            .setDepth(100);

        this.endTurnBtn.on('pointerover', () => this.endTurnBtn.setTint(0xffcccc));
        this.endTurnBtn.on('pointerout', () => this.endTurnBtn.clearTint());
    }

    createHealthBar(x, y, width, height, color, isPlayer = false) {
        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff);

        // Fill
        const fill = this.scene.add.rectangle(-width / 2 + 2, 0, width - 4, height - 4, color).setOrigin(0, 0.5);

        // --- SHIELD OVERLAY ---
        // Blue outline around bar + icon
        const shieldRect = this.scene.add.rectangle(0, 0, width + 4, height + 4, 0x000000, 0).setOrigin(0.5);
        shieldRect.setStrokeStyle(3, 0x33ccff); // Blue Glow
        shieldRect.setVisible(false);

        // Position shield icon: RIGHT for player, LEFT for enemy
        const shieldX = isPlayer ? (width / 2 + 25) : (-width / 2 - 25);
        const shieldIcon = this.scene.add.image(shieldX, 0, ASSETS.ICON_SHIELD).setDisplaySize(48, 48).setOrigin(0.5);
        shieldIcon.setVisible(false);

        const shieldText = this.scene.add.text(shieldX, 0, '0', {
            font: 'bold 20px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setResolution(2).setVisible(false);

        // --- STATUS LINE ---
        // Below the bar
        const statusContainer = this.scene.add.container(0, height + 10);

        // Text
        // Text
        const text = this.scene.add.text(0, 0, '', {
            font: 'bold 20px Arial', // Larger Font for HP
            fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setResolution(2);

        container.add([bg, fill, text, shieldRect, shieldIcon, shieldText, statusContainer]);

        return {
            container, fill, text, maxWidth: width - 4, currentVal: -1,
            shieldRect, shieldIcon, shieldText, statusContainer
        };
    }

    updateHealthBar(bar, current, max, block = 0, statusManager = null) {
        if (!bar) return;

        // Text
        bar.text.setText(`${current}/${max}`);

        // Animation
        if (bar.currentVal !== current) {
            bar.currentVal = current;
            const percent = Math.max(0, Math.min(1, current / max));
            const newWidth = bar.maxWidth * percent;

            this.scene.tweens.add({
                targets: bar.fill,
                width: newWidth,
                duration: 300,
                ease: 'Power2'
            });
        }

        // --- SHIELD OVERLAY ---
        if (block > 0) {
            bar.shieldRect.setVisible(true);
            bar.shieldIcon.setVisible(true);
            bar.shieldText.setVisible(true).setText(`${block}`);
        } else {
            bar.shieldRect.setVisible(false);
            bar.shieldIcon.setVisible(false);
            bar.shieldText.setVisible(false);
        }

        // --- STATUS ICONS ---
        if (bar.statusContainer && statusManager) {
            bar.statusContainer.removeAll(true);

            // Get simplified items { icon, text } from helper
            // We need to adapt getStatusItems to return data, not just text strings if we want custom rendering
            // For now, let's parse the Emoji text or update getStatusItems. 
            // Better: update getStatusItems below to return objects.

            const items = this.getStatusItemsData(statusManager);
            // console.log(`[CombatView] updating status for ${bar === this.playerHPBar ? 'Player' : 'Enemy'}. Items:`, items);

            let xPos = -130; // Left align relative to center (width increased)
            const yPos = 5;
            const spacing = 50; // Increased Status Spacing

            if (items.length > 0) {
                // console.log(`[CombatView] Rendering ${items.length} status icons.`);
            }

            items.forEach(item => {
                // Icon (Emoji or Sprite)
                const icon = this.scene.add.text(xPos, yPos, item.icon, { font: '28px Verdana' }).setOrigin(0, 0.5);

                if (item.color) {
                    // setColor is often ignored for Emojis. setTint forces a color multiplication.
                    // We parse the hex string to a number for setTint
                    const colorNum = parseInt(item.color.replace('#', '0x'));
                    icon.setTint(colorNum);
                }

                icon.setInteractive({ useHandCursor: true });

                // Tooltip on hover
                icon.on('pointerover', (pointer) => {
                    this.showTooltip(pointer.x, pointer.y, item.tooltip || item.icon);
                });
                icon.on('pointerout', () => this.hideTooltip());
                icon.on('pointermove', (pointer) => {
                    if (this.tooltipContainer && this.tooltipContainer.visible) {
                        this.tooltipContainer.setPosition(pointer.x, pointer.y - 25);
                    }
                });

                bar.statusContainer.add(icon);

                // Counter -- Only add if count is present
                if (item.count !== '' && item.count !== undefined && item.count !== null) {
                    const counter = this.scene.add.text(xPos + 18, yPos + 8, `${item.count}`, {
                        font: 'bold 16px Verdana', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
                    }).setOrigin(0.5);
                    bar.statusContainer.add(counter);
                }

                xPos += spacing;
            });
        }
    }

    animateButton(btn) {
        if (!btn || !btn.active || !this.scene) return;
        this.scene.tweens.killTweensOf(btn);
        btn.setScale(1);
        this.scene.tweens.add({
            targets: btn,
            scale: 0.9,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                if (btn && btn.active) btn.setScale(1);
            }
        });
    }

    /**
     * @param {Object} state - { player, enemy, turn, currentMoves, maxMoves }
     */
    updateUI(state) {
        if (!state) return;
        const { player, enemy, turn, currentMoves, maxMoves } = state;
        this.currentTurn = turn;

        // Update TopBar
        EventBus.emit(EVENTS.UI_REFRESH_TOPBAR);

        // --- PLAYER HUD ---
        if (this.playerHPBar) {
            this.updateHealthBar(this.playerHPBar, player.currentHP, player.maxHP, player.block, player.statusManager);
        }

        // --- ENEMY HUD ---
        // Update Sprite if needed (texture switch + sizing)
        if (enemy && enemy.name) {
            const foundId = Object.keys(ENEMIES).find(key => ENEMIES[key].name === enemy.name);
            if (foundId) {
                const data = ENEMIES[foundId];
                const texture = data ? data.texture : null;
                const customScale = (data && data.scale) ? data.scale : 1;
                const yOffset = (data && data.yOffset) ? data.yOffset : 0;
                const xOffset = (data && data.xOffset) ? data.xOffset : 0;

                if (texture && this.scene.textures.exists(texture)) {
                    this.enemySprite.setTexture(texture);
                    this.fitSprite(this.enemySprite, 350, 280, customScale);

                    this.enemySprite.y = this.groundY + yOffset;
                    this.enemySprite.x = this.rightX + xOffset;
                }
            }
        }

        if (this.enemyHPBar) {
            this.updateHealthBar(this.enemyHPBar, enemy.currentHP, enemy.maxHP, enemy.block, enemy.statusManager);
        }

        // --- ENEMY INTENT ---
        if (this.intentContainer && enemy) {
            const intent = enemy.currentIntent;
            if (intent) {
                this.intentContainer.setVisible(true);

                // Update Icon based on type
                let iconKey = ASSETS.ICON_SWORD; // Default: Attack
                let tintColor = 0xff4444; // Red for attack
                let tooltipText = intent.text || 'Attack'; // Dynamic from Data

                // Ensure Intent Emoji exists
                if (!this.intentEmoji) {
                    this.intentEmoji = this.scene.add.text(0, -5, '', { fontSize: '48px' }).setOrigin(0.5);
                    this.intentContainer.add(this.intentEmoji);
                    this.intentEmoji.setInteractive({ useHandCursor: true });
                    this.intentEmoji.on('pointerover', () => {
                        if (this.currentIntentTooltip) {
                            this.showTooltip(this.intentContainer.x, this.intentContainer.y - 60, this.currentIntentTooltip);
                        }
                    });
                    this.intentEmoji.on('pointerout', () => this.hideTooltip());
                }

                if (intent.type === 'DEFEND' || intent.type === 'BLOCK') {
                    // Reset Layout
                    this.intentText.x = 28;
                    if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false);
                    this.intentIcon.x = 0;

                    iconKey = ASSETS.ICON_SHIELD;
                    tintColor = 0x44aaff; // Blue
                    tooltipText = intent.text || 'Defend';
                    this._showIntentIcon(iconKey, tintColor);
                } else if (intent.type === 'BUFF') {
                    // Reset Layout
                    this.intentText.x = 28;
                    if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false);
                    this.intentIcon.x = 0;

                    if (intent.effect === 'STRENGTH') {
                        this.intentIcon.setVisible(false);
                        this.intentEmoji.setVisible(true).setText('💪');
                        tooltipText = intent.text || `Increase Strength`;
                    } else {
                        iconKey = ASSETS.ICON_SWORD;
                        tintColor = 0xffaa44; // Orange
                        tooltipText = intent.text || intent.effect || 'Buff';
                        this._showIntentIcon(iconKey, tintColor);
                    }
                } else if (intent.type === 'DEBUFF') {
                    // Reset Layout Defaults
                    this.intentText.x = 28;
                    if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false);
                    this.intentIcon.x = 0;

                    this._showIntentIcon(iconKey, tintColor); // Reset defaults
                    // Specific icons for Lock and Trash - no tint, use icon as-is
                    if (intent.effect === 'LOCK') {
                        iconKey = ASSETS.ICON_LOCK;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = intent.text || 'Lock';
                        this._showIntentIcon(iconKey, tintColor);
                    } else if (intent.effect === 'TRASH') {
                        iconKey = ASSETS.ICON_TRASH;
                        tintColor = null; // No tint - use original icon colors
                        tooltipText = intent.text || 'Trash';
                        this._showIntentIcon(iconKey, tintColor);
                    } else if (intent.effect === 'MANA_DEVOUR') {
                        // Mana Devour Visuals
                        this.intentIcon.setVisible(false);
                        if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false); // Double verify
                        this.intentEmoji.setVisible(true).setText('🧿'); // Eye/Void

                        // Dynamic Tooltip (Refactored to Data)
                        if (intent.dynamicTooltip && enemy.manaDevourConfig) {
                            tooltipText = intent.dynamicTooltip(enemy.manaDevourConfig);
                        } else {
                            tooltipText = intent.text || 'Mana Devour';
                        }

                        this.intentText.x = 35; // Slight adjustment for Emoji
                    } else {
                        iconKey = ASSETS.ICON_MANA;
                        tintColor = 0xaa44ff;
                        tooltipText = intent.text || intent.effect || 'Debuff';
                        this._showIntentIcon(iconKey, tintColor);
                    }
                } else {
                    // Attack
                    if (intent.effect === 'SHUFFLE') {
                        // T1 Earthquake specific visual
                        this.intentIcon.setVisible(false);
                        this.intentEmoji.setVisible(true).setText('🌋');
                        this.intentEmoji.x = 0; // Reset
                        this.intentText.x = 35; // Slight adjust for emoji width
                        tooltipText = intent.text || 'Earthquake';
                        if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false);
                    } else if (intent.effect === 'MANA_CONVERT') {
                        // T3 Prismatic Resonance: Sword + Mana Icon

                        // 1. Ensure Secondary Icon Exists
                        if (!this.intentIconSecondary) {
                            this.intentIconSecondary = this.scene.add.image(0, 0, ASSETS.ICON_MANA).setDisplaySize(44, 44).setOrigin(0.5);
                            this.intentContainer.add(this.intentIconSecondary);
                        }

                        // 2. Setup Layout (Tighter Spacing)
                        this.intentIcon.setVisible(true).setTexture(ASSETS.ICON_SWORD).setTint(0xff4444);
                        this.intentIcon.setDisplaySize(44, 44); // Match sizes
                        this.intentIcon.x = -15; // Closer to center

                        this.intentIconSecondary.setVisible(true).setTexture(ASSETS.ICON_MANA);
                        this.intentIconSecondary.setDisplaySize(44, 44); // ensure size update
                        this.intentIconSecondary.x = 15; // Closer to center

                        this.intentEmoji.setVisible(false);

                        this.intentText.x = 45; // Closer text

                    } else {
                        // Reset Position & Visibility for Standard Attacks
                        this.intentIcon.x = 0;
                        this.intentText.x = 28;
                        if (this.intentIconSecondary) this.intentIconSecondary.setVisible(false);
                        this._showIntentIcon(ASSETS.ICON_SWORD, 0xff4444);
                    }
                }

                // ... text update logic ...

                // Apply Text (with Strength calculation for Attack)
                if (intent.type === 'ATTACK') {
                    const str = enemy.getStrength ? enemy.getStrength() : 0;
                    const totalVal = intent.value + str;

                    if (intent.text) {
                        // If we have a base text like "Attack (12)", we want "Attack (22)" or "Attack (12 + 10)"
                        // Simple approach: Replace the number in parentheses if possible, or append.
                        // Actually, let's just use the intention name + total value.
                        // But intent.text includes the value currently.
                        // Let's rely on the Action generator format "Name (Val)".
                        // We can regex replace the value?
                        // Or just append strength info: "Attack (12) + 10 Str"
                        if (str > 0) {
                            tooltipText = `${intent.text} + ${str} Str = ${totalVal}`;
                        } else {
                            tooltipText = intent.text;
                        }
                    } else {
                        tooltipText = `Attack: ${totalVal} damage`;
                    }
                    this.intentText.setText(`${totalVal}`);

                } else if (intent.value !== undefined && intent.value > 0) {
                    this.intentText.setText(`${intent.value}`);
                } else {
                    this.intentText.setText('');
                }

                this.currentIntentTooltip = tooltipText;
            } else {
                this.intentContainer.setVisible(false);
            }
        }

        // --- ACTION BAR ---
        if (this.actionBar) {
            // Mana
            this.manaText.setText(`${player.mana}`);
            if (player.mana === 0) {
                this.manaIcon.setAlpha(0.5);
                this.manaText.setAlpha(0.5);
            } else {
                this.manaIcon.setAlpha(1);
                this.manaText.setAlpha(1);
                // Check Focus Glow
                const focus = player.statusManager ? player.statusManager.getStack(STATUS_TYPES.FOCUS) : 0;
                if (focus > 0) {
                    // Slight purple tint or glow
                    this.manaIcon.setTint(0xcc99ff);
                } else {
                    this.manaIcon.clearTint();
                }
            }

            // Skill Buttons State
            const canAct = this.combatManager.canInteract();
            const focus = player.statusManager ? player.statusManager.getStack(STATUS_TYPES.FOCUS) : 0;

            const getRealCost = (baseCost) => {
                if (focus >= 2) return 0;
                if (focus === 1) return Math.floor(baseCost * 0.5);
                return baseCost;
            };

            // Skill Buttons State - Dynamic
            const deck = runManager.player.deck || [];

            deck.forEach(skillId => {
                const data = SKILL_DATA[skillId];
                if (!data) return;

                const cost = getRealCost(data.cost);
                const shieldCost = data.shieldCost || 0;

                // Extra Conditions
                let extraConditionMet = true;
                if (data.maxSwords !== undefined) {
                    let swordCount = 0;
                    if (window.grid && window.grid.grid) {
                        window.grid.grid.forEach(row => row.forEach(tile => {
                            // Robust check for Sword type
                            if (tile && (tile.type === 'SWORD' || tile.type === ASSETS.SWORD) && !tile.isTrash) swordCount++;
                        }));
                    }
                    if (swordCount > data.maxSwords) extraConditionMet = false;
                }

                if (skillId === 'EXTRACTION') {
                    const toxin = (enemy && enemy.statusManager) ? enemy.statusManager.getStack(STATUS_TYPES.TOXIN) : 0;
                    if (toxin <= 0) extraConditionMet = false;
                }

                // CHECK BONUS CONDITION (Gold Aura)
                let bonusConditionMet = false;
                if (skillId === 'OUTBREAK') {
                    const toxin = (enemy && enemy.statusManager) ? enemy.statusManager.getStack(STATUS_TYPES.TOXIN) : 0;
                    if (toxin >= data.threshold) bonusConditionMet = true;
                }

                const isEnabled = canAct && player.mana >= cost && player.block >= shieldCost && extraConditionMet;
                const metadata = { swordConditionMet: extraConditionMet, bonusConditionMet: bonusConditionMet };
                this.updateSkillButton(skillId, isEnabled, focus, metadata);
            });
        }

        // --- TURN CONTROLS ---
        if (this.movesText) {
            this.movesText.setText(`Moves: ${currentMoves}/${maxMoves}`);

            // RELIC VISUAL: Crimson Hourglass Warning
            // If moves == 1 and relic active, Pulse Red.
            const crimsonTriggered = this.combatManager.turnState ? this.combatManager.turnState.crimsonTriggered : false;

            if (currentMoves === 1 && runManager.hasRelic('crimson_hourglass') && !crimsonTriggered) {
                // Trigger Warning State (Once)
                if (!this.movesPulse) {
                    this.movesText.setColor('#d80909ff'); // White Core
                    this.movesText.setFont('bold 32px Arial'); // Make it huge and bold
                    this.movesText.setShadow(0, 0, '#000000', 0, false, false); // NO Shadow

                    this.movesPulse = this.scene.tweens.add({
                        targets: this.movesText,
                        scale: { from: 1, to: 1.25 },
                        alpha: { from: 1, to: 0.8 },
                        duration: 1200,
                        yoyo: true,
                        repeat: -1
                    });
                }

                // Active Blood & Mist
                this.manageBloodEffect(true);
                this.manageMistEffect(true);
            } else {
                // Reset State (Once)
                this.manageBloodEffect(false);
                this.manageMistEffect(false); // Stop Mist

                this.movesText.setColor('#ffffff');
                this.movesText.setShadow(0, 0, '#000000', 0, false, false);

                if (this.movesPulse) {
                    this.movesPulse.stop();
                    this.movesPulse = null;

                    this.movesText.setScale(1);
                    this.movesText.setAlpha(1);
                    this.movesText.setFont('24px Arial');
                } else {
                    if (this.movesText.style.fontSize !== '24px') {
                        this.movesText.setFont('24px Arial');
                    }
                }
            }
        }
        if (this.endTurnBtn) {
            const canEnd = turn === ENTITIES.PLAYER && (!this.scene.gridView || !this.scene.gridView.isAnimating);
            this.updateEndTurnButton(canEnd);
        }
    }




    /**
     * Updates spell icon visual state based on mana availability.
     * @param {string} id - Skill ID
     * @param {boolean} isEnabled - Whether player can cast this spell
     * @param {number} focusStacks - Current Focus buff stacks (for glow effect)
     * @param {object} metadata - Extra validation data (e.g. swordConditionMet)
     */
    updateSkillButton(id, isEnabled, focusStacks = 0, metadata = {}) {
        const btn = this.skillButtons[id];
        if (!btn) return;

        // ... existing logic ...

        // NEW: Check Sword Requirement Text Color
        if (btn.swordReqText) {
            if (metadata.swordConditionMet === false) {
                btn.swordReqText.setColor('#ff0000'); // Red if condition failed
            } else {
                btn.swordReqText.setColor('#ffffff'); // White if condition met
            }
        }

        // --- GLOBAL CALCULATION (Run first) ---

        // --- GLOBAL CALCULATION (Run first) ---
        // Calculate Discounted Cost
        const baseCost = SKILL_DATA[id].cost;
        let finalCost = baseCost;
        let isDiscounted = false;

        if (focusStacks === 1) {
            finalCost = Math.floor(baseCost * 0.5);
            isDiscounted = true;
        } else if (focusStacks >= 2) {
            finalCost = 0;
            isDiscounted = true;
        }

        btn.container.setData('enabled', isEnabled);

        if (isEnabled) {
            // ACTIVE STATE: Full color, interactive
            btn.container.setAlpha(1);
            btn.container.setScale(1);
            btn.bg.setInteractive({ useHandCursor: true });

            // Restore Original Look
            btn.icon.setTint(0xffffff); // Clear tint
            btn.disabledOverlay.setAlpha(0);

            // FOCUS VISUALS: Pulse specific elements (Badge + Text)
            if (isDiscounted) {
                // Green Text for discount
                btn.badgeText.setColor('#00ff00');

                if (!btn.pulseTween) {
                    btn.pulseTween = this.scene.tweens.add({
                        targets: [btn.badge, btn.badgeText],
                        scale: { from: 1, to: 1.3 },
                        duration: 600,
                        yoyo: true,
                        repeat: -1
                    });
                }
                if (btn.pulseTween) {
                    btn.pulseTween.stop();
                    btn.pulseTween = null;
                    btn.badge.setScale(1); // Reset scale using direct reference since display size was set
                    btn.badge.setDisplaySize(40, 40); // Reset to original display size (Was 24, fixed to 40)
                    btn.badgeText.setScale(1);
                }
            }

            // BONUS CONDITION VISUAL (Gold Aura)
            if (metadata.bonusConditionMet) {
                // Ensure Texture Exists
                this.createGoldGlowTexture();

                if (!btn.bonusGlow) {
                    // Create Sprite behind the icon (index 0 usually, or specifically behind btn.icon)
                    // Container children: [bg, icon, badge...]
                    // We want it behind the icon but above bg? Or just behind everything?
                    // bg is at 0. Let's put it at 1 (above bg).
                    btn.bonusGlow = this.scene.add.image(0, 0, 'gold_glow');
                    btn.bonusGlow.setBlendMode(Phaser.BlendModes.ADD);
                    btn.bonusGlow.setScale(1.2);
                    btn.bonusGlow.setAlpha(0.6);

                    // Specific position manipulation inside container
                    // But 'addAt' is safer if we knew index. Simple 'add' puts it on top.
                    // Let's use sendToBack then moveUp
                    btn.container.add(btn.bonusGlow);
                    btn.container.sendToBack(btn.bonusGlow);
                    // If bg is also at back, we might want to check z-order, but usually fine.

                    btn.bonusTween = this.scene.tweens.add({
                        targets: btn.bonusGlow,
                        scale: { from: 1.2, to: 1.5 },
                        alpha: { from: 1.0, to: 0.5 }, // Stronger Pulse
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                // Cleanup if condition lost
                if (btn.bonusGlow) {
                    if (btn.bonusTween) btn.bonusTween.stop();
                    btn.bonusTween = null;
                    btn.bonusGlow.destroy();
                    btn.bonusGlow = null;
                }
            }
        } else {
            // DISABLED STATE: Grayscale/Darkened, BUT INTERACTIVE for Tooltip
            btn.container.setAlpha(1);
            btn.container.setScale(1);

            // Cleanup Bonus Glow if it exists (e.g. became disabled while glowing)
            if (btn.bonusGlow) {
                if (btn.bonusTween) btn.bonusTween.stop();
                btn.bonusTween = null;
                btn.bonusGlow.destroy();
                btn.bonusGlow = null;
            }

            // Dim and Grayscale Effect
            btn.icon.setTint(0x555555);
            btn.disabledOverlay.setAlpha(0); // Overlay not needed if we tint icon directly

            // Stop pulse when disabled
            if (btn.pulseTween) {
                btn.pulseTween.stop();
                btn.pulseTween = null;
                btn.badge.setDisplaySize(40, 40); // Reset to original display size (Was 24, fixed to 40)
                btn.badgeText.setScale(1);
            }
        }

        // Update Badge Text
        btn.badgeText.setText(`${finalCost}`);

        // Update Text Color based on discount status (even if disabled, show "price")
        if (isDiscounted) {
            btn.badgeText.setColor('#00ff00');
        } else {
            btn.badgeText.setColor('#ffffff');
        }
    }

    updateEndTurnButton(isEnabled) {
        if (!this.endTurnBtn) return;
        if (isEnabled) {
            this.endTurnBtn.setAlpha(1).setInteractive();
        } else {
            this.endTurnBtn.setAlpha(0.5).disableInteractive();
        }
    }

    showNotification(text, color) {
        this.centerText.setText(text);
        this.centerText.setColor('#' + color.toString(16));
        this.centerText.setVisible(true);
        this.centerText.setScale(0);
        this.centerText.setAlpha(1);

        this.scene.tweens.add({
            targets: this.centerText,
            scale: 1.5,
            duration: 500,
            ease: 'Back.out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.centerText,
                    alpha: 0,
                    scale: 2.0,
                    duration: 300,
                    delay: 500, // Hold for 500ms
                    onComplete: () => {
                        this.centerText.setVisible(false);
                    }
                });
            }
        });
    }

    animateAttack(attacker, target, offset, tint = 0xff0000, onComplete = null) {
        if (!attacker || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        const startX = attacker.x;

        // Windup
        this.scene.tweens.add({
            targets: attacker,
            x: startX - (offset * 0.5),
            duration: 100,
            yoyo: true,
            ease: 'Power1',
            onComplete: () => {
                // Lunge
                this.scene.tweens.add({
                    targets: attacker,
                    x: startX + offset,
                    duration: 150,
                    yoyo: true, // Go back to start
                    ease: 'Power1',
                    onYoyo: () => {
                        // Impact point - trigger Hit on target
                        this.animateHit(target, tint);
                    },
                    onComplete: () => {
                        attacker.x = startX; // Reset safety
                        if (onComplete) onComplete();
                    }
                });
            }
        });
    }

    animateHit(target, tint = 0xff0000) {
        if (!target || !this.scene) return;

        // Flash Tint
        if (target.setTint) target.setTint(tint);
        this.scene.time.delayedCall(200, () => {
            target.clearTint();
        });

        // Shake Effect
        this.scene.tweens.add({
            targets: target,
            x: '+=5', // Relative shake
            yoyo: true,
            duration: 50,
            repeat: 3
        });
    }

    animateDefend(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. CREATE SHIELD CIRCLE (FORCEFIELD)
        const shieldCircle = this.scene.add.graphics();
        shieldCircle.blendMode = Phaser.BlendModes.ADD;
        shieldCircle.setDepth(target.depth + 1);

        shieldCircle.lineStyle(7, 0x00ffff, 1);
        shieldCircle.strokeCircle(0, 0, 70);

        shieldCircle.x = target.x;
        shieldCircle.y = target.getCenter().y;
        shieldCircle.setScale(0.5);

        // 2. EXPANSION ANIMATION (Shockwave)
        this.scene.tweens.add({
            targets: shieldCircle,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 400,
            ease: 'Quad.Out',
            onComplete: () => {
                shieldCircle.destroy();
            }
        });

        // 3. CHARACTER "POWER UP" ANIMATION
        if (target.setTint) target.setTint(0x88ccff);

        this.scene.tweens.add({
            targets: target,
            scaleX: target.scaleX * 1.15,
            scaleY: target.scaleY * 1.15,
            duration: 150,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => {
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete(); // Signal DONE
            }
        });
    }

    animateToxicApply(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. VISUAL EFFECT: RISING TOXIC BUBBLES
        const particles = this.scene.add.graphics();
        particles.setDepth(target.depth + 1);
        particles.blendMode = Phaser.BlendModes.NORMAL;

        // Toxic Green / Black palette
        particles.fillStyle(0x111111, 1); // Start Black

        const w = target.displayWidth || target.width;

        // Draw 5-8 random bubbles
        for (let i = 0; i < 8; i++) {
            const offsetX = (Math.random() - 0.5) * w * 0.6;
            const offsetY = (Math.random() * -30);
            const radius = 2 + Math.random() * 5;

            // Mix Neon Green and Black
            const color = Math.random() > 0.5 ? 0x39ff14 : 0x000000;
            particles.fillStyle(color, 1); // Opaque for black to be visible
            particles.fillCircle(offsetX, offsetY, radius);
        }

        particles.x = target.x;
        particles.y = target.y - 10;

        // Animate Floating Up
        this.scene.tweens.add({
            targets: particles,
            y: particles.y - 100,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1200, // Slower, more viscous
            ease: 'Sine.Out',
            onComplete: () => {
                particles.destroy();
            }
        });

        // 2. CHARACTER PULSE (Sickly Green Tint)
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x88ff88); // Sickly Green

        this.scene.tweens.add({
            targets: target,
            scaleX: startScaleX * 1.05, // Subtle shudder
            scaleY: startScaleY * 1.05,
            yoyo: true,
            duration: 500,
            onComplete: () => {
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete();
            }
        });
    }

    animateHeal(target, onComplete = null) {
        if (!target || !this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. VISUAL EFFECT: RISING BUBBLES
        const particles = this.scene.add.graphics();
        particles.setDepth(target.depth + 1);
        particles.blendMode = Phaser.BlendModes.ADD; // Make them glow!
        particles.fillStyle(0x44ff44, 1);

        // Use display dimensions for accurate positioning regardless of scaling
        const w = target.displayWidth || target.width;
        // const h = target.displayHeight || target.height; 

        // Draw 5-8 random bubbles
        for (let i = 0; i < 8; i++) {
            // Spread horizontally around center
            const offsetX = (Math.random() - 0.5) * w * 0.6;
            // Spread vertically slightly (start/stagger)
            const offsetY = (Math.random() * -30);

            const radius = 2 + Math.random() * 5;

            particles.fillCircle(offsetX, offsetY, radius);
        }

        // Set initial position at target's feet (assuming Origin is 0.5, 1)
        // If Origin is Center, we would need target.y + h/2.
        // But for CombatView entities usually OriginY=1 (Feet).
        particles.x = target.x;
        particles.y = target.y - 10; // Start slightly above effective "ground"

        // Animate Floating Up
        this.scene.tweens.add({
            targets: particles,
            y: particles.y - 100, // Float up higher
            alpha: 0,
            scaleX: 0.5, // Shrink
            scaleY: 0.5,
            duration: 1000,
            ease: 'Sine.Out',
            onComplete: () => {
                particles.destroy();
            }
        });

        // 2. CHARACTER PULSE
        const startScaleX = target.scaleX;
        const startScaleY = target.scaleY;

        if (target.setTint) target.setTint(0x44ff44);

        this.scene.tweens.add({
            targets: target,
            scaleX: startScaleX * 1.05,
            scaleY: startScaleY * 1.05,
            duration: 300,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => {
                target.setScale(startScaleX, startScaleY);
                if (target.clearTint) target.clearTint();
                if (onComplete) onComplete();
            }
        });
    }

    animateGridShake(onComplete = null) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 0. Enemy Lunge Animation (Visual Feedback that Enemy is doing it)
        const enemy = this.enemySprite;
        const startX = enemy.x;

        // Move forward slightly
        this.scene.tweens.add({
            targets: enemy,
            x: startX - 50, // Move left (towards grid center usually)
            duration: 200,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // TRIGGER EFFECT AT IMPACT POINT

                // 1. Grid Shake (Target the Grid Container directly)
                // Assuming GridView is exposed on scene
                if (window.grid && this.scene.gridView && this.scene.gridView.container) {
                    const gridCont = this.scene.gridView.container;
                    const originalX = gridCont.x;

                    this.scene.tweens.add({
                        targets: gridCont,
                        x: '+=10',
                        duration: 50,
                        yoyo: true,
                        repeat: 5,
                        onComplete: () => {
                            gridCont.x = originalX; // Reset safety
                        }
                    });
                } else {
                    // Fallback if container not found: Shake Camera slightly
                    this.scene.cameras.main.shake(200, 0.005);
                }

                // 2. Dust/Smoke Effect
                const cx = this.scene.scale.width / 2;
                const cy = this.scene.scale.height / 2;

                const dust = this.scene.add.graphics();
                dust.setDepth(200);
                dust.fillStyle(0x8855aa, 0.6);

                for (let i = 0; i < 10; i++) {
                    const r = 5 + Math.random() * 10;
                    const ox = (Math.random() - 0.5) * 300;
                    const oy = (Math.random() - 0.5) * 300;
                    dust.fillCircle(ox, oy, r);
                }
                dust.x = cx;
                dust.y = cy;
                dust.setScale(0);

                this.scene.tweens.add({
                    targets: dust,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        dust.destroy();
                    }
                });
            },
            onComplete: () => {
                enemy.x = startX; // Reset Position
                if (onComplete) onComplete();
            }
        });
    }

    animateGridLock(onComplete = null, targets = []) {
        if (!this.scene) {
            if (onComplete) onComplete();
            return;
        }

        // 1. Hide Grid Overlays IMMEDIATELY (so they don't appear before projectile lands)
        // We track which overlays we hid to reveal them later on impact.
        const targetOverlays = {};
        if (this.scene.gridView && this.scene.gridView.overlays && targets) {
            targets.forEach(t => {
                if (t.id && this.scene.gridView.overlays[t.id]) {
                    const sprite = this.scene.gridView.overlays[t.id];
                    sprite.setAlpha(0);
                    targetOverlays[t.id] = sprite;
                }
            });
        }

        // 2. Enemy Lunge Animation
        const enemy = this.enemySprite;
        const startX = enemy.x;
        const startY = enemy.y - (enemy.height * 0.5); // Chest height

        this.scene.tweens.add({
            targets: enemy,
            x: startX - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // SPAWN PROJECTILES (LOCKS)
                // Use actual targets or fallback to random count if missing (safeguard)
                const lockCount = (targets && targets.length > 0) ? targets.length : 3;

                // Grid Metrics for targeting
                let getTargetPos;
                if (this.scene.gridView && window.grid) {
                    const gv = this.scene.gridView;
                    // Center of tile logic from GridView
                    getTargetPos = (r, c) => {
                        return {
                            x: gv.offsetX + c * gv.tileSize,
                            y: gv.offsetY + r * gv.tileSize
                        };
                    };
                } else {
                    // Fallback (Random)
                    const gridCenterX = this.scene.scale.width * 0.5;
                    const gridCenterY = this.scene.scale.height * 0.6;
                    getTargetPos = () => ({
                        x: gridCenterX + (Math.random() - 0.5) * 300,
                        y: gridCenterY + (Math.random() - 0.5) * 300
                    });
                }

                for (let i = 0; i < lockCount; i++) {
                    // 1. Create Lock Sprite/Image
                    // Use ASSETS.ICON_LOCK if available, else text or shape
                    let lock;
                    if (this.scene.textures.exists(ASSETS.ICON_LOCK)) {
                        lock = this.scene.add.image(enemy.x - 20, startY, ASSETS.ICON_LOCK);
                        lock.setDisplaySize(40, 40); // Reasonable icon size
                    } else {
                        // Text Fallback (🔒)
                        lock = this.scene.add.text(enemy.x - 20, startY, '🔒', { fontSize: '32px' }).setOrigin(0.5);
                    }
                    lock.setDepth(500); // Very high
                    lock.scale = 0;

                    // 2. Determine Target
                    let tx, ty;
                    let currentTargetId = null;

                    if (targets && targets[i]) {
                        const t = targets[i];
                        const pos = getTargetPos(t.r, t.c);
                        tx = pos.x;
                        ty = pos.y;
                        currentTargetId = t.id;
                    } else {
                        const pos = getTargetPos();
                        tx = pos.x;
                        ty = pos.y;
                    }

                    // Timeline replacement: Nested Tweens
                    // 1. Pop In
                    this.scene.tweens.add({
                        targets: lock,
                        scale: 1,
                        duration: 100,
                        delay: i * 50, // Stagger
                        onComplete: () => {
                            // 2. Fly to Target
                            this.scene.tweens.add({
                                targets: lock,
                                x: tx,
                                y: ty,
                                rotation: Math.PI * 2,
                                duration: 400, // Fast
                                ease: 'Quad.Out',
                                onComplete: () => {
                                    // IMPACT VISUAL
                                    // REVEAL GRID OVERLAY
                                    if (currentTargetId && targetOverlays[currentTargetId]) {
                                        const overlay = targetOverlays[currentTargetId];
                                        overlay.setAlpha(1);
                                        // Optional: Shake/Pop the overlay itself
                                        this.scene.tweens.add({
                                            targets: overlay,
                                            scaleX: 1.2,
                                            scaleY: 1.2,
                                            yoyo: true,
                                            duration: 100
                                        });
                                    }

                                    // Small Shake of the lock itself before disappearing
                                    this.scene.tweens.add({
                                        targets: lock,
                                        scale: 1.5,
                                        alpha: 0,
                                        duration: 300,
                                        onComplete: () => {
                                            lock.destroy();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }

                // Wait for longest flight
                this.scene.time.delayedCall(1000, () => {
                    if (onComplete) onComplete();
                });
            },
            onComplete: () => {
                enemy.x = startX;
            }
        });
    }

    animateOutbreak(data, onComplete = null) {
        if (!this.scene) return;
        const targets = data.targets || [];

        // 1. Source: Player
        const player = this.heroSprite;
        const startX = player.x;
        const startY = player.y - (player.height * 0.5);

        // 2. Lunge Animation
        this.scene.tweens.add({
            targets: player,
            x: startX + 50, // Move Right (towards grid)
            duration: 200,
            yoyo: true,
            ease: 'Power1',
            onYoyo: () => {
                // SPAWN POTIONS
                const count = (targets && targets.length > 0) ? targets.length : 3;
                let completedCount = 0;

                // Grid Helper
                let getTargetPos;
                if (this.scene.gridView && window.grid) {
                    const gv = this.scene.gridView;
                    getTargetPos = (r, c) => ({
                        x: gv.offsetX + c * gv.tileSize,
                        y: gv.offsetY + r * gv.tileSize
                    });
                } else {
                    if (data.onComplete) data.onComplete();
                    return;
                }

                for (let i = 0; i < count; i++) {
                    // Create Potion Sprite (Using Grid Texture)
                    let potion;
                    const tex = ASSETS.POTION || 'POTION';
                    if (this.scene.textures.exists(tex)) {
                        const size = 50 * GAME_SETTINGS.GRID_SCALE;
                        potion = this.scene.add.image(player.x + 20, startY, tex);
                        potion.setDisplaySize(size, size);
                    } else {
                        potion = this.scene.add.image(player.x + 20, startY, 'icon_potion');
                        potion.setDisplaySize(40, 40);
                    }
                    potion.setDepth(500);
                    potion.scale = 0;

                    // Target
                    let tx, ty;
                    let pos;
                    if (targets && targets[i]) {
                        pos = getTargetPos(targets[i].r, targets[i].c);
                        tx = pos.x;
                        ty = pos.y;
                    } else {
                        tx = this.scene.scale.width / 2;
                        ty = this.scene.scale.height / 2;
                        pos = { x: tx, y: ty };
                    }

                    // Timeline: Pop In -> Fly -> Impact (Lock Style)
                    this.scene.tweens.add({
                        targets: potion,
                        scale: 0.6,
                        duration: 100,
                        delay: i * 50,
                        onComplete: () => {
                            // Fly
                            this.scene.tweens.add({
                                targets: potion,
                                x: tx,
                                y: ty,
                                rotation: Math.PI * 4,
                                duration: 400,
                                ease: 'Quad.Out',
                                onComplete: () => {
                                    // IMPACT: Signal Logic
                                    completedCount++;
                                    if (completedCount >= count) {
                                        if (data.onComplete) data.onComplete();
                                    }

                                    // Visual "Pop/Settling" (Lock Style: Scale Up + Fade Out)
                                    this.scene.tweens.add({
                                        targets: potion,
                                        scale: 1.0,
                                        duration: 250,
                                        yoyo: true,
                                        onComplete: () => {
                                            potion.destroy();
                                            if (completedCount >= count && onComplete) onComplete();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            },
            onComplete: () => {
                player.x = startX;
                if (onComplete) onComplete();
            }
        });
    }

    animateExtraction(data, onComplete = null) {
        if (!this.scene) return;

        const enemy = this.enemySprite;
        const player = this.heroSprite;
        const startX = enemy.x;
        const startY = enemy.y - (enemy.height * 0.5);
        const targetX = player.x;
        const targetY = player.y - (player.height * 0.5);

        // 1. Create Particles (Energy Blobs) - SWARM EFFECT (Restored)
        const particleCount = 25;

        for (let i = 0; i < particleCount; i++) {
            // Mix Neon Green and Black
            const color = Math.random() > 0.5 ? 0x39ff14 : 0x000000;
            // Spawn randomly around enemy body
            const w = enemy.displayWidth || 100;
            const h = enemy.displayHeight || 100;
            const spawnX = startX + (Math.random() - 0.5) * w;
            const spawnY = startY + (Math.random() - 0.5) * h;

            const blob = this.scene.add.circle(spawnX, spawnY, 4 + Math.random() * 6, color);
            blob.setDepth(200);
            blob.setAlpha(0.8);

            this.scene.tweens.add({
                targets: blob,
                x: targetX,
                y: targetY,
                scale: { from: 1, to: 0.2 }, // Shrink as absorbed
                // Randomize flight time for chaotic "swarm" feel
                duration: 600 + Math.random() * 600,
                delay: i * 20, // Staggered start (stream effect)
                ease: 'Quad.In', // Accelerate towards player
                onComplete: () => {
                    blob.destroy();
                }
            });
        }

        // 2. Flash Player (Absorption)
        const startScaleX = player.scaleX;
        const startScaleY = player.scaleY;

        // Delay flash until some particles arrive
        this.scene.time.delayedCall(600, () => {
            if (player.setTint) player.setTint(0x39ff14);
            this.scene.tweens.add({
                targets: player,
                scaleX: startScaleX * 1.05,
                scaleY: startScaleY * 1.05,
                yoyo: true,
                duration: 200,
                onComplete: () => {
                    player.setScale(startScaleX, startScaleY); // Reset to ensure safety
                    if (player.clearTint) player.clearTint();
                    if (onComplete) onComplete();
                }
            });
        });
    }

    createPotionSplash(x, y) {
        // Mini splash effect
        const particles = this.scene.add.graphics();
        particles.setDepth(200);

        for (let j = 0; j < 6; j++) {
            const color = Math.random() > 0.5 ? 0x00ff00 : 0x8800ff; // Green/Purple
            particles.fillStyle(color, 1);
            particles.fillCircle(x, y, 2 + Math.random() * 4);
        }

        this.scene.tweens.add({
            targets: particles,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => particles.destroy()
        });
    }

    animatePrismaticResonance(data, onComplete) {
        if (!this.scene) return;
        const targets = data.targets || [];

        // 1. Source: Boss
        const source = this.enemySprite;
        const startX = source.x;
        const startY = source.y - (source.height * 0.5);

        // Grid Helper
        let getTargetPos;
        if (this.scene.gridView && window.grid) {
            const gv = this.scene.gridView;
            getTargetPos = (r, c) => ({
                x: gv.offsetX + c * gv.tileSize,
                y: gv.offsetY + r * gv.tileSize
            });
        } else {
            if (onComplete) onComplete();
            return;
        }

        // 2. Animate Projectiles (Mana Crystals)
        let completedCount = 0;
        const total = targets.length;
        if (total === 0) {
            if (data.onComplete) data.onComplete(); // Ensure logic proceeds even if no targets
            if (onComplete) onComplete();
            return;
        }

        targets.forEach((t, i) => {
            // Create Mana Crystal Sprite (Using Grid Texture)
            let crystal;
            if (this.scene.textures.exists(ASSETS.MANA)) {
                const size = 50 * GAME_SETTINGS.GRID_SCALE;
                crystal = this.scene.add.image(startX, startY, ASSETS.MANA).setDisplaySize(size, size);
            } else {
                crystal = this.scene.add.text(startX, startY, '💎', { fontSize: '32px' }).setOrigin(0.5);
            }
            crystal.setDepth(500);
            crystal.scale = 0; // Start small for Pop In

            const pos = getTargetPos(t.r, t.c);

            // Timeline: Pop In -> Fly -> Impact (Lock Style)
            this.scene.tweens.add({
                targets: crystal,
                scale: 0.6, // Pop In
                duration: 100,
                delay: i * 50,
                onComplete: () => {
                    // Fly
                    this.scene.tweens.add({
                        targets: crystal,
                        x: pos.x,
                        y: pos.y,
                        rotation: Math.PI * 4,
                        duration: 400,
                        ease: 'Quad.Out',
                        onComplete: () => {
                            // IMPACT: Signal Logic
                            completedCount++;
                            if (completedCount >= total) {
                                if (data.onComplete) data.onComplete();
                            }

                            // Visual "Pop/Settling" (Lock Style: Scale Up + Fade Out)
                            this.scene.tweens.add({
                                targets: crystal,
                                scale: 1.0,
                                duration: 250,
                                yoyo: true,
                                onComplete: () => {
                                    crystal.destroy();
                                    if (completedCount >= total && onComplete) onComplete();
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    animateManaDevour(data, onComplete) {
        if (!this.scene) return;
        const targets = data.targets || [];

        // 1. Destination: Boss
        const dest = this.enemySprite;
        const destX = dest.x;
        const destY = dest.y - (dest.height * 0.5);

        // Grid Helper
        let getTargetPos;
        if (this.scene.gridView && window.grid) {
            const gv = this.scene.gridView;
            getTargetPos = (r, c) => ({
                x: gv.offsetX + c * gv.tileSize,
                y: gv.offsetY + r * gv.tileSize
            });
        } else {
            if (onComplete) onComplete();
            return;
        }

        let completedCount = 0;
        const total = targets.length;
        if (total === 0) {
            if (onComplete) onComplete();
            return;
        }

        let poppedCount = 0;

        // 2. Create Clones and Suck
        targets.forEach((t, i) => {
            // Clone Mana Sprite (Using Grid Texture)
            let crystal;
            if (this.scene.textures.exists(ASSETS.MANA)) {
                const size = 50 * GAME_SETTINGS.GRID_SCALE;
                crystal = this.scene.add.image(0, 0, ASSETS.MANA).setDisplaySize(size, size);
            } else {
                crystal = this.scene.add.text(0, 0, '💎', { fontSize: '32px' }).setOrigin(0.5);
            }
            crystal.setDepth(500);

            const startPos = getTargetPos(t.r, t.c);
            crystal.setPosition(startPos.x, startPos.y);

            // Phase 1: Pop Up (Anticipation)
            this.scene.tweens.add({
                targets: crystal,
                scale: 0.8,
                angle: (Math.random() - 0.5) * 20, // Slight rotation
                duration: 400,
                ease: 'Back.Out',
                delay: i * 20,
                onComplete: () => {
                    // Trigger Logic Reset (Gravity) ONLY when ALL icons have popped
                    poppedCount++;
                    if (poppedCount >= total) {
                        if (data.onComplete) data.onComplete();
                    }

                    // Phase 2: Suck into Boss
                    // Add small delay (Hold) so the grid collapses under the hovering gem
                    this.scene.tweens.add({
                        targets: crystal,
                        x: destX + (Math.random() - 0.5) * 30,
                        y: destY + (Math.random() - 0.5) * 30,
                        scale: 0.5,
                        duration: 600,
                        delay: 150, // HOLD PHASE
                        ease: 'Quad.In',
                        onComplete: () => {
                            // Impact Effect
                            // Impact Effect
                            completedCount++;

                            if (completedCount >= total) {
                                const count = data.manaCount || 0;
                                const threshold = (data.config && data.config.threshold) || 6;

                                if (count > threshold) {
                                    // HIGH MANA: Power Up
                                    const healAmt = count * (data.config.healPerGem || 3);

                                    this.scene.tweens.add({
                                        targets: this.enemySprite,
                                        scaleX: this.enemySprite.scaleX * 1.15,
                                        scaleY: this.enemySprite.scaleY * 1.15,
                                        duration: 300,
                                        yoyo: true,
                                        ease: 'Sine.InOut',
                                        onStart: () => this.enemySprite.setTint(0xaa44ff),
                                        onComplete: () => this.enemySprite.clearTint()
                                    });

                                    this.showFloatingText(destX, destY - 80, "STRENGTH", 0xaa44ff);
                                } else {
                                    // LOW MANA: Weakened
                                    const dmgAmt = count * (data.config.damagePerGem || 5);

                                    this.scene.tweens.add({
                                        targets: this.enemySprite,
                                        x: '+=6',
                                        duration: 50,
                                        yoyo: true,
                                        repeat: 5,
                                        onStart: () => this.enemySprite.setTint(0x888888),
                                        onComplete: () => this.enemySprite.clearTint()
                                    });

                                    this.showFloatingText(destX, destY - 80, "VULNERABLE", 0xff4444);
                                }

                                if (onComplete) onComplete();
                            }
                            crystal.destroy();
                        }
                    });
                }
            });
        });
    }


    // Helper: Show floating text
    showFloatingText(x, y, text, color = 0xffffff) {
        if (!this.scene) return;

        const txt = this.scene.add.text(x, y, text, {
            fontFamily: 'Verdana',
            fontSize: '24px',
            color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color,
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        txt.setDepth(1000);

        this.scene.tweens.add({
            targets: txt,
            y: y - 50,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => txt.destroy()
        });
    }

    // Helper: Scales sprite to fit within maxW/maxH while preserving Aspect Ratio
    fitSprite(sprite, maxW, maxH, customScale = 1) {
        if (!sprite || !sprite.width || !sprite.height) return;

        // Reset scale to 1 first to get true dimensions
        sprite.setScale(1);

        const scaleX = maxW / sprite.width;
        const scaleY = maxH / sprite.height;

        // Scale Down Only: If image is smaller than box, keep it 1:1. Only shrink if too big.
        let finalScale = Math.min(scaleX, scaleY, 1);

        // Apply Manual Override (allows intentionally breaking the safety limits)
        finalScale *= customScale;

        sprite.setScale(finalScale);
    }

    createSpellIcon(skillId, x, y) {
        const data = SKILL_DATA[skillId];
        if (!data) return;

        const size = 130; // Increased size (Requested "trochu zvětšit")
        const container = this.scene.add.container(x, y);

        // Background (Transparent - NO BORDER)
        const bg = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0.01);
        bg.setInteractive({ useHandCursor: true });

        // Icon
        let icon;
        if (this.scene.textures.exists(data.icon)) {
            icon = this.scene.add.image(0, 0, data.icon).setDisplaySize(120, 120); // Larger icon
        } else {
            icon = this.scene.add.text(0, 0, data.icon || '?', { fontSize: '72px' }).setOrigin(0.5);
        }

        const disabledOverlay = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0.6);
        disabledOverlay.setAlpha(0);

        // --- MANA COST (Top-Right Crystal) ---
        const badgeX = size / 2 - 15;
        const badgeY = -size / 2 + 15;

        // --- SHIELD COST (Left of Mana Crystal) ---
        let nextBadgeX = badgeX - 45; // Shift left

        if (data.shieldCost > 0) {
            const shieldX = nextBadgeX;
            const shieldBadge = this.scene.add.image(shieldX, badgeY, ASSETS.ICON_SHIELD)
                .setDisplaySize(36, 36).setOrigin(0.5);

            const shieldText = this.scene.add.text(shieldX, badgeY, `${data.shieldCost}`, {
                font: 'bold 22px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5);

            container.add([shieldBadge, shieldText]);
            nextBadgeX -= 45; // Shift further left for next item
        }

        // --- SWORD LIMIT REQUIREMENT (Bottom Right) ---
        let swordReqText = null;
        if (data.maxSwords !== undefined) {
            const bottomY = size / 2 - 20;
            const rightX = size / 2 - 20;

            const swordBadge = this.scene.add.image(rightX, bottomY, ASSETS.ICON_SWORD)
                .setDisplaySize(30, 30).setOrigin(0.5); // Slightly smaller

            // Text: "<X" (Left of Icon)
            swordReqText = this.scene.add.text(rightX - 25, bottomY, `< ${data.maxSwords}`, {
                font: 'bold 20px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5); // Center origin relative to position

            container.add([swordBadge, swordReqText]);
        }

        // Crystal Icon
        const badge = this.scene.add.image(badgeX, badgeY, ASSETS.ICON_MANA)
            .setDisplaySize(40, 40).setOrigin(0.5); // Larger badge

        // Cost Number
        const badgeText = this.scene.add.text(badgeX, badgeY, `${data.cost}`, {
            font: 'bold 22px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        container.add([bg, icon, disabledOverlay, badge, badgeText]);

        if (this.actionBar) {
            this.actionBar.add(container);
        }

        // Tooltip
        bg.on('pointerover', () => {
            this.scene.tweens.add({ targets: container, scale: 1.1, duration: 100 });
            const worldMatrix = container.getWorldTransformMatrix();
            this.showTooltip(worldMatrix.tx, worldMatrix.ty - 80, RichTextHelper.getSkillTooltipText(data));
        });

        // FIX: Hover Out Animation
        bg.on('pointerout', () => {
            this.scene.tweens.add({ targets: container, scale: 1, duration: 100 });
            this.hideTooltip();
        });



        // Click
        bg.on('pointerdown', () => {
            if (!container.getData('enabled')) return; // Ignore clicks if disabled

            this.scene.tweens.add({ targets: container, scale: 0.9, duration: 50, yoyo: true });
            this.combatManager.tryUseSkill(skillId);
            this.hideTooltip();
        });

        container.setData('skillId', skillId);
        container.setData('originalColor', data.color);
        this.skillButtons[skillId] = { container, bg, disabledOverlay, icon, badge, badgeText, swordReqText };
    }

    getStatusItemsData(statusManager) {
        if (!statusManager) return [];
        const items = [];

        const bleed = statusManager.getStack(STATUS_TYPES.BLEED);
        if (bleed > 0) items.push({ icon: '🩸', count: bleed, tooltip: 'Bleed: Deals damage at turn start' });

        const regen = statusManager.getStack(STATUS_TYPES.REGEN);
        if (regen > 0) items.push({ icon: '💚', count: regen, tooltip: 'Regen: Heals at turn start' });

        const thorns = statusManager.getStack(STATUS_TYPES.THORNS);
        if (thorns > 0) items.push({ icon: '🌵', count: thorns, tooltip: 'Thorns: Reflects damage to attacker' });

        const focus = statusManager.getStack(STATUS_TYPES.FOCUS);
        if (focus > 0) items.push({ icon: '🔮', count: focus, tooltip: 'Focus: Reduces spell cost (1=50%, 2=free)' });

        const crit = statusManager.getStack(STATUS_TYPES.CRITICAL);
        if (crit > 0) items.push({ icon: '🎯', count: crit, tooltip: 'Critical: Increases critical hit chance' });

        const greed = statusManager.getStack(STATUS_TYPES.GREED_CURSE);
        // console.log('DEBUG: Checking Greed Curse Stacks:', greed);
        if (greed > 0) items.push({ icon: '💀', count: '', color: '#ffd700', tooltip: 'Greed Curse: -5 HP if no Gold collected this turn!' });

        const vuln = statusManager.getStack(STATUS_TYPES.VULNERABLE);
        if (vuln > 0) items.push({ icon: '☠️', count: vuln, tooltip: 'Vulnerable: Takes 25% extra damage' });

        const str = statusManager.getStack(STATUS_TYPES.STRENGTH);
        if (str > 0) {
            let desc = `Strength: Increases damage by ${str}`;
            // Dynamic check for Enemy (Magnitude based)
            if (statusManager.entity && statusManager.entity.strengthMagnitude) {
                const mag = statusManager.entity.strengthMagnitude;
                desc = `Strength: Increases damage by ${mag}`;
            }
            items.push({ icon: '💪', count: str, tooltip: desc });
        }

        const toxin = statusManager.getStack(STATUS_TYPES.TOXIN);
        if (toxin > 0) items.push({ icon: '☣️', count: toxin, color: '#76ff03', tooltip: 'Toxin: Non-decaying poison. Explodes at 12 stacks!' });

        return items;
    }

    _showIntentIcon(key, tint) {
        if (this.intentEmoji) this.intentEmoji.setVisible(false);
        this.intentIcon.setVisible(true).setTexture(key);
        if (tint !== null) this.intentIcon.setTint(tint);
        else this.intentIcon.clearTint();
    }

    // --- BLOOD EFFECT (Crimson Hourglass) ---
    manageBloodEffect(active) {
        if (active) {
            if (!this.bloodTimer) {
                // Spawn a drop every 100-300ms
                this.bloodTimer = this.scene.time.addEvent({
                    delay: 150,
                    callback: this.spawnBloodDrop,
                    callbackScope: this,
                    loop: true
                });
                // Initial burst
                for (let i = 0; i < 3; i++) this.spawnBloodDrop();
            }
        } else {
            if (this.bloodTimer) {
                this.bloodTimer.remove();
                this.bloodTimer = null;
            }
        }
    }

    spawnBloodDrop() {
        if (!this.movesText || !this.movesText.visible) return;

        // Get bounds of the text
        const bounds = this.movesText.getBounds();

        // Random layout within text width
        const x = bounds.x + Math.random() * bounds.width;
        const y = bounds.y + bounds.height * 0.6; // Start slightly near bottom of text

        const drop = this.scene.add.circle(x, y, 4, 0xaa0000); // Dark Red
        drop.setDepth(150);

        // Physics-ish animation
        this.scene.tweens.add({
            targets: drop,
            y: y + 40 + Math.random() * 40, // Fall down 40-80px
            scaleX: { from: 1, to: 0.5 }, // Thin out
            scaleY: { from: 1, to: 1.5 }, // Stretch
            alpha: { from: 1, to: 0 },
            duration: 800 + Math.random() * 400,
            onComplete: () => drop.destroy()
        });
    }

    // --- MIST BACKDROP (Replacing Shadow) ---
    createMistTexture() {
        if (this.scene.textures.exists('red_mist_glow')) return;

        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        // Draw a soft radial gradient using concentric circles
        // Center 64,64, Radius 64
        for (let r = 64; r > 0; r -= 2) {
            const alpha = 0.05 * (1 - (r / 64)); // Very low alpha stacking up
            graphics.fillStyle(0xff0000, alpha);
            graphics.fillCircle(64, 64, r);
        }
        graphics.generateTexture('red_mist_glow', 128, 128);
    }

    createGoldGlowTexture() {
        if (this.scene.textures.exists('gold_glow')) return;

        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        // Soft Gold Halo
        for (let r = 64; r > 0; r -= 2) {
            const alpha = 0.15 * (1 - (r / 64)); // Increased from 0.08 to 0.15 for stronger glow
            graphics.fillStyle(0xffd700, alpha); // Gold
            graphics.fillCircle(64, 64, r);
        }
        graphics.generateTexture('gold_glow', 128, 128);
    }

    manageMistEffect(active) {
        if (active) {
            this.createMistTexture(); // Ensure texture exists

            if (!this.mistSprite) {
                // Create the sprite behind the text
                // movesText origin is (1, 0.5), so 'x' is the right edge.
                // Center X = x - width / 2
                // Center Y = y
                const x = this.movesText.x - this.movesText.width / 2;
                const y = this.movesText.y;

                this.mistSprite = this.scene.add.image(x, y, 'red_mist_glow');
                this.mistSprite.setDepth(this.movesText.depth - 1); // Behind text
                this.mistSprite.setAlpha(0);
                this.mistSprite.setBlendMode(Phaser.BlendModes.ADD); // Glowy look

                // Breathe Animation
                this.scene.tweens.add({
                    targets: this.mistSprite,
                    scale: { from: 2.0, to: 2.5 },
                    alpha: { from: 0.4, to: 0.7 },
                    duration: 1200,
                    yoyo: true,
                    repeat: -1
                });
            } else {
                // Ensure position updates if text moves (unlikely but safe)
                this.mistSprite.x = this.movesText.x - this.movesText.width / 2;
                this.mistSprite.y = this.movesText.y;
                this.mistSprite.setVisible(true);
            }
        } else {
            if (this.mistSprite) {
                this.mistSprite.destroy();
                this.mistSprite = null;
            }
        }
    }
}

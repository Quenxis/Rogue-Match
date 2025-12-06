/**
 * @file CombatView.js
 * @description Manages all UI/Visuals for combat (Observer Pattern). Decoupled from logic.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, ASSETS, SKILLS, ENTITIES } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';

export class CombatView {
    constructor(scene, combatManager) {
        this.scene = scene;
        this.combatManager = combatManager; // Command Pattern: Only for invoking actions!

        this.playerUI = null;
        this.enemyUI = null;
        this.centerText = null;
        this.skillButtons = {};
        this.endTurnBtn = null;
        this.heroSprite = null;
        this.enemySprite = null;

        // Visual State
        this.currentTurn = ENTITIES.PLAYER;

        this.createUI();
        this.bindEvents();
    }

    bindEvents() {
        this.updateUIBind = this.updateUI.bind(this);
        this.showNotificationBind = (data) => this.showNotification(data.text, data.color);

        EventBus.on(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.on(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);
    }

    destroy() {
        EventBus.off(EVENTS.UI_UPDATE, this.updateUIBind);
        EventBus.off(EVENTS.SHOW_NOTIFICATION, this.showNotificationBind);

        if (this.playerUI) this.playerUI.destroy();
        if (this.enemyUI) this.enemyUI.destroy();
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();
        if (this.heroSprite) this.heroSprite.destroy();
        if (this.enemySprite) this.enemySprite.destroy();

        Object.values(this.skillButtons).forEach(btn => {
            if (btn.container) btn.container.destroy();
        });
    }

    createUI() {
        // Left Column Center X = 120
        const LEFT_COL_X = 120;

        // 1. Hero Sprite
        if (this.scene.textures.exists(ASSETS.HERO)) {
            this.heroSprite = this.scene.add.image(LEFT_COL_X, 130, ASSETS.HERO);
            this.heroSprite.setDisplaySize(150, 150);
            this.heroSprite.setDepth(100);
        } else {
            this.heroSprite = this.scene.add.rectangle(LEFT_COL_X, 130, 100, 100, 0x6666ff).setDepth(100);
        }

        // 2. Compact Stats Row (Below Sprite)
        this.playerUI = this.scene.add.text(LEFT_COL_X, 220, '', {
            font: 'bold 16px Arial',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5, 0);
        this.playerUI.setDepth(100);

        // Enemy UI (Right Side)
        const RIGHT_COL_X = 980;

        // 3. Enemy Sprite - Initialize with placeholder, update later
        this.enemySprite = this.scene.add.sprite(RIGHT_COL_X, 130, ASSETS.ENEMY_PLACEHOLDER);
        this.enemySprite.setDisplaySize(150, 150);
        this.enemySprite.setDepth(100);
        this.enemySprite.setFlipX(false);

        // 4. Enemy Stats (Below Sprite)
        this.enemyUI = this.scene.add.text(RIGHT_COL_X, 220, '', {
            font: 'bold 16px Arial',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5, 0);
        this.enemyUI.setDepth(100);

        // Center Notification
        this.centerText = this.scene.add.text(550, 300, '', {
            font: '48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false);

        // Skills
        this.createSkillButton(0, SKILLS.FIREBALL, '🔥 Fireball\n(5 Mana)', 0xff4400, () => this.combatManager.tryUseSkill(SKILLS.FIREBALL));
        this.createSkillButton(1, SKILLS.HEAL, '💚 Heal\n(8 Mana)', 0x00cc44, () => this.combatManager.tryUseSkill(SKILLS.HEAL));

        // End Turn Button
        this.endTurnBtn = this.scene.add.text(LEFT_COL_X, 550, 'END TURN', {
            font: '24px Arial',
            fill: '#ffffff',
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.endTurnBtn && this.endTurnBtn.active) {
                    this.animateButton(this.endTurnBtn);
                    this.combatManager.endTurn();
                }
            })
            .setDepth(100);
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

    createSkillButton(index, id, label, color, callback) {
        const x = 120;
        const y = 280 + (index * 70);
        const w = 140;
        const h = 50;

        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        const bg = this.scene.add.rectangle(0, 0, w, h, color)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        bg.on('pointerover', () => bg.setAlpha(0.8));
        bg.on('pointerout', () => bg.setAlpha(1));

        const text = this.scene.add.text(0, 0, label, {
            font: '14px Arial',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: w - 10 }
        }).setOrigin(0.5);

        container.add([bg, text]);
        this.skillButtons[id] = { container, bg, text, color };
    }

    /**
     * @param {Object} state - { player, enemy, turn, currentMoves, maxMoves }
     */
    updateUI(state) {
        if (!state) return;
        const { player, enemy, turn, currentMoves, maxMoves } = state;

        this.currentTurn = turn; // Store for local checks if needed

        if (!this.playerUI || !this.playerUI.active || !this.enemyUI || !this.enemyUI.active) return;

        this.currentTurn = turn; // Store for local checks if needed

        // Update Global TopBar (still coupled to RunManager via EventBus)
        EventBus.emit(EVENTS.UI_REFRESH_TOPBAR);

        // Player Stats
        if (this.playerUI && this.playerUI.active) {
            const block = player.block || 0;
            const mana = player.mana || 0;
            const strength = player.strength || 0;

            let stats = `🛡️ ${block} | 🔮 ${mana} | 👟 ${currentMoves}/${maxMoves}`;
            if (strength > 0) {
                stats += ` | 💪 ${strength}`;
            }
            this.playerUI.setText(stats);
        }

        // Enemy Visuals
        // Determine texture - View Logic: Check if asset exists, else placeholder
        if (enemy && enemy.name) {
            const foundId = Object.keys(ENEMIES).find(key => ENEMIES[key].name === enemy.name);
            if (foundId) {
                const texture = ENEMIES[foundId].texture;
                if (this.scene.textures.exists(texture)) {
                    this.enemySprite.setTexture(texture);
                }
            }
        }

        // Enemy Stats
        if (this.enemyUI && this.enemyUI.active && enemy) {
            let intentIcon = '⚔️';
            if (enemy.currentIntent && enemy.currentIntent.type === 'BLOCK') intentIcon = '🛡️';

            const eName = enemy.name ? enemy.name.toUpperCase() : 'ENEMY';
            const eHp = enemy.currentHP || 0;
            const eMaxHp = enemy.maxHP || 0;
            const eBlock = enemy.block || 0;
            const intentText = enemy.currentIntent ? enemy.currentIntent.text : 'Thinking...';

            this.enemyUI.setText(`
${eName}
❤️ ${eHp}/${eMaxHp}
🛡️ ${eBlock}
${intentIcon} ${intentText}
            `.trim());
        }

        // Update Buttons
        const canAct = turn === ENTITIES.PLAYER;

        this.updateSkillButton(SKILLS.HEAL, canAct && player.mana >= 8);
        this.updateSkillButton(SKILLS.FIREBALL, canAct && player.mana >= 5);
        this.updateEndTurnButton(canAct && (!this.scene.gridView || !this.scene.gridView.isAnimating));
    }

    updateSkillButton(id, isEnabled) {
        const btn = this.skillButtons[id];
        if (!btn) return;

        if (isEnabled) {
            btn.container.setAlpha(1);
            btn.bg.setInteractive();
        } else {
            btn.container.setAlpha(0.3);
            btn.bg.disableInteractive();
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

        this.scene.tweens.add({
            targets: this.centerText,
            scale: 1.5,
            duration: 500,
            ease: 'Back.out'
        });
    }
}

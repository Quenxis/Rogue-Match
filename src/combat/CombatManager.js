import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';

export class CombatManager {
    constructor(scene, data = {}) {
        this.scene = scene;
        const enemyId = data.enemyId || 'slime';
        const nodeType = data.nodeType || 'BATTLE';

        // Load Player State from Global RunManager
        const savedPlayer = runManager.player;
        this.player = new Player(savedPlayer.maxHP);
        this.player.currentHP = savedPlayer.currentHP;
        this.player.gold = savedPlayer.gold;
        this.player.mana = 0; // Reset Mana per battle

        // Load Enemy Data
        const enemyData = ENEMIES[enemyId] || ENEMIES['slime'];

        // Setup Enemy
        if (nodeType === 'BOSS') {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP); // Override if boss specific logic needed later
        } else {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        }

        // Store reward info
        this.goldReward = enemyData.goldReward || 10;

        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY' | 'ENDED'

        this.maxMoves = 3;
        this.currentMoves = 3;

        this.playerUI = null;
        this.enemyUI = null;
        this.centerText = null; // For Victory/Defeat

        // Skill Buttons (Phaser Objects)
        this.skillButtons = {};

        // Store bound handlers for cleanup
        this.onMatchesFound = this.handleMatches.bind(this);
        this.onSwap = this.handleSwap.bind(this);
        this.onSwapRevert = this.handleSwapRevert.bind(this);

        this.bindEvents();
        this.createUI();
        this.updateUI();
    }

    bindEvents() {
        EventBus.on('matches:found', this.onMatchesFound);
        EventBus.on('item:swapped', this.onSwap);
        EventBus.on('item:swap_reverted', this.onSwapRevert);

        window.combat = this;
    }

    destroy() {
        // Clean up events
        EventBus.off('matches:found', this.onMatchesFound);
        EventBus.off('item:swapped', this.onSwap);
        EventBus.off('item:swap_reverted', this.onSwapRevert);

        // Clean up UI
        if (this.playerUI) this.playerUI.destroy();
        if (this.enemyUI) this.enemyUI.destroy();
        if (this.centerText) this.centerText.destroy();
        if (this.endTurnBtn) this.endTurnBtn.destroy();

        Object.values(this.skillButtons).forEach(btn => {
            if (btn.container) btn.container.destroy();
        });
    }

    createUI() {
        const style = { font: '18px Arial', fill: '#ffffff', backgroundColor: '#000000', padding: { x: 5, y: 5 } };

        // Player UI (Left Side)
        this.playerUI = this.scene.add.text(10, 150, '', style);
        this.playerUI.setDepth(100);

        // Enemy UI (Right Side)
        this.enemyUI = this.scene.add.text(640, 150, '', style);
        this.enemyUI.setDepth(100);

        // Center Notification Text (Victory/Defeat)
        this.centerText = this.scene.add.text(400, 300, '', {
            font: '48px Arial',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200).setVisible(false);

        // Create Skill Buttons (Phaser Graphics + Text)
        this.createSkillButton(0, 'FIREBALL', '🔥 Fireball\n(5 Mana)', 0xff4400, () => this.tryUseSkill('FIREBALL'));
        this.createSkillButton(1, 'HEAL', '💚 Heal\n(8 Mana)', 0x00cc44, () => this.tryUseSkill('HEAL'));

        // End Turn Button
        this.endTurnBtn = this.scene.add.text(10, 500, 'END TURN', {
            font: '24px Arial',
            fill: '#ffffff',
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 10 }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.tweens.add({
                    targets: this.endTurnBtn,
                    scale: 0.9,
                    duration: 100,
                    yoyo: true
                });
                this.endTurn();
            })
            .setDepth(100);
    }

    createSkillButton(index, id, label, color, callback) {
        const x = 10;
        const y = 300 + (index * 70);
        const w = 140;
        const h = 50;

        const container = this.scene.add.container(x, y);
        container.setDepth(100);

        // Background
        const bg = this.scene.add.rectangle(0, 0, w, h, color)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        // Hover effect
        bg.on('pointerover', () => bg.setAlpha(0.8));
        bg.on('pointerout', () => bg.setAlpha(1));

        // Text
        const text = this.scene.add.text(w / 2, h / 2, label, {
            font: '14px Arial',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: w - 10 }
        }).setOrigin(0.5);

        container.add([bg, text]);

        this.skillButtons[id] = { container, bg, text, color };
    }

    updateUI() {
        if (!this.playerUI || !this.enemyUI) return;

        const p = this.player;
        const e = this.enemy;

        this.playerUI.setText(`
PLAYER
HP: ${p.currentHP}/${p.maxHP}
Block: ${p.block}
Mana: ${p.mana}
Gold: ${p.gold}
MOVES: ${this.currentMoves}/${this.maxMoves}
        `.trim());

        this.enemyUI.setText(`
${e.name.toUpperCase()}
HP: ${e.currentHP}/${e.maxHP}
Block: ${e.block}
Intent:
${e.currentIntent ? e.currentIntent.text : 'None'}
        `.trim());

        // Update Skill Button States
        const canAct = this.turn === 'PLAYER';

        // Fireball (5 Mana)
        this.updateSkillButton('FIREBALL', canAct && p.mana >= 5);
        this.updateSkillButton('HEAL', canAct && p.mana >= 8);
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

    tryUseSkill(skillName) {
        if (this.turn !== 'PLAYER') return;
        const p = this.player;
        const e = this.enemy;

        if (skillName === 'FIREBALL') {
            if (p.mana >= 5) {
                p.mana -= 5;
                e.takeDamage(15);
                this.updateUI();
                this.checkWinCondition();
            }
        } else if (skillName === 'HEAL') {
            if (p.mana >= 8) {
                p.mana -= 8;
                p.heal(20);
                this.updateUI();
            }
        }
    }

    handleSwap() {
        if (this.turn === 'PLAYER') {
            this.currentMoves--;
            this.updateUI();
        }
    }

    handleSwapRevert() {
        if (this.turn === 'PLAYER') {
            this.currentMoves++;
            this.updateUI();
        }
    }

    canInteract() {
        return this.turn === 'PLAYER' && this.currentMoves > 0;
    }

    handleMatches(data) {
        if (this.turn === 'ENDED') return;

        // If enemy is dead or player dead, stop processing
        if (this.enemy.isDead || this.player.isDead) return;

        const { matches } = data;

        const matchCounts = {};

        matches.forEach(m => {
            let type = m.type;
            if (!type) {
                const item = window.grid.grid[m.r][m.c];
                type = item.type;
            }

            matchCounts[type] = (matchCounts[type] || 0) + 1;
        });

        Object.entries(matchCounts).forEach(([type, count]) => {
            this.applyEffect(type, count);
        });

        this.updateUI();
        this.checkWinCondition();
    }

    applyEffect(type, count) {
        switch (type) {
            case ITEM_TYPES.SWORD:
                const dmg = count * 2;
                this.enemy.takeDamage(dmg);
                console.log(`Dealt ${dmg} damage!`);
                break;
            case ITEM_TYPES.SHIELD:
                const block = count * 2;
                this.player.addBlock(block);
                console.log(`Gained ${block} block!`);
                break;
            case ITEM_TYPES.POTION:
                const heal = count * 1;
                this.player.heal(heal);
                console.log(`Healed ${heal} HP!`);
                break;
            case ITEM_TYPES.MANA:
                this.player.addMana(count);
                break;
            case ITEM_TYPES.COIN:
                this.player.addGold(count);
                break;
        }
    }

    endTurn() {
        if (this.turn !== 'PLAYER') return;
        this.turn = 'ENEMY';
        this.updateUI();

        this.scene.time.delayedCall(800, () => {
            if (this.turn === 'ENDED') return;
            this.enemy.resetBlock(); // Reset block before new action
            this.enemy.executeIntent(this.player);
            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }
            this.startPlayerTurn();
        });
    }

    startPlayerTurn() {
        if (this.turn === 'ENDED') return;
        this.turn = 'PLAYER';
        this.currentMoves = this.maxMoves;
        this.player.resetBlock();
        this.enemy.generateIntent();
        this.updateUI();
    }

    checkWinCondition() {
        if (this.turn === 'ENDED') return;

        if (this.enemy.isDead) {
            this.turn = 'ENDED';
            // Note: Victory notify is skipped because RewardScene handles it now

            // SAVE STATE
            runManager.updatePlayerState(this.player.currentHP, this.player.gold + this.goldReward);
            runManager.completeLevel();

            // DELAY THEN REWARD SCENE
            this.scene.time.delayedCall(1500, () => {
                this.scene.scene.start('RewardScene', {
                    rewards: { gold: this.goldReward }
                });
            });
            return;
        }
        if (this.player.isDead) {
            this.turn = 'ENDED';
            this.showNotification('DEFEAT', 0xff0000);

            // RESTART
            this.scene.time.delayedCall(3000, () => {
                runManager.startNewRun();
                this.scene.scene.start('MapScene');
            });
            return;
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

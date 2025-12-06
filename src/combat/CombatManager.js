import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { EVENTS, ENTITIES, ASSETS, SKILLS, GAME_SETTINGS } from '../core/Constants.js';
import { runManager } from '../core/RunManager.js';
import { ENEMIES } from '../data/enemies.js';
import { logManager } from '../core/LogManager.js';


export class CombatManager {
    constructor(scene, data = {}) {
        // Scene no longer stored! Logic only.
        // Wait, some logic like 'delayedCall' used scene.time. 
        // We will need a Time Manager or pass scene context for Timers ONLY?
        // Or better: Use standard setTimeout/setInterval wrapped? 
        // Phaser's delayedCall is tied to game loop (pauses when game pauses). 
        // For now, I will keep 'scene' ONLY for timer/tweens if absolutely necessary, 
        // BUT ideally we should inject a 'timerProvider'.
        // User said: "Headless" -> "No Phaser Imports". 
        // But the scene argument is Phaser Scene. 
        // Let's store logicScene for timers, but NOT for rendering.
        this.scene = scene; // Kept strictly for .time (Timers)

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
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        } else {
            this.enemy = new Enemy(enemyData.name, enemyData.maxHP);
        }

        // Store reward info
        this.goldReward = enemyData.goldReward || 10;

        this.turn = ENTITIES.PLAYER;

        this.maxMoves = GAME_SETTINGS.MAX_MOVES;
        this.currentMoves = GAME_SETTINGS.MAX_MOVES;

        // NO UI OBJECTS HERE

        // Store bound handlers for cleanup
        this.onMatchesFound = this.handleMatches.bind(this);
        this.onSwap = this.handleSwap.bind(this);
        this.onSwapRevert = this.handleSwapRevert.bind(this);

        this.bindEvents();
    }

    init() {
        this.emitState();
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.on(EVENTS.POTION_USE_REQUESTED, (index) => this.handlePotionUse(index));
        EventBus.on(EVENTS.UI_ANIMATION_COMPLETE, () => this.emitState());

        window.combat = this;
    }

    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.off(EVENTS.POTION_USE_REQUESTED);

        // UI cleanup handled by View
    }

    handlePotionUse(index) {
        if (this.turn !== ENTITIES.PLAYER) return;

        const potion = runManager.player.potions[index];
        if (!potion || potion.type !== 'POTION') return;

        console.log(`CombatManager: Using potion ${potion.id}`);

        let used = false;
        if (potion.id === 'potion_heal') {
            this.player.heal(20);
            used = true;
        } else if (potion.id === 'potion_mana') {
            this.player.addMana(10);
            used = true;
        } else if (potion.id === 'potion_strength') {
            this.player.addStrength(2);
            used = true;
        }

        if (used) {
            runManager.removePotion(index);
            // EventBus.emit(EVENTS.UI_REFRESH_TOPBAR); -> Handled by View/RunManager
            this.emitState();
            logManager.log(`Used ${potion.name}!`, 'info');
        }
    }

    // createUI() -> REMOVED
    // createSkillButton() -> REMOVED

    emitState() {
        // Sync to global
        runManager.player.currentHP = this.player.currentHP;
        runManager.player.gold = this.player.gold;

        EventBus.emit(EVENTS.UI_UPDATE, {
            player: this.player,
            enemy: this.enemy,
            turn: this.turn,
            currentMoves: this.currentMoves,
            maxMoves: this.maxMoves
        });
    }

    // updateSkillButton() -> REMOVED

    tryUseSkill(skillName) {
        if (this.turn !== ENTITIES.PLAYER) return;
        const p = this.player;
        const e = this.enemy;

        if (skillName === SKILLS.FIREBALL) {
            if (p.mana >= 5) {
                p.mana -= 5;
                e.takeDamage(15);
                this.emitState();
                this.checkWinCondition();
            }
        } else if (skillName === SKILLS.HEAL) {
            if (p.mana >= 8) {
                p.mana -= 8;
                p.heal(20);
                this.emitState();
            }
        }
    }

    handleSwap() {
        if (this.turn === ENTITIES.PLAYER) {
            this.currentMoves--;
            this.emitState();
        }
    }

    handleSwapRevert() {
        if (this.turn === ENTITIES.PLAYER) {
            this.currentMoves++;
            this.emitState();
        }
    }

    canInteract() {
        return this.turn === ENTITIES.PLAYER && this.currentMoves > 0;
    }

    handleMatches(data) {
        if (this.turn === ENTITIES.ENDED) return;
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

        this.emitState();
        this.checkWinCondition();
    }



    applyEffect(type, count) {
        switch (type) {
            case ITEM_TYPES.SWORD:
                const dmg = count * (2 + this.player.strength);
                this.enemy.takeDamage(dmg);
                break;
            case ITEM_TYPES.SHIELD:
                const block = count * 2;
                this.player.addBlock(block);
                break;
            case ITEM_TYPES.POTION:
                const heal = count * 1;
                this.player.heal(heal);
                break;
            case ITEM_TYPES.MANA:
                this.player.addMana(count);
                logManager.log(`Player gained ${count} Mana.`, 'info');
                break;
            case ITEM_TYPES.COIN:
                this.player.addGold(count);
                logManager.log(`Found ${count} Gold.`, 'gold');
                break;
        }
    }

    endTurn() {
        if (this.turn !== ENTITIES.PLAYER) return;

        if (this.scene.gridView) {
            this.scene.gridView.skipAnimations();
        }
        if (window.grid) {
            window.grid.setFastForward(true);
        }

        this.turn = ENTITIES.ENEMY;
        this.emitState();
        logManager.log("-- ENEMY TURN --", 'turn');

        this.scene.time.delayedCall(800, () => {
            if (this.turn === ENTITIES.ENDED) return;
            this.enemy.resetBlock();

            const intent = this.enemy.currentIntent;
            this.enemy.executeIntent(this.player);

            if (intent && intent.type === 'ATTACK') {
                EventBus.emit(EVENTS.ENEMY_ATTACK, {
                    damage: intent.value,
                    intent: intent
                });
            }

            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }
            this.startPlayerTurn();
        });
    }

    startPlayerTurn() {
        if (this.turn === ENTITIES.ENDED) return;
        this.turn = ENTITIES.PLAYER;
        if (window.grid) window.grid.setFastForward(false);
        this.currentMoves = this.maxMoves;
        this.player.resetBlock();
        this.enemy.generateIntent();
        this.emitState();
        logManager.log("-- PLAYER TURN --", 'turn');
    }

    checkWinCondition() {
        if (this.turn === ENTITIES.ENDED) return;

        if (this.enemy.isDead) {
            this.turn = ENTITIES.ENDED;

            EventBus.emit(EVENTS.VICTORY, { combat: this });

            runManager.updatePlayerState(this.player.currentHP, this.player.gold + this.goldReward);
            runManager.completeLevel();

            this.scene.time.delayedCall(1500, () => {
                this.scene.scene.start('RewardScene', {
                    rewards: { gold: this.goldReward }
                });
            });
            return;
        }
        if (this.player.isDead) {
            this.turn = ENTITIES.ENDED;
            EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'DEFEAT', color: 0xff0000 });

            this.scene.time.delayedCall(3000, () => {
                runManager.startNewRun();
                this.scene.scene.start('MapScene');
            });
            return;
        }
    }

    log(message, type = 'info') {
        logManager.log(message, type);
    }
}

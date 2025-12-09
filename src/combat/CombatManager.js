import { EventBus } from '../core/EventBus.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { ITEM_TYPES } from '../logic/GridDetails.js';
import { EVENTS, ENTITIES, ASSETS, SKILLS, SKILL_DATA, GAME_SETTINGS, MOVESET_TYPES, STATUS_TYPES } from '../core/Constants.js';
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
        this.enemy.moveset = enemyData.moveset;

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
        this.generateEnemyIntent();
        this.emitState();
    }

    bindEvents() {
        EventBus.on(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.on(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.on(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.on(EVENTS.POTION_USE_REQUESTED, (index) => this.handlePotionUse(index));
        EventBus.on(EVENTS.UI_ANIMATION_COMPLETE, () => this.emitState());

        // Handle deaths from ANY source (status effects, thorns, etc.)
        this.onEntityDied = this.handleEntityDied.bind(this);
        EventBus.on(EVENTS.ENTITY_DIED, this.onEntityDied);

        window.combat = this;
    }

    destroy() {
        EventBus.off(EVENTS.MATCHES_FOUND, this.onMatchesFound);
        EventBus.off(EVENTS.ITEM_SWAPPED, this.onSwap);
        EventBus.off(EVENTS.ITEM_SWAP_REVERTED, this.onSwapRevert);
        EventBus.off(EVENTS.POTION_USE_REQUESTED);
        EventBus.off(EVENTS.ENTITY_DIED, this.onEntityDied);

        if (this.turnTimer) {
            this.turnTimer.remove(false);
            this.turnTimer = null;
        }

        // UI cleanup handled by View
    }

    /**
     * Called when ANY entity dies (from status effects, thorns, direct damage, etc.)
     * This ensures win/lose conditions are always checked.
     */
    handleEntityDied(data) {
        // Delegate all victory/defeat logic to checkWinCondition to ensure proper scene transitions
        this.checkWinCondition();
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



    tryUseSkill(skillName) {
        if (this.turn !== ENTITIES.PLAYER) return;
        const p = this.player;
        const e = this.enemy;
        const sm = p.statusManager;

        // Calculate Cost with Focus
        const focus = sm.getStack(STATUS_TYPES.FOCUS);
        let multiplier = 1.0;
        if (focus === 1) multiplier = 0.5;
        if (focus >= 2) multiplier = 0.0;

        const useSkill = (baseCost, action) => {
            const finalCost = Math.floor(baseCost * multiplier);
            if (p.mana >= finalCost) {
                p.mana -= finalCost;
                action();

                // Consume Focus if used
                if (focus > 0) {
                    sm.consumeStacks(STATUS_TYPES.FOCUS);
                    logManager.log('Focus consumed for skill!', 'info');
                }

                this.emitState();
                if (skillName === SKILLS.FIREBALL) this.checkWinCondition();
                return true;
            }
            return false;
        };

        if (skillName === SKILLS.FIREBALL) {
            const data = SKILL_DATA.FIREBALL;
            useSkill(data.cost, () => {
                EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: data.damage, type: 'SKILL', skill: 'FIREBALL' });
                e.takeDamage(data.damage);
            });
        } else if (skillName === SKILLS.HEAL) {
            const data = SKILL_DATA.HEAL;
            useSkill(data.cost, () => {
                EventBus.emit(EVENTS.PLAYER_HEAL, { value: data.heal, type: 'SKILL' });
                p.heal(data.heal);
            });
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
        if (this.turn === ENTITIES.ENDED || this.enemy.isDead || this.player.isDead) {
            this.checkWinCondition();
            return;
        }

        const { matches } = data;

        // 1. Group by Type
        const byType = {};
        matches.forEach(m => {
            let type = m.type;
            if (!type && window.grid) {
                type = window.grid.grid[m.r][m.c].type;
            }
            if (!byType[type]) byType[type] = [];
            byType[type].push(m);
        });

        // 2. Resolve Groups (Connected Components)
        Object.entries(byType).forEach(([type, tiles]) => {
            const groups = this.findConnectedGroups(tiles);
            groups.forEach(group => {
                this.resolveMatchGroup(type, group.length);
            });
        });

        this.emitState();
        this.checkWinCondition();
    }

    findConnectedGroups(tiles) {
        const groups = [];
        const visited = new Set();

        // Map for fast lookups: "r,c" -> {r,c}
        const tileMap = new Set(tiles.map(t => `${t.r},${t.c}`));

        tiles.forEach(tile => {
            const key = `${tile.r},${tile.c}`;
            if (visited.has(key)) return;

            // Start BFS
            const group = [];
            const queue = [tile];
            visited.add(key);

            while (queue.length > 0) {
                const current = queue.shift();
                group.push(current);

                const neighbors = [
                    { r: current.r - 1, c: current.c },
                    { r: current.r + 1, c: current.c },
                    { r: current.r, c: current.c - 1 },
                    { r: current.r, c: current.c + 1 }
                ];

                neighbors.forEach(n => {
                    const nKey = `${n.r},${n.c}`;
                    if (tileMap.has(nKey) && !visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push(n);
                    }
                });
            }
            groups.push(group);
        });

        return groups;
    }

    resolveMatchGroup(type, size) {
        const p = this.player;
        const e = this.enemy;
        const sm = p.statusManager;

        // Tier Logic
        // Tier 1: Size 3
        // Tier 2: Size 4
        // Tier 3: Size 5+

        switch (type) {
            case ITEM_TYPES.SWORD:
                // Base Dmg
                let dmg = size * (2 + p.strength);

                // Critical Check
                const critStacks = sm.getStack(STATUS_TYPES.CRITICAL);
                let isCrit = false;
                if (critStacks === 1) isCrit = Math.random() < 0.5;
                if (critStacks >= 2) isCrit = true;

                if (isCrit) {
                    dmg = Math.floor(dmg * 1.5);
                    logManager.log("CRITICAL HIT!", 'damage');
                    sm.consumeStacks(STATUS_TYPES.CRITICAL);
                }

                if (size >= 5) dmg = Math.floor(dmg * 1.5); // Tier 3 Dmg Boost

                // Apply Bleed (Tier 2+)
                if (size === 4) e.statusManager.applyStack(STATUS_TYPES.BLEED, 2);
                if (size >= 5) e.statusManager.applyStack(STATUS_TYPES.BLEED, 4);

                EventBus.emit(EVENTS.PLAYER_ATTACK, { damage: dmg, type: isCrit ? 'CRIT' : 'NORMAL' });
                e.takeDamage(dmg, p);
                break;

            case ITEM_TYPES.SHIELD:
                let block = size * 2;
                if (size >= 5) block = Math.floor(block * 1.5); // Boosted Block

                // Thorns (Tier 2+)
                if (size === 4) sm.applyStack(STATUS_TYPES.THORNS, 3);
                if (size >= 5) sm.applyStack(STATUS_TYPES.THORNS, 6);

                EventBus.emit(EVENTS.PLAYER_DEFEND, { value: block });
                p.addBlock(block);
                break;

            case ITEM_TYPES.POTION:
                let heal = size * 1;
                // Regen (Tier 2+)
                if (size === 4) sm.applyStack(STATUS_TYPES.REGEN, 3);

                // Big Heal + Cleanse (Tier 3)
                if (size >= 5) {
                    heal += 5;
                    sm.cleanse(10);
                }

                EventBus.emit(EVENTS.PLAYER_HEAL, { value: heal });
                p.heal(heal);
                break;

            case ITEM_TYPES.MANA:
                p.addMana(size);
                // Focus: 4->1, 5+->2
                if (size === 4) sm.applyStack(STATUS_TYPES.FOCUS, 1);
                if (size >= 5) sm.applyStack(STATUS_TYPES.FOCUS, 2);
                break;

            case ITEM_TYPES.COIN:
                p.addGold(size);
                // Critical: 4->1, 5+->2
                if (size === 4) sm.applyStack(STATUS_TYPES.CRITICAL, 1);
                if (size >= 5) sm.applyStack(STATUS_TYPES.CRITICAL, 2);
                break;
        }
    }

    endTurn() {
        if (this.turn !== ENTITIES.PLAYER) return;
        if (this.player.isDead || this.enemy.isDead) return;

        if (this.scene.gridView) {
            this.scene.gridView.skipAnimations();
        }
        if (window.grid) {
            window.grid.setFastForward(true);
        }

        this.turn = ENTITIES.ENEMY;

        // Status Effects (Turn Start)
        this.enemy.statusManager.onTurnStart();

        this.emitState();
        logManager.log("-- ENEMY TURN --", 'turn');

        if (this.turnTimer) this.turnTimer.remove(false);
        this.turnTimer = this.scene.time.delayedCall(800, () => {
            if (this.turn === ENTITIES.ENDED) return;
            this.enemy.resetBlock();

            const intent = this.enemy.currentIntent;

            // Emit Attack Event BEFORE damage is applied (so Relics like Spiked Shield see current Block)
            if (intent && intent.type === 'ATTACK') {
                EventBus.emit(EVENTS.ENEMY_ATTACK, {
                    damage: intent.value,
                    intent: intent
                });
            }

            if (intent && intent.type === 'DEFEND') {
                EventBus.emit(EVENTS.ENEMY_DEFEND, { value: intent.value });
            } else if (intent && intent.type === 'BUFF') {
                // Placeholder Animation: Use HEAL animation for Buffs (e.g. Roar)
                EventBus.emit(EVENTS.ENEMY_HEAL, { value: intent.value });

            } else if (intent && intent.type === 'DEBUFF') {
                // Placeholder Animation: Use ATTACK animation for Debuffs (e.g. Lock, Trash)
                EventBus.emit(EVENTS.ENEMY_ATTACK, {
                    damage: 0, // No damage, just animation
                    intent: intent
                });
            }

            this.executeEnemyIntent();

            if (this.player.isDead) {
                this.checkWinCondition();
                return;
            }
            this.startPlayerTurn();
        });
    }

    executeEnemyIntent() {
        if (!this.enemy.currentIntent) return;

        const intent = this.enemy.currentIntent;
        logManager.log(`Enemy executes: ${intent.text || intent.type}`, 'combat');

        switch (intent.type) {
            case MOVESET_TYPES.ATTACK:
                // Calculate damage including strength
                // If value is base damage from moveset, we add strength here or in Enemy class?
                // Enemy data has 'value': 6.
                // We should add this.enemy.getStrength() - but wait, getStrength includes base?
                // No, getStrength currently returns buff total. Base is 0.
                // Re-reading Enemy.js: getStrength returns (this.strength || 0) + buffs.
                // So we add that to the attack value.
                const totalDmg = intent.value + this.enemy.getStrength();
                this.player.takeDamage(totalDmg, this.enemy);
                logManager.log(`Enemy attacks for ${totalDmg} (Base ${intent.value} + Str ${this.enemy.getStrength()})`, 'combat');
                break;
            case MOVESET_TYPES.DEFEND:
                this.enemy.addBlock(intent.value);
                break;
            case MOVESET_TYPES.BUFF:
                if (intent.effect === 'STRENGTH') {
                    // Apply temporary buff (Duration: 3 turns to cover 2 active attacks)
                    const duration = 3;
                    this.enemy.addBuff('STRENGTH', intent.value, duration);
                    // this.enemy.strength = (this.enemy.strength || 0) + intent.value;
                    logManager.log(`Enemy gains ${intent.value} Strength for ${duration} turns!`, 'warning');

                    // SCRIPTED AI: Force 2 Attacks after Buff
                    // Find the primary ATTACK move from moveset
                    const attackMove = this.enemy.moveset.find(m => m.type === MOVESET_TYPES.ATTACK);
                    if (attackMove) {
                        this.enemy.forcedIntents.push(attackMove);
                        this.enemy.forcedIntents.push(attackMove);
                        console.log('CombatManager: Scripted 2 Attacks for Enemy.');
                    }

                } else if (intent.effect === 'HEAL') {
                    this.enemy.heal(intent.value);
                }
                break;
            case MOVESET_TYPES.DEBUFF:
                if (intent.effect === 'LOCK') {
                    if (window.grid) {
                        const count = window.grid.lockRandomGems(intent.value);
                        logManager.log(`Enemy Locked ${count} Gems!`, 'warning');
                        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'LOCKED!', color: 0x9900cc });
                    }
                } else if (intent.effect === 'TRASH') {
                    if (window.grid) {
                        const count = window.grid.trashRandomGems(intent.value);
                        logManager.log(`Enemy Trashed ${count} Gems!`, 'warning');
                        EventBus.emit(EVENTS.SHOW_NOTIFICATION, { text: 'TRASHED!', color: 0x333333 });
                    }
                }
        }
    }

    startPlayerTurn() {
        if (this.turn === ENTITIES.ENDED) return;
        this.turn = ENTITIES.PLAYER;

        // Status Effects (Turn Start)
        this.player.statusManager.onTurnStart();

        if (window.grid) window.grid.setFastForward(false);

        // Check for Deadlock (if enemy locked everything)
        if (this.scene && this.scene.gridLogic) {
            this.scene.gridLogic.checkDeadlock();
        }

        this.currentMoves = this.maxMoves;
        this.player.resetBlock();
        // Tick Buffs (Duration Based)
        this.enemy.tickBuffs();

        // Generate Next Intent
        // Ideally this logic lives in Enemy class, but for "data-driven" centralization:
        this.generateEnemyIntent();

        this.emitState();
        logManager.log("-- PLAYER TURN --", 'turn');
    }

    generateEnemyIntent() {
        // 1. Check Forced/Scripted Intents
        if (this.enemy.forcedIntents && this.enemy.forcedIntents.length > 0) {
            const next = this.enemy.forcedIntents.shift(); // Pop first
            this.enemy.currentIntent = { ...next };

            // Dynamic Update for Strength
            if (this.enemy.currentIntent.type === 'ATTACK') {
                const currentStr = this.enemy.getStrength();
                if (currentStr > 0) {
                    const totalDmg = this.enemy.currentIntent.value + currentStr;
                    this.enemy.currentIntent.text = `Attack (${totalDmg})`;
                }
            }
            console.log(`Enemy Intent (Forced): ${this.enemy.currentIntent.text}`);
            return;
        }

        const moveset = this.enemy.moveset;
        if (!moveset || moveset.length === 0) {
            // Fallback
            this.enemy.currentIntent = { type: 'ATTACK', value: 5, text: 'Attack (5)' };
            return;
        }

        // Weighted Random Selection
        const totalWeight = moveset.reduce((sum, move) => sum + (move.weight || 1), 0);
        let random = Math.random() * totalWeight;

        let selectedMove = moveset[0];
        for (const move of moveset) {
            random -= (move.weight || 1);
            if (random <= 0) {
                selectedMove = move;
                break;
            }
        }

        // CLONE the intent to avoid mutating global moveset definition
        this.enemy.currentIntent = { ...selectedMove };

        // Update Text for ATTACK to show Strength
        if (this.enemy.currentIntent.type === 'ATTACK') {
            const currentStr = this.enemy.getStrength();
            if (currentStr > 0) {
                const totalDmg = this.enemy.currentIntent.value + currentStr;
                this.enemy.currentIntent.text = `Attack (${totalDmg})`;
            }
        }

        console.log(`Enemy Intent Generated: ${this.enemy.currentIntent.text}`);
    }

    checkWinCondition() {
        if (this.turn === ENTITIES.ENDED) return;

        console.log(`CombatManager: Checking Win Condition. Enemy Dead? ${this.enemy.isDead} (${this.enemy.currentHP}), Player Dead? ${this.player.isDead}`);

        if (this.enemy.isDead) {
            this.turn = ENTITIES.ENDED;
            logManager.log('VICTORY! Enemy defeated!', 'turn');
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
            logManager.log('DEFEAT! You have been slain!', 'turn');
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

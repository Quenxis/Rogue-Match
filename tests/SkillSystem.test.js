
import { SkillSystem } from '../src/combat/skills/SkillSystem.js';
import { STATUS_TYPES } from '../src/core/Constants.js';

// Mocks
class MockStatusManager {
    constructor() {
        this.stacks = {};
    }
    getStack(type) { return this.stacks[type] || 0; }
    applyStack(type, val) { this.stacks[type] = (this.stacks[type] || 0) + val; }
    consumeStacks(type) { this.stacks[type] = 0; }
}

class MockEntity {
    constructor(isPlayer = false) {
        this.statusManager = new MockStatusManager();
        this.mana = 10;
        this.currentHP = 50;
        this.maxHP = 100;
        this.block = 0;
        this.isPlayer = isPlayer;
    }
    takeDamage(raw, source, options) {
        this.lastDamageTaken = { raw, source, options };
    }
    heal(amount) {
        this.currentHP += amount;
    }
    addBlock(amount) {
        this.block += amount;
    }
}

class MockCombatManager {
    constructor() {
        this.player = new MockEntity(true);
        this.enemy = new MockEntity(false);
        this.canInteractFlag = true;
    }
    canInteract() { return this.canInteractFlag; }
    emitState() { } // No-op
    checkWinCondition() { } // No-op
}

const runTest = (name, fn) => {
    try {
        fn();
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}: ${e.message}`);
    }
};

console.log('--- SkillSystem Tests ---');

// Setup
const cm = new MockCombatManager();
const system = new SkillSystem(cm);

// Test 1: Fireball execution (Cost 6)
runTest('Fireball execution', () => {
    cm.player.mana = 10;
    const success = system.execute('FIREBALL');
    if (!success) throw new Error('Skill failed execution');
    if (cm.player.mana !== 4) throw new Error(`Mana mismatch. Expected 4, got ${cm.player.mana}`);
    if (!cm.enemy.lastDamageTaken) throw new Error('Enemy took no damage');
    if (cm.enemy.lastDamageTaken.raw !== 8) throw new Error('Wrong damage value (Expected 8)');
});

// Test 2: Shield Slam Condition (Cost Mana 8, Shield 6)
runTest('Shield Slam condition check', () => {
    cm.player.mana = 10;
    cm.player.block = 0;

    // Should fail (needs block)
    if (system.execute('SHIELD_SLAM')) throw new Error('Executed Shield Slam without block');

    // Should pass
    cm.player.block = 6;
    if (!system.execute('SHIELD_SLAM')) throw new Error('Failed valid Shield Slam');
    if (cm.player.block !== 0) throw new Error('Block not consumed');
});

// Test 3: Unknown Skill
runTest('Unknown skill safety', () => {
    if (system.execute('OMEGA_BLAST')) throw new Error('Executed unknown skill');
});

console.log('--- Tests Complete ---');

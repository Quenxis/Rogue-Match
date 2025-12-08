import { CombatManager } from '../src/combat/CombatManager.js';
import { runManager } from '../src/core/RunManager.js';

describe('CombatManager - Logic & AI', () => {

    // Mock Scene (minimal)
    const mockScene = {
        time: { delayedCall: (ms, cb) => cb() }, // Execute immediately
        events: { emit: () => { } }
    };

    // Mock Window Grid
    window.grid = {
        lockRandomGems: () => { },
        trashRandomGems: () => { }
    };

    it('should initialize player and enemy correctly', () => {
        runManager.startNewRun();
        const cm = new CombatManager(mockScene, { enemyId: 'slime' });

        expect(cm.player.currentHP).toBe(100);
        expect(cm.enemy.name).toBe('Acid Slime');
        expect(cm.turn).toBe('PLAYER');
    });

    it('should generate intents based on weights (basic check)', () => {
        const cm = new CombatManager(mockScene, { enemyId: 'slime' });
        cm.generateEnemyIntent();
        expect(cm.enemy.currentIntent).toBeTruthy();
        console.log('Generated Intent:', cm.enemy.currentIntent);
    });

    it('should correctly execute FORCED INTENTS (Dragon Roar Logic)', () => {
        // 1. Setup Dragon
        const cm = new CombatManager(mockScene, { enemyId: 'dragon' });

        // 2. Force a BUFF intent manually to simulate picking 'Roar'
        cm.enemy.currentIntent = { type: 'BUFF', value: 5, effect: 'STRENGTH' };

        // 3. Execute Intent
        cm.executeEnemyIntent();

        // 4. Verify Buff Applied
        expect(cm.enemy.getStrength()).toBeGreaterThan(0);

        // 5. Verify Forced Intents queued (Scripted 2 Attacks)
        expect(cm.enemy.forcedIntents.length).toBe(2);
        expect(cm.enemy.forcedIntents[0].type).toBe('ATTACK');
        expect(cm.enemy.forcedIntents[1].type).toBe('ATTACK');

        // 6. Verify Next Intent Generation pulls from Queue
        cm.generateEnemyIntent();
        expect(cm.enemy.currentIntent.type).toBe('ATTACK');
        // And modified text should reflect strength
        // expect(cm.enemy.currentIntent.text).toContain(...); 
    });

    it('should calculate damage correctly with strength', () => {
        const cm = new CombatManager(mockScene, { enemyId: 'slime' });

        // Mock Player HP
        cm.player.currentHP = 100;

        // Mock Intent
        cm.enemy.currentIntent = { type: 'ATTACK', value: 10 };
        // Mock Strength
        cm.enemy.addBuff('STRENGTH', 5, 2);

        // Execute
        cm.executeEnemyIntent();

        // Exp: 100 - (10 + 5) = 85
        expect(cm.player.currentHP).toBe(85);
    });

});

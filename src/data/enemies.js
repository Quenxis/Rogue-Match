// Helper to generate dynamic moves consistency
const Actions = {
    Attack: (val, weight = 1.0) => ({
        type: 'ATTACK', value: val, weight, text: `Attack (${val})`
    }),
    HeavyAttack: (val, weight = 1.0) => ({
        type: 'ATTACK', value: val, weight, text: `Heavy Attack (${val})`
    }),
    Defend: (val, weight = 1.0) => ({
        type: 'DEFEND', value: val, weight, text: `Defend (${val})`
    }),
    BuffStrength: (val, weight = 1.0, duration = 3) => ({
        type: 'BUFF', effect: 'STRENGTH', value: val, weight, text: `Roar (Power Up ${duration} Turns)`
    }),
    DebuffLock: (val, weight = 1.0, name = 'Lock') => ({
        type: 'DEBUFF', effect: 'LOCK', value: val, weight, text: `${name} (Lock ${val})`
    }),
    DebuffTrash: (val, weight = 1.0, name = 'Trash') => ({
        type: 'DEBUFF', effect: 'TRASH', value: val, weight, text: `${name} (Trash ${val})`
    }),
    Earthquake: (dmg, weight = 1.0) => ({
        type: 'ATTACK', value: dmg, weight, effect: 'SHUFFLE', text: `Earthquake (${dmg} Dmg + Shuffle)`
    }),
    PrismaticResonance: (dmg, convertCount, weight = 1.0) => ({
        type: 'ATTACK', value: dmg, count: convertCount, weight, effect: 'MANA_CONVERT', text: `Prismatic Resonance (${dmg} Dmg + Spawn Mana)`
    }),
    ManaDevour: (weight = 1.0) => ({
        type: 'DEBUFF', value: 0, weight, text: 'Mana Devour (Consume Mana)', effect: 'MANA_DEVOUR',
        dynamicTooltip: (cfg) => {
            return `Mana Devour:
 >${cfg.threshold || 6}[icon:icon_mana]: Heal ${cfg.healPerGem}x[icon:icon_mana] + 💪
 <=${cfg.threshold || 6}[icon:icon_mana]: Self-Dmg ${cfg.damagePerGem}x[icon:icon_mana] + ☠️`;
        }
    })
};

// Probabilities sum to 1.0 (or logic handles weight)
export const ENEMIES = {
    'slime': {
        name: 'Acid Slime',
        texture: 'tex_slime',
        scale: 1.1,
        hp: 40,
        maxHP: 40,
        goldReward: 15,
        moveset: [
            Actions.Attack(6, 0.6),
            Actions.DebuffLock(2, 0.4, 'Sticky Spit')
        ]
    },
    'rat': {
        name: 'Giant Rat',
        texture: 'tex_rat',
        scale: 1.2,
        hp: 30,
        maxHP: 30,
        goldReward: 10,
        moveset: [
            Actions.Attack(10, 0.4),
            Actions.DebuffTrash(3, 0.4, 'Kick Dirt'),
            Actions.Defend(12, 0.2)
        ]
    },
    'orc': {
        name: 'Orc Warrior',
        texture: 'tex_orc',
        scale: 1.3,
        xOffset: -30,
        hp: 80,
        maxHP: 80,
        goldReward: 25,
        moveset: [
            Actions.Attack(15, 0.7),
            Actions.Defend(12, 0.3)
        ]
    },
    'skeleton': {
        name: 'Skeleton',
        texture: 'tex_skeleton',
        scale: 1.2, // Manual override to make him bigger
        yOffset: -20,
        hp: 60,
        maxHP: 60,
        goldReward: 20,
        moveset: [
            Actions.Attack(12, 0.5),
            Actions.Defend(10, 0.3),
            Actions.HeavyAttack(18, 0.2)
        ]
    },
    'dragon': {
        name: 'Young Dragon',
        texture: 'tex_dragon',
        hp: 100,
        scale: 1.4,
        maxHP: 100,
        goldReward: 70,
        isElite: true, // Now Elite, not Boss
        moveset: [
            Actions.Attack(15, 0.5),
            Actions.BuffStrength(3, 0.2),
            Actions.DebuffTrash(4, 0.3, 'Tail Sweep')
        ]
    },
    'crystal_burrower': {
        name: 'Crystal Burrower',
        texture: 'tex_crystal_burrower',
        hp: 200,
        maxHP: 200,
        scale: 1.6,
        yOffset: 20,
        goldReward: 100,
        isBoss: true,
        strengthMagnitude: 10, // Deals +10 Dmg when Powered Up
        moveset: [
            Actions.Earthquake(12, 1.0), // Turn 1
            Actions.DebuffLock(3, 1.0, 'Crystal Spores'), // Turn 2
            Actions.PrismaticResonance(8, 3, 1.0), // Turn 3: 8 DMG + Convert 3
            Actions.ManaDevour(1.0) // Turn 4
        ],
        manaDevourConfig: {
            threshold: 6,      // > 6 = Positive, <= 6 = Negative
            healPerGem: 3,      // HP Healed per gem (Positive)
            damagePerGem: 5,    // HP Lost per gem (Negative)
            strengthStacks: 2,  // Strength derived from success
            vulnerableStacks: 3 // Vulnerable derived from failure
        }
    },
    // --- ACT 2 ENEMIES ---
    'spider': {
        name: 'Giant Spider',
        texture: 'tex_rat', // Placeholder
        scale: 1.1,
        hp: 55,
        maxHP: 55,
        goldReward: 18,
        moveset: [
            Actions.Attack(8, 0.5),
            Actions.DebuffLock(2, 0.5, 'Web Shot')
        ]
    },
    'wolf': {
        name: 'Dire Wolf',
        texture: 'tex_orc', // Placeholder
        scale: 1.2,
        hp: 75,
        maxHP: 75,
        goldReward: 22,
        moveset: [
            Actions.Attack(14, 0.6),
            Actions.BuffStrength(2, 0.4)
        ]
    },
    'ent': {
        name: 'Rotten Ent',
        texture: 'tex_slime', // Placeholder (Greenish)
        scale: 1.4,
        hp: 110,
        maxHP: 110,
        goldReward: 28,
        moveset: [
            Actions.Attack(10, 0.4),
            Actions.Defend(15, 0.4),
            Actions.DebuffTrash(2, 0.2, 'Root Rot')
        ]
    },
    'corrupted_treant': {
        name: 'Corrupted Treant',
        texture: 'tex_dragon', // Placeholder (Big)
        hp: 300,
        maxHP: 300,
        scale: 1.5,
        goldReward: 150,
        isBoss: true,
        moveset: [
            Actions.Attack(20, 1.0), // Turn 1
            Actions.DebuffLock(5, 1.0, 'Tangling Roots'), // Turn 2
            Actions.BuffStrength(4, 1.0), // Turn 3
            Actions.Earthquake(15, 1.0) // Turn 4
        ]
    }
};

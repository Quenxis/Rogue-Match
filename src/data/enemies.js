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
            { type: 'ATTACK', value: 6, weight: 0.6, text: 'Attack (6)' },
            { type: 'DEBUFF', effect: 'LOCK', value: 2, weight: 0.4, text: 'Sticky Spit (Lock 2)' }
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
            { type: 'ATTACK', value: 10, weight: 0.4, text: 'Attack (10)' },
            { type: 'DEBUFF', effect: 'TRASH', value: 3, weight: 0.4, text: 'Kick Dirt (Trash 3)' },
            { type: 'DEFEND', value: 12, weight: 0.2, text: 'Defend (Block 12)' }
        ]
    },
    'orc': {
        name: 'Orc Warrior',
        texture: 'tex_orc',
        scale: 1.2,
        xOffset: -30,
        hp: 80,
        maxHP: 80,
        goldReward: 25,
        moveset: [
            { type: 'ATTACK', value: 15, weight: 0.7, text: 'Attack (15)' },
            { type: 'DEFEND', value: 12, weight: 0.3, text: 'Defend (12)' }
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
            { type: 'ATTACK', value: 12, weight: 0.5, text: 'Attack (12)' },
            { type: 'DEFEND', value: 10, weight: 0.3, text: 'Defend (10)' },
            { type: 'ATTACK', value: 18, weight: 0.2, text: 'Heavy Attack (18)' }
        ]
    },
    'dragon': {
        name: 'Young Dragon',
        texture: 'tex_dragon',
        hp: 150,
        maxHP: 150,
        goldReward: 100,
        isBoss: true,
        moveset: [
            { type: 'ATTACK', value: 15, weight: 0.4, text: 'Attack (15)' },
            { type: 'BUFF', effect: 'STRENGTH', value: 10, weight: 0.3, text: 'Roar (+10 Str)' },
            { type: 'DEBUFF', effect: 'TRASH', value: 4, weight: 0.3, text: 'Tail Sweep (Trash 4)' }
        ]
    },
};

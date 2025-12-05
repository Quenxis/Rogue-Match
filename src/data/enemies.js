export const ENEMIES = {
    'slime': {
        name: 'Acid Slime',
        texture: 'tex_slime',
        hp: 40,
        maxHP: 40,
        intent: 'Attack',
        value: 6, // Damage
        goldReward: 15
    },
    'rat': {
        name: 'Giant Rat',
        texture: 'tex_rat',
        hp: 30,
        maxHP: 30,
        intent: 'Attack',
        value: 8,
        goldReward: 10
    },
    'orc': {
        name: 'Orc Warrior',
        texture: 'tex_orc',
        hp: 80,
        maxHP: 80,
        intent: 'Attack',
        value: 12,
        goldReward: 25
    },
    'skeleton': {
        name: 'Skeleton',
        texture: 'tex_skeleton',
        hp: 60,
        maxHP: 60,
        intent: 'Block', // Maybe defense
        value: 10,
        goldReward: 20
    },
    'dragon': {
        name: 'Young Dragon',
        texture: 'tex_dragon',
        hp: 150,
        maxHP: 150,
        intent: 'Attack',
        value: 20,
        goldReward: 100,
        isBoss: true
    }
};

export const ENEMIES = {
    'slime': {
        name: 'Acid Slime',
        hp: 40,
        maxHP: 40,
        intent: 'Attack',
        value: 6, // Damage
        goldReward: 15
    },
    'rat': {
        name: 'Giant Rat',
        hp: 30,
        maxHP: 30,
        intent: 'Attack',
        value: 8,
        goldReward: 10
    },
    'orc': {
        name: 'Orc Warrior',
        hp: 80,
        maxHP: 80,
        intent: 'Attack',
        value: 12,
        goldReward: 25
    },
    'skeleton': {
        name: 'Skeleton',
        hp: 60,
        maxHP: 60,
        intent: 'Block', // Maybe defense
        value: 10,
        goldReward: 20
    },
    'dragon': {
        name: 'Young Dragon',
        hp: 150,
        maxHP: 150,
        intent: 'Attack',
        value: 20,
        goldReward: 100,
        isBoss: true
    }
};

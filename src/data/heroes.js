export const HEROES = {
    'warrior': {
        name: 'Warrior',
        texture: 'hero_sprite', // Must match ASSETS.HERO key in BootScene
        scale: 0.95,    // Scale override (1.0 = default fit)
        yOffset: -10,     // Vertical offset (positive = down, negative = up)
        skills: ['SHIELD_SLAM'], // Starting Skills
        startingRelics: ['blood_tipped_edge'] // Starting Passives (Relics)
    },
    'huntress': {
        name: 'Huntress',
        texture: 'huntress',
        scale: 0.8,
        yOffset: -10,
        skills: ['AIMED_SHOT'], // New Starting Skill
        startingRelics: ['splintered_arrowhead'] // Fits the theme
    }
};

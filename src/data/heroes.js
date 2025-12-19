export const HEROES = {
    'warrior': {
        name: 'Warrior',
        texture: 'hero_sprite', // Must match ASSETS.HERO key in BootScene
        maxHP: 80,
        gold: 10,
        scale: 0.95,    // Scale override (1.0 = default fit)
        yOffset: -10,     // Vertical offset (positive = down, negative = up)
        skills: ['SHIELD_SLAM'], // Starting Skills
        startingRelics: ['enduring_guard'] // Starting Passives (Relics)
    },
    'huntress': {
        name: 'Huntress',
        texture: 'huntress',
        maxHP: 70,
        gold: 10,
        scale: 0.8,
        yOffset: -10,
        skills: ['AIMED_SHOT'], // New Starting Skill
        startingRelics: ['quiver_of_plenty'] // Fits the theme
    },
    'plague_doctor': {
        name: 'Plague Doctor',
        maxHP: 65,
        gold: 10,
        skills: ['EXTRACTION', 'OUTBREAK'],
        startingRelics: ['corrupted_flask'],
        texture: 'hero_doctor', // Placeholder if not strictly defined, will fallback or use existing
        scale: 0.75,
        yOffset: -30
    }
};

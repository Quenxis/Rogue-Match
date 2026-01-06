export const ACTS = [
    {
        id: 'act_1_dungeon',
        name: 'The Dark Dungeon',
        length: 10,
        enemies: ['slime', 'rat', 'skeleton', 'orc'],
        elites: ['dragon'], // Mini-Bosses
        bosses: ['crystal_burrower'], // Main Boss
        background: 'bg_dungeon',
        combatOffsets: { x: 0, y: 0 }
    },
    {
        id: 'act_2_forest',
        name: 'The Cursed Forest',
        length: 12, // Slightly longer
        enemies: ['spider', 'wolf', 'ent'],
        elites: ['ent'], // Re-using Ent as Elite/Hard enemy for now, or maybe Wolf Pack? Let's use Ent.
        bosses: ['corrupted_treant'],
        background: 'bg_dungeon2',
        combatOffsets: { x: 0, y: 20 } // Placeholder offset for Act 2
    }
];

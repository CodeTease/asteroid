export const CONFIG = {
    CANVAS: {
        WIDTH: window.innerWidth,
        HEIGHT: window.innerHeight - 50,
    },
    GAME: {
        TIMESTEP: 1 / 60,
        MAX_DELTA_TIME: 0.25,
        BOSS_SPAWN_TIME: 60,
        FINAL_BOSS_WARNING_TIME: 295,
        FINAL_BOSS_SPAWN_TIME: 300,
        VOID_MODE_START_TIME: 100, // Void Time
        BEHEMOTH_SPAWN_VOID_TIME: 150,
        MONOLITH_SPAWN_VOID_TIME: 300,
        AFTERIMAGE_SPAWN_VOID_TIME: 600,
    },
    PLAYER: {
        INITIAL_SIZE: 15,
        INITIAL_SPEED: 4,
        INITIAL_PROJECTILE_SIZE: 5,
        INITIAL_PROJECTILE_DAMAGE: 1,
        INITIAL_FIRE_RATE: 1,
        MAX_HEAT: 100,
        HEAT_DECAY_RATE: 40,
        HEAT_GENERATION: 10,
        SHIELD_RECHARGE_SCORE_STEP: 1500,
    },
    ENEMIES: {
        BASE_MULTIPLIER_TIME_THRESHOLD: 200,
        VOID_MODE_HP_MULTIPLIER: 1.5,
        ELITE_HP_MULTIPLIER: 2,
        STATS: {
            standard: { size: 20, speed: 1.5, hp: 1, color: '#a9a9a9' },
            scout: { size: 12, speed: 2.5, hp: 1, color: '#add8e6' },
            brute: { size: 35, speed: 0.9, hp: 2, color: '#d2b48c' },
            shard: { size: 20, speed: 1.2, hp: 1, color: '#dda0dd' },
            shooter: { size: 25, speed: 1.2, hp: 2, color: '#9400d3' },
            splitter: { size: 30, speed: 1.2, hp: 1, color: '#ff8c00' },
            seeker: { size: 18, speed: 6, hp: 1, color: '#ff3333' },
            teleporter: { size: 28, speed: 0.2, hp: 3, color: '#00ffcc' },
            
            // Void Legion
            orbiter: { size: 15, speed: 3, hp: 3, color: '#ffff00' },
            weaver: { size: 20, speed: 2, hp: 2, color: '#ff00ff' },
            bulwark: { size: 40, speed: 0.5, hp: 10, color: '#444' },
            sizzler: { size: 50, speed: 0.5, hp: 25, color: '#ff6600' },
            juggler: { size: 25, speed: 2.5, hp: 4, color: '#00ff00' },
            anchor: { size: 15, speed: 4, hp: 3, color: '#ffffff' },
            tanker: { size: 45, speed: 1, hp: 30, color: '#8B4513' },
            stunner: { size: 30, speed: 0.5, hp: 15, color: '#FFFFE0' },
            breacher: { size: 12, speed: 5, hp: 3, color: '#FF4500' },
            
            // Bosses
            boss: { size: 60, speed: 0.8, hp: 50, color: '#ff4500' },
            finalBoss: { size: 100, speed: 1.5, hp: 1000, color: '#8b0000' },
            behemoth: { size: 80, speed: 0.5, hp: 2000, color: '#800000' },
            monolith: { size: 250, speed: 0, hp: 20000, color: '#000000' },
            afterimage: { size: 40, speed: 20, hp: 15000, color: '#00FFFF' },
            
            // Summons
            defense_drone: { size: 20, speed: 3, hp: 500, color: '#FFFFFF' },
            mini_behemoth: { size: 40, speed: 0, hp: 800, color: '#800000' },
            ghost: { size: 20, speed: 1.5, hp: 1, color: '#333333' }
        }
    },
    COLORS: {
        PARTICLE_EXPLOSION: '#ff4500',
        SHIELD: '#00e5ff',
        BARRIER_SHOCK: '#ff0000',
        LASER: '#ff0000',
    }
};

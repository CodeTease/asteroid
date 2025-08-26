/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export class AudioManager {
    sounds: { [key: string]: HTMLAudioElement[] } = {};
    activeLoopingSounds: { [key: string]: HTMLAudioElement } = {};
    isMuted: boolean = false;
    private isGameSoundsInitialized: boolean = false;
    private isMenuMusicInitialized: boolean = false;

    constructor() {
        // Initialization is deferred to specific init methods.
    }

    async initMenuMusic() {
        if (this.isMenuMusicInitialized) return;
        this.isMenuMusicInitialized = true;
        await this.loadSound('menuMusic', '/sounds/menuMusic.mp3', 1, true);
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        this.isGameSoundsInitialized = true;
        
        await Promise.all([
            this.loadSound('shoot', '/sounds/shoot.mp3', 10),
            this.loadSound('enemyShoot', '/sounds/enemyShoot.mp3', 10),
            this.loadSound('finalbossExplosion', '/sounds/finalbossExplosion.mp3', 1),
            this.loadSound('AIupgraded', '/sounds/AIupgraded.mp3', 3),
            this.loadSound('enemyDefeated', '/sounds/enemyDefeated.mp3', 15),
            this.loadSound('finalbossBegin', '/sounds/finalbossBegin.mp3', 1),
            this.loadSound('finalbossWarning', '/sounds/finalbossWarning.mp3', 1),
            this.loadSound('laseringSound', '/sounds/laseringSound.mp3', 1, true),
            this.loadSound('PlayerDead', '/sounds/PlayerDead.mp3', 1),
            this.loadSound('Playerupgraded', '/sounds/Playerupgraded.mp3', 3),
        ]);
    }

    async loadSound(name: string, src: string, poolSize: number = 5, isLooping: boolean = false) {
        try {
            const response = await fetch(src);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${src}`);
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            this.sounds[name] = [];
            for (let i = 0; i < poolSize; i++) {
                const audio = new Audio(objectUrl);
                audio.preload = 'auto';
                if (isLooping) {
                    audio.loop = true;
                }
                this.sounds[name].push(audio);
            }
        } catch (e) {
            console.error(`Failed to load sound "${name}" from "${src}":`, e);
        }
    }

    playSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name]) return;

        const pool = this.sounds[name];
        const sound = pool.find(a => a.paused || a.ended);

        if (sound) {
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch(e => console.error(`Could not play sound: ${name}`, e));
        } else {
            console.warn(`Sound pool for "${name}" is full. Consider increasing pool size.`);
        }
    }

    playLoopingSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name] || this.activeLoopingSounds[name]) return;

        const sound = this.sounds[name].find(s => s.paused); // Find an available sound
        if (sound) {
            this.activeLoopingSounds[name] = sound;
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch(e => console.error(`Could not play looping sound: ${name}`, e));
        }
    }

    stopLoopingSound(name: string) {
        const sound = this.activeLoopingSounds[name];
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
            delete this.activeLoopingSounds[name];
        }
    }

    stopAllLoopingSounds() {
        for (const name in this.activeLoopingSounds) {
            this.stopLoopingSound(name);
        }
    }
    
    playMenuMusic() {
        this.playLoopingSound('menuMusic', 0.5);
    }
    
    stopMenuMusic() {
        this.stopLoopingSound('menuMusic');
    }
}

// Create a singleton instance for global access
export const audioManager = new AudioManager();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Import sound assets directly. Vite will handle serving them with correct URLs.
import menuMusicSrc from './sounds/menuMusic.mp3';
import shootSrc from './sounds/shoot.mp3';
import enemyShootSrc from './sounds/enemyShoot.mp3';
import finalbossExplosionSrc from './sounds/finalbossExplosion.mp3';
import AIupgradedSrc from './sounds/AIupgraded.mp3';
import enemyDefeatedSrc from './sounds/enemyDefeated.mp3';
import finalbossBeginSrc from './sounds/finalbossBegin.mp3';
import finalbossWarningSrc from './sounds/finalbossWarning.mp3';
import laseringSoundSrc from './sounds/laseringSound.mp3';
import PlayerDeadSrc from './sounds/PlayerDead.mp3';
import PlayerupgradedSrc from './sounds/Playerupgraded.mp3';

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
        await this.loadSound('menuMusic', menuMusicSrc, 1, true);
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        this.isGameSoundsInitialized = true;
        
        await Promise.all([
            this.loadSound('shoot', shootSrc, 10),
            this.loadSound('enemyShoot', enemyShootSrc, 10),
            this.loadSound('finalbossExplosion', finalbossExplosionSrc, 1),
            this.loadSound('AIupgraded', AIupgradedSrc, 3),
            this.loadSound('enemyDefeated', enemyDefeatedSrc, 15),
            this.loadSound('finalbossBegin', finalbossBeginSrc, 1),
            this.loadSound('finalbossWarning', finalbossWarningSrc, 1),
            this.loadSound('laseringSound', laseringSoundSrc, 1, true),
            this.loadSound('PlayerDead', PlayerDeadSrc, 1),
            this.loadSound('Playerupgraded', PlayerupgradedSrc, 3),
        ]);
    }

    async loadSound(name: string, src: string, poolSize: number = 5, isLooping: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.sounds[name] = [];
                let loadedCount = 0;

                const onLoaded = () => {
                    loadedCount++;
                    if (loadedCount === poolSize) {
                        resolve();
                    }
                };
                
                const onError = (e: Event | string) => {
                    console.error(`Error loading sound: ${name} from ${src}`, e);
                    reject(new Error(`Could not load sound: ${name}`));
                };

                for (let i = 0; i < poolSize; i++) {
                    const audio = new Audio(src);
                    audio.preload = 'auto';
                    if (isLooping) {
                        audio.loop = true;
                    }
                    audio.addEventListener('canplaythrough', onLoaded, { once: true });
                    audio.addEventListener('error', onError, { once: true });
                    this.sounds[name].push(audio);
                    audio.load(); // Force loading to start
                }
            } catch (e) {
                console.error(`Failed to create audio for "${name}" from "${src}":`, e);
                reject(e);
            }
        });
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
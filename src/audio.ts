/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix for TypeScript error: Property 'env' does not exist on type 'ImportMeta'.
// This adds a global type definition for Vite's import.meta.env.
declare global {
  interface ImportMeta {
    readonly env: {
      readonly BASE_URL: string;
    };
  }
}

const soundPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

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
        await this.loadSound('menuMusic', soundPath('sounds/menuMusic.mp3'), 1, true);
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        this.isGameSoundsInitialized = true;
        
        try {
             await Promise.all([
                this.loadSound('shoot', soundPath('sounds/shoot.mp3'), 10),
                this.loadSound('enemyShoot', soundPath('sounds/enemyShoot.mp3'), 10),
                this.loadSound('finalbossExplosion', soundPath('sounds/finalbossExplosion.mp3'), 1),
                this.loadSound('AIupgraded', soundPath('sounds/AIupgraded.mp3'), 3),
                this.loadSound('enemyDefeated', soundPath('sounds/enemyDefeated.mp3'), 15),
                this.loadSound('finalbossBegin', soundPath('sounds/finalbossBegin.mp3'), 1),
                this.loadSound('finalbossWarning', soundPath('sounds/finalbossWarning.mp3'), 1),
                this.loadSound('laseringSound', soundPath('sounds/laseringSound.mp3'), 1, true),
                this.loadSound('PlayerDead', soundPath('sounds/PlayerDead.mp3'), 1),
                this.loadSound('Playerupgraded', soundPath('sounds/Playerupgraded.mp3'), 3),
            ]);
        } catch (error) {
            console.error("One or more game sounds failed to load.", error);
        }
    }

    private loadSound(name: string, src: string, poolSize: number = 5, isLooping: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            // Prevent re-initialization
            if (this.sounds[name]?.length > 0) {
                resolve();
                return;
            }

            this.sounds[name] = [];
            let loadedCount = 0;
            let errorCount = 0;

            const checkCompletion = () => {
                if (loadedCount + errorCount === poolSize) {
                    if (errorCount > 0) {
                        reject(new Error(`${errorCount} instance(s) of sound ${name} failed to load from ${src}.`));
                    } else {
                        resolve();
                    }
                }
            };

            for (let i = 0; i < poolSize; i++) {
                const audio = new Audio();
                
                const onCanPlayThrough = () => {
                    loadedCount++;
                    checkCompletion();
                };

                const onError = (e: Event) => {
                    errorCount++;
                    console.error(`Error loading sound asset: ${name} from ${src}. Event:`, e);
                    checkCompletion();
                };
                
                audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
                audio.addEventListener('error', onError, { once: true });
                
                audio.preload = 'auto';
                if (isLooping) {
                    audio.loop = true;
                }
                audio.src = src; // Set src to trigger loading
                
                this.sounds[name].push(audio);
            }
        });
    }

    playSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name] || this.sounds[name].length === 0) return;

        const pool = this.sounds[name];
        // Find a sound that is not currently playing.
        const sound = pool.find(a => a.paused || a.ended);

        if (sound) {
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch(e => {
                // Don't log the infamous NotSupportedError every time play is attempted.
                // The loading error is more important.
                if (e.name !== 'NotSupportedError') { 
                    console.error(`Could not play sound: ${name}`, e);
                }
            });
        }
    }

    playLoopingSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name] || this.activeLoopingSounds[name]) return;

        const sound = this.sounds[name].find(s => s.paused);
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

export const audioManager = new AudioManager();
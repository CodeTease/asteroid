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
        // Use absolute path to reference file in the 'public' directory
        await this.loadSound('menuMusic', '/sounds/menuMusic.mp3', 1, true);
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        this.isGameSoundsInitialized = true;
        
        // Use absolute paths to reference files in the 'public' directory
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
                    console.error(`Error loading sound asset: ${name} from ${src}.`, e);
                    const errorEvent = e as ErrorEvent;
                    const target = errorEvent.target as HTMLAudioElement;
                    if (target && target.error) {
                        switch(target.error.code) {
                            case 1: // MEDIA_ERR_ABORTED
                                console.error('The fetching process for the media was aborted by the user agent at the user\'s request.');
                                break;
                            case 2: // MEDIA_ERR_NETWORK
                                console.error('A network error of some description caused the user agent to stop fetching the media, despite previously being available.');
                                break;
                            case 3: // MEDIA_ERR_DECODE
                                console.error('An error of some description occurred while decoding the media resource, after it was determined to be usable.');
                                break;
                            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                                console.error('The media resource indicated by the src attribute was not suitable.');
                                break;
                            default:
                                console.error('An unknown error occurred.');
                                break;
                        }
                    }
                    reject(new Error(`Could not load sound: ${name}`));
                };

                for (let i = 0; i < poolSize; i++) {
                    const audio = new Audio();
                    audio.preload = 'auto';
                    if (isLooping) {
                        audio.loop = true;
                    }
                    
                    // Attach listeners before setting src to avoid race conditions
                    audio.addEventListener('canplaythrough', onLoaded, { once: true });
                    audio.addEventListener('error', onError, { once: true });
                    
                    this.sounds[name].push(audio);
                    audio.src = src; // Set src to trigger loading
                }
            } catch (e) {
                console.error(`Failed to create audio element for "${name}" from "${src}":`, e);
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
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Constructs the correct public path for an asset.
 * In a Vite project, `import.meta.env.BASE_URL` provides the correct base path,
 * which is '/' for a root deployment or '/repository-name/' for a GitHub Pages deployment.
 * @param relativePath The path to the asset relative to the public directory.
 * @returns The absolute path to the asset.
 */
function getAssetPath(relativePath: string): string {
    // Ensures there's no double slash between the base and the relative path.
    // FIX: Cast `import.meta` to `any` to access the Vite-specific `env` property
    return ((import.meta as any).env.BASE_URL + relativePath).replace(/\/+/g, '/');
}


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
        // Paths are relative to the public directory
        await this.loadSound('menuMusic', 'sounds/menuMusic.mp3', 1, true);
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        this.isGameSoundsInitialized = true;
        
        try {
             await Promise.all([
                this.loadSound('shoot', 'sounds/shoot.mp3', 10),
                this.loadSound('enemyShoot', 'sounds/enemyShoot.mp3', 10),
                this.loadSound('finalbossExplosion', 'sounds/finalbossExplosion.mp3', 1),
                this.loadSound('AIupgraded', 'sounds/AIupgraded.mp3', 3),
                this.loadSound('enemyDefeated', 'sounds/enemyDefeated.mp3', 15),
                this.loadSound('finalbossBegin', 'sounds/finalbossBegin.mp3', 1),
                this.loadSound('finalbossWarning', 'sounds/finalbossWarning.mp3', 1),
                this.loadSound('laseringSound', 'sounds/laseringSound.mp3', 1, true),
                this.loadSound('PlayerDead', 'sounds/PlayerDead.mp3', 1),
                this.loadSound('Playerupgraded', 'sounds/Playerupgraded.mp3', 3),
            ]);
        } catch (error) {
            console.error("One or more game sounds failed to load.", error);
        }
    }

    private async loadSound(name: string, src: string, poolSize: number = 5, isLooping: boolean = false): Promise<void> {
        // Prevent re-initialization
        if (this.sounds[name]?.length > 0) {
            return;
        }
        
        const fullPath = getAssetPath(src);

        try {
            // Fetch the audio file as a blob. This is more reliable for pathing in deployed apps.
            const response = await fetch(fullPath);
            if (!response.ok) {
                console.error(`Failed to fetch sound '${name}' at '${fullPath}'. Status: ${response.status}. Content-Type: ${response.headers.get('Content-Type')}`);
                throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
            }
            const originalBlob = await response.blob();

             // Check if the fetched content is likely HTML, which would indicate a server routing issue.
            if (originalBlob.type.includes('html')) {
                 console.error(`Fetched resource for sound '${name}' at '${fullPath}' seems to be an HTML file, not audio. This is likely a server misconfiguration for SPA routing.`);
                 throw new Error(`Invalid content type for audio file: ${originalBlob.type}`);
            }

            // Re-create the blob with the correct MIME type to fix "no supported sources" error.
            const typedBlob = new Blob([originalBlob], { type: 'audio/mpeg' });
            // Create an in-memory URL for the blob.
            const objectUrl = URL.createObjectURL(typedBlob);

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
            console.error(`Failed to load sound "${name}" from "${fullPath}":`, e);
            // Propagate the error to stop Promise.all if needed
            throw e;
        }
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
                // Don't log interruptions, as they are normal.
                if (e.name !== 'AbortError') {
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
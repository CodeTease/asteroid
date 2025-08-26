/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export class AudioManager {
    private audioContext: AudioContext | null = null;
    private decodedBuffers: { [key: string]: AudioBuffer } = {};
    private activeLoopingSources: { [key: string]: AudioBufferSourceNode } = {};
    isMuted: boolean = false;
    private isGameSoundsInitialized: boolean = false;
    private isMenuMusicInitialized: boolean = false;

    constructor() {
        // Defer context creation to a user interaction
    }

    private async initAudioContext() {
        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            return;
        }
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API is not supported in this browser', e);
            alert('Web Audio API is not supported in this browser. Sound will not work.');
        }
    }

    async initializeAfterInteraction() {
        await this.initAudioContext();
    }

    async initMenuMusic() {
        if (this.isMenuMusicInitialized) return;
        this.isMenuMusicInitialized = true;
        await this.loadSound('menuMusic', 'sounds/menuMusic.mp3');
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) return;
        if (!this.audioContext) {
            console.error("AudioContext not initialized. Call initializeAfterInteraction() first.");
            return;
        }
        this.isGameSoundsInitialized = true;
        
        try {
             await Promise.all([
                this.loadSound('shoot', 'sounds/shoot.mp3'),
                this.loadSound('enemyShoot', 'sounds/enemyShoot.mp3'),
                this.loadSound('finalbossExplosion', 'sounds/finalbossExplosion.mp3'),
                this.loadSound('AIupgraded', 'sounds/AIupgraded.mp3'),
                this.loadSound('enemyDefeated', 'sounds/enemyDefeated.mp3'),
                this.loadSound('finalbossBegin', 'sounds/finalbossBegin.mp3'),
                this.loadSound('finalbossWarning', 'sounds/finalbossWarning.mp3'),
                this.loadSound('laseringSound', 'sounds/laseringSound.mp3'),
                this.loadSound('PlayerDead', 'sounds/PlayerDead.mp3'),
                this.loadSound('Playerupgraded', 'sounds/Playerupgraded.mp3'),
            ]);
        } catch (error) {
            console.error("One or more game sounds failed to load.", error);
        }
    }

    private async loadSound(name: string, src: string): Promise<void> {
        if (!this.audioContext) {
             throw new Error("AudioContext not initialized. Cannot load sound.");
        }
        if (this.decodedBuffers[name]) {
            return;
        }

        const fullPath = new URL(src, window.location.href).href;

        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
            }

            // --- ROBUST DIAGNOSTIC CHECK ---
            // Clone the response so we can read it twice (once as text, once as buffer)
            const responseForCheck = response.clone();
            try {
                const textContent = await responseForCheck.text();
                // A definitive check to see if we got an HTML document instead of audio
                if (textContent.trim().startsWith('<')) {
                    throw new Error(`Server returned a file that looks like HTML instead of audio for ${fullPath}. This is a classic SPA fallback issue. Please check your hosting configuration to ensure that requests to .mp3 files are not redirected to index.html.`);
                }
            } catch (e) {
                // If it's a real binary file, .text() will fail, which is expected.
                // We only care about the custom error thrown above.
                if (e instanceof Error && e.message.startsWith('Server returned')) {
                    throw e; // Re-throw our specific error to be caught by the outer catch.
                }
            }
            // --- END DIAGNOSTIC ---

            const arrayBuffer = await response.arrayBuffer();
            // decodeAudioData will throw a specific DOMException if the audio data is invalid/corrupt
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.decodedBuffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load and decode sound "${name}" from "${fullPath}":`, e);
            throw e;
        }
    }

    playSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.decodedBuffers[name] || !this.audioContext) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.decodedBuffers[name];
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0);
    }

    playLoopingSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.decodedBuffers[name] || this.activeLoopingSources[name] || !this.audioContext) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.decodedBuffers[name];
        source.loop = true;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.start(0);
        this.activeLoopingSources[name] = source;
    }

    stopLoopingSound(name: string) {
        const source = this.activeLoopingSources[name];
        if (source) {
            try {
                source.stop(0);
            } catch (e) {
                // Ignore errors if the source has already stopped
            }
            delete this.activeLoopingSources[name];
        }
    }

    stopAllLoopingSounds() {
        for (const name in this.activeLoopingSources) {
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
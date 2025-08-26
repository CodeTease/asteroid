/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export class AudioManager {
    private audioContext: AudioContext | null = null;
    private sounds: { [key: string]: AudioBuffer } = {};
    private activeLoopingSounds: { [key: string]: { source: AudioBufferSourceNode, gainNode: GainNode } } = {};
    isMuted: boolean = false;
    private isGameSoundsInitialized: boolean = false;
    private isMenuMusicInitialized: boolean = false;

    constructor() {
        // Initialization is handled by the init() method on first user gesture.
    }

    private async init() {
        if (this.audioContext) return;
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            // Resume context on user gesture if it's in a suspended state
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (e) {
            console.error("Web Audio API is not supported in this browser", e);
            this.isMuted = true; // Disable audio if not supported
        }
    }

    async initMenuMusic() {
        if (this.isMenuMusicInitialized) return;
        await this.init(); // Ensure context is created on first user interaction
        if (!this.audioContext) return;
        this.isMenuMusicInitialized = true;
        await this.loadSound('menuMusic', '/sounds/menuMusic.mp3');
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) {
            return;
        }
        await this.init(); // Ensure context exists
        if (!this.audioContext) return;
        this.isGameSoundsInitialized = true;
        
        await Promise.all([
            this.loadSound('shoot', '/sounds/shoot.mp3'),
            this.loadSound('enemyShoot', '/sounds/enemyShoot.mp3'),
            this.loadSound('finalbossExplosion', '/sounds/finalbossExplosion.mp3'),
            this.loadSound('AIupgraded', '/sounds/AIupgraded.mp3'),
            this.loadSound('enemyDefeated', '/sounds/enemyDefeated.mp3'),
            this.loadSound('finalbossBegin', '/sounds/finalbossBegin.mp3'),
            this.loadSound('finalbossWarning', '/sounds/finalbossWarning.mp3'),
            this.loadSound('laseringSound', '/sounds/laseringSound.mp3'),
            this.loadSound('PlayerDead', '/sounds/PlayerDead.mp3'),
            this.loadSound('Playerupgraded', '/sounds/Playerupgraded.mp3'),
        ]);
    }

    private async loadSound(name: string, src: string): Promise<void> {
        if (!this.audioContext) {
            console.error("AudioContext not initialized. Cannot load sound.");
            return;
        }
        if (this.sounds[name]) {
            return; // Already loaded
        }
        try {
            const response = await fetch(src);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${src}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load or decode sound: ${name} from ${src}`, e);
            // Don't rethrow, to allow other sounds to load.
        }
    }

    playSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name] || !this.audioContext) return;

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start(0);
        } catch(e) {
            console.error(`Error playing sound "${name}":`, e);
        }
    }

    playLoopingSound(name: string, volume: number = 1.0) {
        if (this.isMuted || !this.sounds[name] || !this.audioContext || this.activeLoopingSounds[name]) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            source.loop = true;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start(0);

            this.activeLoopingSounds[name] = { source, gainNode };
        } catch(e) {
            console.error(`Error playing looping sound "${name}":`, e);
        }
    }

    stopLoopingSound(name: string) {
        const sound = this.activeLoopingSounds[name];
        if (sound) {
            sound.source.stop(0);
            sound.source.disconnect();
            sound.gainNode.disconnect();
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

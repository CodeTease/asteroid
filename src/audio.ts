/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// IMPORTANT: Ensure the 'sounds' directory is inside the 'src' directory.
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
    private audioContext: AudioContext | null = null;
    private decodedBuffers: { [key: string]: AudioBuffer } = {};
    private activeLoopingSources: { [key: string]: AudioBufferSourceNode } = {};
    isMuted: boolean = false;
    private isGameSoundsInitialized: boolean = false;
    private isMenuMusicInitialized: boolean = false;

    private soundSources: Record<string, string> = {
        'menuMusic': menuMusicSrc,
        'shoot': shootSrc,
        'enemyShoot': enemyShootSrc,
        'finalbossExplosion': finalbossExplosionSrc,
        'AIupgraded': AIupgradedSrc,
        'enemyDefeated': enemyDefeatedSrc,
        'finalbossBegin': finalbossBeginSrc,
        'finalbossWarning': finalbossWarningSrc,
        'laseringSound': laseringSoundSrc,
        'PlayerDead': PlayerDeadSrc,
        'Playerupgraded': PlayerupgradedSrc,
    };

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
        await this.loadSound('menuMusic');
    }

    async initGameSounds() {
        if (this.isGameSoundsInitialized) return;
        if (!this.audioContext) {
            console.error("AudioContext not initialized. Call initializeAfterInteraction() first.");
            return;
        }
        this.isGameSoundsInitialized = true;
        
        try {
            const gameSoundNames = Object.keys(this.soundSources).filter(name => name !== 'menuMusic');
            await Promise.all(gameSoundNames.map(name => this.loadSound(name)));
        } catch (error) {
            console.error("One or more game sounds failed to load.", error);
        }
    }

    private async loadSound(name: string): Promise<void> {
        if (!this.audioContext) {
             throw new Error("AudioContext not initialized. Cannot load sound.");
        }
        if (this.decodedBuffers[name]) {
            return;
        }

        const fullPath = this.soundSources[name];
         if (!fullPath) {
            const error = new Error(`Sound source for "${name}" not found. Have you moved the 'sounds' folder into 'src'?`);
            console.error(error);
            throw error;
        }

        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
            }
            
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
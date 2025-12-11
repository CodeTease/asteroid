
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export class AudioManager {
    audioContext = null;
    decodedBuffers = {};
    activeLoopingSources = {};
    isMuted = false;
    isGameSoundsInitialized = false;
    isMenuMusicInitialized = false;

    soundSources = {
        'menuMusic': 'https://cdn.teaserverse.online/sounds/asteroid/menuMusic.mp3',
        'shoot': 'https://cdn.teaserverse.online/sounds/asteroid/shoot.mp3',
        'enemyShoot': 'https://cdn.teaserverse.online/sounds/asteroid/enemyShoot.mp3',
        'finalbossExplosion': 'https://cdn.teaserverse.online/sounds/asteroid/finalbossExplosion.mp3',
        'AIupgraded': 'https://cdn.teaserverse.online/sounds/asteroid/AIupgraded.mp3',
        'enemyDefeated': 'https://cdn.teaserverse.online/sounds/asteroid/enemyDefeated.mp3',
        'finalbossBegin': 'https://cdn.teaserverse.online/sounds/asteroid/finalbossBegin.mp3',
        'finalbossWarning': 'https://cdn.teaserverse.online/sounds/asteroid/finalbossWarning.mp3',
        'laseringSound': 'https://cdn.teaserverse.online/sounds/asteroid/laseringSound.mp3',
        'PlayerDead': 'https://cdn.teaserverse.online/sounds/asteroid/PlayerDead.mp3',
        'Playerupgraded': 'https://cdn.teaserverse.online/sounds/asteroid/Playerupgraded.mp3',
    };

    constructor() {
        // Defer context creation to a user interaction
    }

    async initAudioContext() {
        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            return;
        }
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API is not supported in this browser', e);
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

    async loadSound(name) {
        if (!this.audioContext) {
             throw new Error("AudioContext not initialized. Cannot load sound.");
        }
        if (this.decodedBuffers[name]) {
            return;
        }

        const fullPath = this.soundSources[name];
         if (!fullPath) {
            const error = new Error(`Sound source URL for "${name}" not found.`);
            console.error(error);
            throw error;
        }

        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error(`Server returned a file that looks like HTML instead of an audio file. Check your CDN paths and server configuration. URL: ${fullPath}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.decodedBuffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load and decode sound "${name}" from "${fullPath}":`, e);
            throw e;
        }
    }

    playSound(name, volume = 1.0) {
        if (this.isMuted || !this.decodedBuffers[name] || !this.audioContext) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.decodedBuffers[name];
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0);
    }

    playLoopingSound(name, volume = 1.0) {
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

    stopLoopingSound(name) {
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
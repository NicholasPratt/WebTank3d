class AudioManager {
            constructor() { this.audioCtx = null; this.masterGain = null; }
            init(audioContext) { if (!this.audioCtx) { this.audioCtx = audioContext; this.masterGain = this.audioCtx.createGain(); this.masterGain.gain.value = 0.7; this.masterGain.connect(this.audioCtx.destination); } }
            setVolume(value) { if (this.masterGain) this.masterGain.gain.setTargetAtTime(Number(value), this.audioCtx.currentTime, .02); }
            get output() { return this.masterGain || (this.audioCtx && this.audioCtx.destination); }
            _createSound(type, freq, decay, volume = 0.5) {
                if (!this.audioCtx) return;
                const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
                osc.connect(gain); gain.connect(this.output);
                osc.type = type; osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + decay);
                osc.start(this.audioCtx.currentTime); osc.stop(this.audioCtx.currentTime + decay);
            }
            _createNoise(duration, volume = 0.5) {
                if (!this.audioCtx) return;
                const bufferSize = this.audioCtx.sampleRate * duration;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
                const noise = this.audioCtx.createBufferSource(); noise.buffer = buffer;
                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
                noise.connect(gain); gain.connect(this.output); noise.start();
            }
            playGlitchSound() {
                if (!this.audioCtx) return;
                this._createNoise(0.3, 0.5);
                const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
                osc.connect(gain); gain.connect(this.output);
                osc.type = 'square'; osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
                osc.start(); osc.stop(this.audioCtx.currentTime + 0.3);
            }
            playerShootCannon() { this._createSound('triangle', 800, 0.3, 0.3); this._createSound('sine', 400, 0.3, 0.3); }
            playerShootMG() { this._createNoise(0.05, 0.1); this._createSound('square', 1200, 0.05, 0.2); }
            enemyShoot() { this._createSound('square', 300, 0.4, 0.2); }
            infantryShoot() { this._createNoise(0.04, 0.15); this._createSound('sawtooth', 1500, 0.06, 0.1); }
            artilleryFire() { this._createSound('sawtooth', 50, 1.5, 0.8); this._createNoise(1.0, 0.6); }
            artilleryWhistle(duration = 2.0) {
                if (!this.audioCtx) return null;
                const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
                osc.connect(gain);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(2000, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(400, this.audioCtx.currentTime + duration);
                gain.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.4, this.audioCtx.currentTime + duration * 0.8);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
                osc.start(this.audioCtx.currentTime);
                osc.stop(this.audioCtx.currentTime + duration);
                return gain;
            }
            playerHit() { this._createNoise(0.2, 0.8); }
            infantryHit() { this._createSound('sine', 1500, 0.1, 0.3); }
            explosion() { this._createNoise(0.5, 0.6); }
            destruction() { this._createNoise(1.2, 1.0); this._createSound('sawtooth', 100, 1.2, 0.8); }
            powerupPickup() { this._createSound('square', 1000, 0.3, 0.4); }
            shardPickup() { this._createSound('sine', 1800, 0.1, 0.2); }
        }

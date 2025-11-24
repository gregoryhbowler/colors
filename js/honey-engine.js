// Honey Synth Engine (Atlantix/SH-101-inspired)
// Modern Web Audio take on classic subtractive synthesis
// VCO A/B → Mixer → Filter → Drive → VCA with comprehensive modulation

export class HoneySynth {
    constructor(ctx) {
        this.ctx = ctx;
        this.output = ctx.createGain();
        this.output.gain.value = 0.3;
        
        // === VCO A (Primary SH-101-style oscillator) ===
        this.vcoA = {
            sawOsc: ctx.createOscillator(),
            pulseOsc: ctx.createOscillator(),
            sawGain: ctx.createGain(),
            pulseGain: ctx.createGain(),
            octave: 0,
            fine: 0,
            pulseWidth: 0.5,
            pwmAmount: 0,
            pwmSource: 'lfo',
            fmAmount: 0
        };
        
        this.vcoA.sawOsc.type = 'sawtooth';
        this.vcoA.pulseOsc.type = 'square';
        this.vcoA.sawGain.gain.value = 0.5;
        this.vcoA.pulseGain.gain.value = 0;
        
        // === VCO B (Secondary oscillator OR LFO) ===
        this.vcoB = {
            osc: ctx.createOscillator(),
            audioGain: ctx.createGain(),
            lfoGain: ctx.createGain(),
            mode: 'lfo',
            shape: 'sine',
            octave: -1,
            fine: 0,
            level: 0.3,
            rate: 2
        };
        
        this.vcoB.osc.type = 'sine';
        this.vcoB.osc.frequency.value = 2;
        this.vcoB.audioGain.gain.value = 0;
        this.vcoB.lfoGain.gain.value = 0;
        
        // === Sub Oscillator ===
        this.sub = {
            osc: ctx.createOscillator(),
            gain: ctx.createGain(),
            type: '-1',
            level: 0
        };
        
        this.sub.osc.type = 'square';
        this.sub.gain.gain.value = 0;
        
        // === Noise Generator ===
        this.noise = {
            buffer: this.createNoiseBuffer(),
            source: null,
            gain: ctx.createGain(),
            level: 0
        };
        
        this.noise.gain.gain.value = 0;
        this.startNoiseSource();
        
        // === Mixer ===
        this.mixer = ctx.createGain();
        this.mixer.gain.value = 0.4;
        
        // === Filter ===
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1000;
        this.filter.Q.value = 1;
        
        this.filterMod = {
            envAmount: 0,
            lfoAmount: 0,
            keyTrack: 0,
            envGain: ctx.createGain(),
            lfoGain: ctx.createGain()
        };
        
        this.filterMod.envGain.gain.value = 0;
        this.filterMod.lfoGain.gain.value = 0;
        
        // === ADSR Envelope ===
        this.envelope = {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.5,
            release: 0.5,
            rateRange: 'medium',
            attackMult: 1,
            decayMult: 1,
            releaseMult: 1
        };
        
        this.updateEnvelopeMultipliers();
        
        this.envFollower = ctx.createGain();
        this.envFollower.gain.value = 0;
        
        // === Drive/Saturation ===
        this.drive = {
            shaper: ctx.createWaveShaper(),
            mode: 'off',
            amount: 0.5
        };
        
        this.updateDriveCurve();
        
        // === VCA ===
        this.vca = ctx.createGain();
        this.vca.gain.value = 0;
        
        // === PWM Modulation ===
        this.pwmMod = {
            envGain: ctx.createGain(),
            lfoGain: ctx.createGain(),
            constantSource: ctx.createConstantSource()
        };
        
        this.pwmMod.envGain.gain.value = 0;
        this.pwmMod.lfoGain.gain.value = 0;
        this.pwmMod.constantSource.offset.value = 0.5;
        
        // === LFO Modulation Routing ===
        this.lfoMod = {
            pitchGain: ctx.createGain(),
            filterGain: ctx.createGain(),
            pwmGain: ctx.createGain(),
            ampGain: ctx.createGain(),
            pitchAmount: 0,
            filterAmount: 0,
            pwmAmount: 0,
            ampAmount: 0
        };
        
        this.lfoMod.pitchGain.gain.value = 0;
        this.lfoMod.filterGain.gain.value = 0;
        this.lfoMod.pwmGain.gain.value = 0;
        this.lfoMod.ampGain.gain.value = 0;
        
        // === Audio Routing ===
        this.vcoA.sawOsc.connect(this.vcoA.sawGain);
        this.vcoA.pulseOsc.connect(this.vcoA.pulseGain);
        this.vcoA.sawGain.connect(this.mixer);
        this.vcoA.pulseGain.connect(this.mixer);
        
        this.vcoB.osc.connect(this.vcoB.audioGain);
        this.vcoB.osc.connect(this.vcoB.lfoGain);
        
        this.sub.osc.connect(this.sub.gain);
        this.sub.gain.connect(this.mixer);
        
        this.noise.gain.connect(this.mixer);
        
        this.mixer.connect(this.filter);
        this.filter.connect(this.drive.shaper);
        this.drive.shaper.connect(this.vca);
        this.vca.connect(this.output);
        
        this.envFollower.connect(this.filterMod.envGain);
        this.envFollower.connect(this.pwmMod.envGain);
        
        this.vcoB.lfoGain.connect(this.lfoMod.pitchGain);
        this.vcoB.lfoGain.connect(this.lfoMod.filterGain);
        this.vcoB.lfoGain.connect(this.lfoMod.pwmGain);
        this.vcoB.lfoGain.connect(this.lfoMod.ampGain);
        
        this.lfoMod.pitchGain.connect(this.vcoA.sawOsc.frequency);
        this.lfoMod.pitchGain.connect(this.vcoA.pulseOsc.frequency);
        this.lfoMod.filterGain.connect(this.filter.frequency);
        this.lfoMod.ampGain.connect(this.vca.gain);
        
        this.filterMod.envGain.connect(this.filter.frequency);
        this.filterMod.lfoGain.connect(this.filter.frequency);
        
        this.vcoA.sawOsc.start();
        this.vcoA.pulseOsc.start();
        this.vcoB.osc.start();
        this.sub.osc.start();
        this.pwmMod.constantSource.start();
        
        this.currentFreq = 440;
        this.isNotePlaying = false;
    }
    
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }
    
    startNoiseSource() {
        if (this.noise.source) {
            this.noise.source.stop();
        }
        
        this.noise.source = this.ctx.createBufferSource();
        this.noise.source.buffer = this.noise.buffer;
        this.noise.source.loop = true;
        this.noise.source.connect(this.noise.gain);
        this.noise.source.start();
    }
    
    updateEnvelopeMultipliers() {
        switch(this.envelope.rateRange) {
            case 'fast':
                this.envelope.attackMult = 0.2;
                this.envelope.decayMult = 0.3;
                this.envelope.releaseMult = 0.3;
                break;
            case 'slow':
                this.envelope.attackMult = 3;
                this.envelope.decayMult = 2.5;
                this.envelope.releaseMult = 2.5;
                break;
            default:
                this.envelope.attackMult = 1;
                this.envelope.decayMult = 1;
                this.envelope.releaseMult = 1;
        }
    }
    
    updateDriveCurve() {
        const amount = this.drive.amount;
        const mode = this.drive.mode;
        
        if (mode === 'off') {
            this.drive.shaper.curve = null;
            return;
        }
        
        const n_samples = 256;
        const curve = new Float32Array(n_samples);
        
        for (let i = 0; i < n_samples; i++) {
            const x = (i * 2) / n_samples - 1;
            let y;
            
            if (mode === 'sym') {
                const k = amount * 50 + 1;
                y = (x * k) / (1 + Math.abs(x * k));
            } else {
                const k = amount * 30 + 1;
                if (x >= 0) {
                    y = Math.tanh(x * k * 1.5);
                } else {
                    y = Math.tanh(x * k * 0.8);
                }
            }
            
            curve[i] = y;
        }
        
        this.drive.shaper.curve = curve;
    }
    
    updateVcoBMode() {
        if (this.vcoB.mode === 'audio') {
            this.vcoB.audioGain.disconnect();
            this.vcoB.audioGain.connect(this.mixer);
            this.vcoB.audioGain.gain.value = this.vcoB.level;
            this.vcoB.lfoGain.gain.value = 0;
            
            const freq = this.currentFreq * Math.pow(2, this.vcoB.octave) * 
                         Math.pow(2, this.vcoB.fine / 1200);
            this.vcoB.osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        } else {
            this.vcoB.audioGain.disconnect();
            this.vcoB.audioGain.gain.value = 0;
            this.vcoB.lfoGain.gain.value = 1;
            
            this.vcoB.osc.frequency.setValueAtTime(this.vcoB.rate, this.ctx.currentTime);
        }
    }
    
    noteOn(freq, velocity = 1) {
        const now = this.ctx.currentTime;
        this.currentFreq = freq;
        this.isNotePlaying = true;
        
        const vcoAFreq = freq * Math.pow(2, this.vcoA.octave) * 
                        Math.pow(2, this.vcoA.fine / 1200);
        
        this.vcoA.sawOsc.frequency.setTargetAtTime(vcoAFreq, now, 0.001);
        this.vcoA.pulseOsc.frequency.setTargetAtTime(vcoAFreq, now, 0.001);
        
        const subOctaveShift = this.sub.type === '-2' ? -2 : -1;
        const subFreq = freq * Math.pow(2, subOctaveShift);
        this.sub.osc.frequency.setTargetAtTime(subFreq, now, 0.001);
        
        if (this.vcoB.mode === 'audio') {
            const vcoBFreq = freq * Math.pow(2, this.vcoB.octave) * 
                            Math.pow(2, this.vcoB.fine / 1200);
            this.vcoB.osc.frequency.setTargetAtTime(vcoBFreq, now, 0.001);
        }
        
        this.lfoMod.pitchGain.gain.setValueAtTime(
            this.lfoMod.pitchAmount * vcoAFreq * 0.05,
            now
        );
        this.lfoMod.filterGain.gain.setValueAtTime(
            this.lfoMod.filterAmount * 1000,
            now
        );
        this.lfoMod.pwmGain.gain.setValueAtTime(
            this.lfoMod.pwmAmount * 0.4,
            now
        );
        this.lfoMod.ampGain.gain.setValueAtTime(
            this.lfoMod.ampAmount * 0.2,
            now
        );
        
        const currentGain = this.vca.gain.value;
        const attack = Math.max(0.003, this.envelope.attack * this.envelope.attackMult);
        const decay = Math.max(0.01, this.envelope.decay * this.envelope.decayMult);
        
        this.vca.gain.cancelScheduledValues(now);
        this.vca.gain.setValueAtTime(currentGain, now);
        this.vca.gain.linearRampToValueAtTime(velocity, now + attack);
        this.vca.gain.linearRampToValueAtTime(
            velocity * this.envelope.sustain,
            now + attack + decay
        );
        
        this.envFollower.gain.cancelScheduledValues(now);
        this.envFollower.gain.setValueAtTime(this.envFollower.gain.value, now);
        this.envFollower.gain.linearRampToValueAtTime(1, now + attack);
        this.envFollower.gain.linearRampToValueAtTime(
            this.envelope.sustain,
            now + attack + decay
        );
        
        const filterBase = this.filter.frequency.value;
        const envToFilter = this.filterMod.envAmount;
        
        if (Math.abs(envToFilter) > 0.01) {
            this.filterMod.envGain.gain.cancelScheduledValues(now);
            this.filterMod.envGain.gain.setValueAtTime(0, now);
            this.filterMod.envGain.gain.linearRampToValueAtTime(
                envToFilter * 3000,
                now + attack
            );
            this.filterMod.envGain.gain.linearRampToValueAtTime(
                envToFilter * 3000 * this.envelope.sustain,
                now + attack + decay
            );
        }
        
        if (this.vcoA.pwmSource === 'env' && this.vcoA.pwmAmount > 0) {
            this.pwmMod.envGain.gain.cancelScheduledValues(now);
            this.pwmMod.envGain.gain.setValueAtTime(0, now);
            this.pwmMod.envGain.gain.linearRampToValueAtTime(
                this.vcoA.pwmAmount * 0.4,
                now + attack
            );
            this.pwmMod.envGain.gain.linearRampToValueAtTime(
                this.vcoA.pwmAmount * 0.4 * this.envelope.sustain,
                now + attack + decay
            );
        }
    }
    
    noteOff() {
        const now = this.ctx.currentTime;
        this.isNotePlaying = false;
        
        const currentGain = this.vca.gain.value;
        const release = Math.max(0.003, this.envelope.release * this.envelope.releaseMult);
        
        this.vca.gain.cancelScheduledValues(now);
        this.vca.gain.setValueAtTime(currentGain, now);
        this.vca.gain.linearRampToValueAtTime(0, now + release);
        
        this.envFollower.gain.cancelScheduledValues(now);
        this.envFollower.gain.setValueAtTime(this.envFollower.gain.value, now);
        this.envFollower.gain.linearRampToValueAtTime(0, now + release);
        
        this.filterMod.envGain.gain.cancelScheduledValues(now);
        this.filterMod.envGain.gain.setValueAtTime(
            this.filterMod.envGain.gain.value,
            now
        );
        this.filterMod.envGain.gain.linearRampToValueAtTime(0, now + release);
        
        this.pwmMod.envGain.gain.cancelScheduledValues(now);
        this.pwmMod.envGain.gain.setValueAtTime(
            this.pwmMod.envGain.gain.value,
            now
        );
        this.pwmMod.envGain.gain.linearRampToValueAtTime(0, now + release);
    }
    
    setParam(param, value) {
        const now = this.ctx.currentTime;
        
        switch(param) {
            case 'vcoAOctave':
                this.vcoA.octave = value;
                break;
            case 'vcoAFine':
                this.vcoA.fine = value;
                break;
            case 'vcoASawLevel':
                this.vcoA.sawGain.gain.setTargetAtTime(value, now, 0.01);
                break;
            case 'vcoAPulseLevel':
                this.vcoA.pulseGain.gain.setTargetAtTime(value, now, 0.01);
                break;
            case 'pulseWidth':
                this.vcoA.pulseWidth = value;
                break;
            case 'pwmAmount':
                this.vcoA.pwmAmount = value;
                break;
            case 'pwmSource':
                this.vcoA.pwmSource = value;
                break;
            case 'vcoBMode':
                this.vcoB.mode = value;
                this.updateVcoBMode();
                break;
            case 'vcoBShape':
                this.vcoB.shape = value;
                this.vcoB.osc.type = value;
                break;
            case 'vcoBOctave':
                this.vcoB.octave = value;
                if (this.vcoB.mode === 'audio') {
                    this.updateVcoBMode();
                }
                break;
            case 'vcoBFine':
                this.vcoB.fine = value;
                if (this.vcoB.mode === 'audio') {
                    this.updateVcoBMode();
                }
                break;
            case 'vcoBLevel':
                this.vcoB.level = value;
                if (this.vcoB.mode === 'audio') {
                    this.vcoB.audioGain.gain.setTargetAtTime(value, now, 0.01);
                }
                break;
            case 'lfoRate':
                this.vcoB.rate = value;
                if (this.vcoB.mode === 'lfo') {
                    this.vcoB.osc.frequency.setTargetAtTime(value, now, 0.01);
                }
                break;
            case 'subType':
                this.sub.type = value;
                break;
            case 'subLevel':
                this.sub.level = value;
                this.sub.gain.gain.setTargetAtTime(value, now, 0.01);
                break;
            case 'noiseLevel':
                this.noise.level = value;
                this.noise.gain.gain.setTargetAtTime(value, now, 0.01);
                break;
            case 'filterFreq':
                this.filter.frequency.setTargetAtTime(value, now, 0.01);
                break;
            case 'filterRes':
                this.filter.Q.setTargetAtTime(value, now, 0.01);
                break;
            case 'filterType':
                this.filter.type = value;
                break;
            case 'envToFilter':
                this.filterMod.envAmount = value;
                break;
            case 'lfoToFilter':
                this.filterMod.lfoAmount = value;
                this.lfoMod.filterGain.gain.setValueAtTime(value * 1000, now);
                break;
            case 'keyTrack':
                this.filterMod.keyTrack = value;
                break;
            case 'attack':
                this.envelope.attack = value;
                break;
            case 'decay':
                this.envelope.decay = value;
                break;
            case 'sustain':
                this.envelope.sustain = value;
                break;
            case 'release':
                this.envelope.release = value;
                break;
            case 'envRate':
                this.envelope.rateRange = value;
                this.updateEnvelopeMultipliers();
                break;
            case 'driveMode':
                this.drive.mode = value;
                this.updateDriveCurve();
                break;
            case 'driveAmount':
                this.drive.amount = value;
                this.updateDriveCurve();
                break;
            case 'lfoToPitch':
                this.lfoMod.pitchAmount = value;
                break;
            case 'lfoToPWM':
                this.lfoMod.pwmAmount = value;
                break;
            case 'lfoToAmp':
                this.lfoMod.ampAmount = value;
                this.lfoMod.ampGain.gain.setValueAtTime(value * 0.2, now);
                break;
            case 'vcoAShape':
                this.vcoA.sawOsc.type = value;
                break;
            case 'vcoALevel':
                this.vcoA.sawGain.gain.setTargetAtTime(value, now, 0.01);
                break;
        }
    }
    
    randomPatch() {
        const vcoAShapes = ['sawtooth', 'square', 'triangle'];
        this.setParam('vcoASawLevel', Math.random() > 0.3 ? Math.random() * 0.5 + 0.3 : 0);
        this.setParam('vcoAPulseLevel', Math.random() > 0.5 ? Math.random() * 0.4 + 0.2 : 0);
        this.setParam('vcoAOctave', Math.floor(Math.random() * 5) - 2);
        this.setParam('vcoAFine', (Math.random() - 0.5) * 50);
        
        if (Math.random() > 0.6) {
            this.setParam('pwmAmount', Math.random() * 0.6 + 0.2);
            this.setParam('pwmSource', Math.random() > 0.5 ? 'lfo' : 'env');
        } else {
            this.setParam('pwmAmount', 0);
        }
        
        const vcoBShapes = ['sine', 'triangle', 'sawtooth', 'square'];
        this.setParam('vcoBMode', Math.random() > 0.7 ? 'audio' : 'lfo');
        this.setParam('vcoBShape', vcoBShapes[Math.floor(Math.random() * vcoBShapes.length)]);
        this.setParam('vcoBOctave', Math.floor(Math.random() * 4) - 2);
        this.setParam('vcoBLevel', Math.random() * 0.4 + 0.1);
        
        if (Math.random() > 0.2) {
            this.setParam('lfoRate', Math.pow(Math.random(), 2) * 8 + 0.1);
        } else {
            this.setParam('lfoRate', Math.random() * 20 + 10);
        }
        
        if (Math.random() > 0.5) {
            this.setParam('subLevel', Math.random() * 0.5 + 0.2);
            this.setParam('subType', Math.random() > 0.5 ? '-1' : '-2');
        } else {
            this.setParam('subLevel', 0);
        }
        
        if (Math.random() > 0.7) {
            this.setParam('noiseLevel', Math.random() * 0.2 + 0.05);
        } else {
            this.setParam('noiseLevel', 0);
        }
        
        const filterFreq = Math.pow(Math.random(), 1.5) * 3700 + 300;
        this.setParam('filterFreq', filterFreq);
        this.setParam('filterRes', Math.pow(Math.random(), 2) * 12 + 0.5);
        
        this.setParam('envToFilter', (Math.random() - 0.3) * 0.8);
        this.setParam('lfoToFilter', Math.random() > 0.6 ? Math.random() * 0.6 : 0);
        
        this.setParam('attack', Math.pow(Math.random(), 3) * 0.3 + 0.003);
        this.setParam('decay', Math.pow(Math.random(), 1.5) * 1.5 + 0.1);
        this.setParam('sustain', Math.random() * 0.6 + 0.3);
        this.setParam('release', Math.pow(Math.random(), 1.5) * 2 + 0.05);
        
        const rateRand = Math.random();
        if (rateRand < 0.15) {
            this.setParam('envRate', 'fast');
        } else if (rateRand > 0.85) {
            this.setParam('envRate', 'slow');
        } else {
            this.setParam('envRate', 'medium');
        }
        
        if (Math.random() > 0.6) {
            this.setParam('driveMode', Math.random() > 0.5 ? 'sym' : 'asym');
            this.setParam('driveAmount', Math.random() * 0.6 + 0.2);
        } else {
            this.setParam('driveMode', 'off');
        }
        
        this.setParam('lfoToPitch', Math.random() > 0.7 ? Math.random() * 0.5 : 0);
        this.setParam('lfoToPWM', Math.random() > 0.6 ? Math.random() * 0.6 : 0);
        this.setParam('lfoToAmp', Math.random() > 0.8 ? Math.random() * 0.4 : 0);
    }
    
    dispose() {
        try {
            this.vcoA.sawOsc.stop();
            this.vcoA.pulseOsc.stop();
            this.vcoB.osc.stop();
            this.sub.osc.stop();
            this.noise.source?.stop();
            this.pwmMod.constantSource.stop();
        } catch(e) {}
    }
}

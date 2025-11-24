// Molly Synth Engine (Juno/Jupiter/CS-80 inspired polysynth)
// Web Audio implementation with chorus and ring modulation

export class MollySynth {
    constructor(ctx, maxVoices = 1) {
        this.ctx = ctx;
        this.output = ctx.createGain();
        this.output.gain.value = 0.3;
        
        this.voices = [];
        this.maxVoices = Math.max(1, Math.min(8, maxVoices));
        
        // Global LFO
        this.lfo = {
            osc: ctx.createOscillator(),
            waveShape: 0,
            freq: 5,
            fade: 0,
            fadeGain: ctx.createGain()
        };
        this.lfo.osc.type = 'sine';
        this.lfo.osc.frequency.value = 5;
        this.lfo.fadeGain.gain.value = 1;
        this.lfo.osc.connect(this.lfo.fadeGain);
        this.lfo.osc.start();
        
        // Global ring modulator
        this.ringMod = {
            osc: ctx.createOscillator(),
            freq: 50,
            fade: 0,
            mix: 0
        };
        this.ringMod.osc.type = 'sine';
        this.ringMod.osc.frequency.value = 50;
        this.ringMod.osc.start();
        
        // Shared parameters
        this.params = {
            oscWaveShape: 2,
            pwMod: 0.2,
            pwModSource: 0,
            freqModLfo: 0,
            freqModEnv: 0,
            glide: 0,
            mainOscLevel: 1,
            subOscLevel: 0,
            subOscDetune: 0,
            noiseLevel: 0.1,
            hpFilterCutoff: 10,
            lpFilterType: 1,
            lpFilterCutoff: 300,
            lpFilterResonance: 0.1,
            lpFilterCutoffEnvSelect: 0,
            lpFilterCutoffModEnv: 0.25,
            lpFilterCutoffModLfo: 0,
            lpFilterTracking: 1,
            lfoFade: 0,
            env1Attack: 0.01,
            env1Decay: 0.3,
            env1Sustain: 0.5,
            env1Release: 0.5,
            env2Attack: 0.01,
            env2Decay: 0.3,
            env2Sustain: 0.5,
            env2Release: 0.5,
            amp: 0.5,
            ampMod: 0,
            ringModFreq: 50,
            ringModFade: 0,
            ringModMix: 0,
            chorusMix: 0.8
        };
        
        // Chorus effect
        this.chorus = {
            preGain: ctx.createGain(),
            delay1: ctx.createDelay(),
            delay2: ctx.createDelay(),
            lfo1: ctx.createOscillator(),
            lfo2: ctx.createOscillator(),
            lfo1Gain: ctx.createGain(),
            lfo2Gain: ctx.createGain(),
            wet: ctx.createGain(),
            dry: ctx.createGain(),
            filter: ctx.createBiquadFilter(),
            mix: 0.8
        };
        
        this.chorus.delay1.delayTime.value = 0.01;
        this.chorus.delay2.delayTime.value = 0.01;
        this.chorus.lfo1.type = 'sine';
        this.chorus.lfo2.type = 'sine';
        this.chorus.lfo1.frequency.value = 0.5;
        this.chorus.lfo2.frequency.value = 0.75;
        this.chorus.lfo1Gain.gain.value = 0.003;
        this.chorus.lfo2Gain.gain.value = 0.003;
        this.chorus.filter.type = 'lowpass';
        this.chorus.filter.frequency.value = 14000;
        this.chorus.wet.gain.value = 0.8;
        this.chorus.dry.gain.value = 0.2;
        
        this.chorus.lfo1.connect(this.chorus.lfo1Gain);
        this.chorus.lfo2.connect(this.chorus.lfo2Gain);
        this.chorus.lfo1Gain.connect(this.chorus.delay1.delayTime);
        this.chorus.lfo2Gain.connect(this.chorus.delay2.delayTime);
        
        this.chorus.preGain.connect(this.chorus.delay1);
        this.chorus.preGain.connect(this.chorus.delay2);
        this.chorus.preGain.connect(this.chorus.dry);
        
        this.chorus.delay1.connect(this.chorus.wet);
        this.chorus.delay2.connect(this.chorus.wet);
        
        this.chorus.dry.connect(this.chorus.filter);
        this.chorus.wet.connect(this.chorus.filter);
        this.chorus.filter.connect(this.output);
        
        this.chorus.lfo1.start();
        this.chorus.lfo2.start();
        
        // Initialize voice pool
        for (let i = 0; i < 8; i++) {
            this.voices.push(new InternalVoice(ctx, this));
        }
        
        this.lastFreq = 440;
    }
    
    noteOn(freq, velocity = 1) {
        let voice = null;
        
        for (let i = 0; i < this.maxVoices; i++) {
            if (!this.voices[i].active) {
                voice = this.voices[i];
                break;
            }
        }
        
        if (!voice) {
            for (let i = 0; i < this.maxVoices; i++) {
                if (this.voices[i].releasing) {
                    voice = this.voices[i];
                    break;
                }
            }
        }
        
        if (!voice) {
            voice = this.voices[0];
        }
        
        voice.triggerOn(freq, velocity, this.params, this.lastFreq);
        this.lastFreq = freq;
    }
    
    noteOff() {
        for (let i = 0; i < this.maxVoices; i++) {
            if (this.voices[i].active && !this.voices[i].releasing) {
                this.voices[i].triggerOff();
            }
        }
    }
    
    setParam(name, value) {
        const now = this.ctx.currentTime;
        
        if (name in this.params) {
            this.params[name] = value;
        }
        
        switch(name) {
            case 'polyphony':
                this.maxVoices = Math.max(1, Math.min(8, value));
                break;
            case 'lfoFreq':
                this.lfo.osc.frequency.setTargetAtTime(value, now, 0.01);
                break;
            case 'lfoWaveShape':
                const shapes = ['sine', 'triangle', 'sawtooth', 'square', 'square'];
                this.lfo.osc.type = shapes[value] || 'sine';
                break;
            case 'ringModFreq':
                this.ringMod.osc.frequency.setTargetAtTime(value, now, 0.01);
                break;
            case 'chorusMix':
                this.chorus.mix = value;
                this.chorus.wet.gain.setTargetAtTime(value * 0.5, now, 0.01);
                this.chorus.dry.gain.setTargetAtTime(1 - value * 0.3, now, 0.01);
                this.chorus.lfo1Gain.gain.setTargetAtTime(value * 0.005, now, 0.01);
                this.chorus.lfo2Gain.gain.setTargetAtTime(value * 0.005, now, 0.01);
                break;
            case 'amp':
                this.output.gain.setTargetAtTime(Math.min(1.0, value / 2), now, 0.01);
                break;
        }
    }
    
    randomPatch(soundType = 'any') {
        if (soundType === 'any') {
            const types = ['lead', 'pad', 'percussion'];
            const weights = [0.4, 0.4, 0.2];
            const rand = Math.random();
            let sum = 0;
            for (let i = 0; i < types.length; i++) {
                sum += weights[i];
                if (rand < sum) {
                    soundType = types[i];
                    break;
                }
            }
        }
        
        this.setParam('oscWaveShape', Math.floor(Math.random() * 3));
        this.setParam('pwMod', Math.random());
        this.setParam('pwModSource', Math.floor(Math.random() * 3));
        
        this.setParam('lpFilterType', Math.floor(Math.random() * 2));
        this.setParam('lpFilterCutoffEnvSelect', Math.floor(Math.random() * 2));
        this.setParam('lpFilterTracking', Math.random() * 2);
        
        this.setParam('lfoFreq', this.mapExp(Math.random(), 0.05, 20));
        this.setParam('lfoWaveShape', Math.floor(Math.random() * 5));
        this.setParam('lfoFade', (Math.random() - 0.5) * 30);
        
        this.setParam('env1Decay', this.mapExp(Math.random(), 0.002, 10));
        this.setParam('env1Sustain', Math.random());
        this.setParam('env1Release', this.mapExp(Math.random(), 0.002, 10));
        
        this.setParam('ringModFreq', this.mapExp(Math.random(), 10, 300));
        this.setParam('chorusMix', Math.random());
        
        if (soundType === 'lead') {
            this.randomizeLead();
        } else if (soundType === 'pad') {
            this.randomizePad();
        } else {
            this.randomizePercussion();
        }
        
        if (this.params.mainOscLevel < 0.6 && this.params.subOscLevel < 0.6 && this.params.noiseLevel < 0.6) {
            this.setParam('mainOscLevel', 0.6 + Math.random() * 0.4);
        }
        
        if (this.params.lpFilterCutoff > 12000 && Math.random() > 0.7) {
            this.setParam('hpFilterCutoff', this.mapExp(Math.random(), 10, this.params.lpFilterCutoff * 0.05));
        } else {
            this.setParam('hpFilterCutoff', 10);
        }
        
        if (this.params.lpFilterCutoff < 600 && this.params.lpFilterCutoffModEnv < 0) {
            this.setParam('lpFilterCutoffModEnv', Math.abs(this.params.lpFilterCutoffModEnv));
        }
    }
    
    randomizeLead() {
        this.setParam('freqModLfo', this.mapExp(Math.pow(Math.random(), 2), 0.0000001, 0.1));
        this.setParam('freqModEnv', Math.random() > 0.95 ? (Math.random() - 0.5) * 0.12 : 0);
        this.setParam('glide', this.mapExp(Math.pow(Math.random(), 2), 0.0000001, 1));
        
        if (Math.random() > 0.8) {
            this.setParam('mainOscLevel', 1);
            this.setParam('subOscLevel', 0);
        } else {
            this.setParam('mainOscLevel', Math.random());
            this.setParam('subOscLevel', Math.random());
        }
        
        if (Math.random() > 0.9) {
            this.setParam('subOscDetune', (Math.random() - 0.5) * 10);
        } else {
            const detunes = [0, 0, 0, 4, 5, -4, -5];
            this.setParam('subOscDetune', detunes[Math.floor(Math.random() * detunes.length)]);
        }
        
        this.setParam('noiseLevel', this.mapExp(Math.random(), 0.0000001, 1));
        this.setParam('lpFilterCutoff', this.mapExp(Math.pow(Math.random(), 2), 100, 12000));
        this.setParam('lpFilterResonance', Math.random() * 0.9);
        this.setParam('lpFilterCutoffModEnv', (Math.random() - 0.3) * 0.8);
        this.setParam('lpFilterCutoffModLfo', Math.random() * 0.2);
        
        this.setParam('env2Attack', this.mapExp(Math.random(), 0.002, 0.5));
        this.setParam('env2Decay', this.mapExp(Math.random(), 0.002, 10));
        this.setParam('env2Sustain', Math.random());
        this.setParam('env2Release', this.mapExp(Math.random(), 0.002, 3));
        
        this.setParam('env1Attack', Math.random() > 0.8 ? this.params.env2Attack : this.mapExp(Math.random(), 0.002, 1));
        
        if (this.params.env2Decay < 0.2 && this.params.env2Sustain < 0.15) {
            this.setParam('env2Decay', this.mapExp(Math.random(), 0.2, 10));
        }
        
        this.setParam('amp', Math.random() > 0.8 ? this.mapLin(Math.random(), 0.75, 11) : this.mapLin(Math.random(), 0.75, 0.9));
        this.setParam('ampMod', this.mapLin(Math.random(), 0, 0.5));
        
        this.setParam('ringModFade', (Math.random() - 0.5) * 24);
        this.setParam('ringModMix', Math.random() > 0.8 ? Math.pow(Math.random(), 2) : 0);
    }
    
    randomizePad() {
        this.setParam('freqModLfo', this.mapExp(Math.pow(Math.random(), 4), 0.0000001, 0.2));
        this.setParam('freqModEnv', Math.random() > 0.8 ? this.mapLin(Math.pow(Math.random(), 4), -0.1, 0.2) : 0);
        this.setParam('glide', this.mapExp(Math.pow(Math.random(), 2), 0.0000001, 5));
        
        this.setParam('mainOscLevel', Math.random());
        this.setParam('subOscLevel', Math.random());
        this.setParam('subOscDetune', (Math.random() - 0.5) * 10);
        this.setParam('noiseLevel', this.mapExp(Math.random(), 0.0000001, 1));
        
        this.setParam('lpFilterCutoff', this.mapExp(Math.random(), 100, 12000));
        this.setParam('lpFilterResonance', Math.random());
        this.setParam('lpFilterCutoffModEnv', (Math.random() - 0.5) * 1.2);
        this.setParam('lpFilterCutoffModLfo', Math.random());
        
        this.setParam('env1Attack', this.mapExp(Math.random(), 0.002, 5));
        this.setParam('env2Attack', this.mapExp(Math.random(), 0.002, 5));
        this.setParam('env2Decay', this.mapExp(Math.random(), 0.002, 10));
        this.setParam('env2Sustain', 0.1 + Math.random() * 0.9);
        this.setParam('env2Release', this.mapExp(Math.random(), 0.5, 10));
        
        this.setParam('amp', this.mapLin(Math.random(), 0.5, 0.8));
        this.setParam('ampMod', Math.random());
        
        this.setParam('ringModFade', (Math.random() - 0.5) * 30);
        this.setParam('ringModMix', Math.random() > 0.8 ? Math.random() : 0);
    }
    
    randomizePercussion() {
        this.setParam('freqModLfo', this.mapExp(Math.pow(Math.random(), 2), 0.0000001, 1));
        this.setParam('freqModEnv', this.mapLin(Math.pow(Math.random(), 4), -1, 1));
        this.setParam('glide', this.mapExp(Math.pow(Math.random(), 2), 0.0000001, 5));
        
        this.setParam('mainOscLevel', Math.random());
        this.setParam('subOscLevel', Math.random());
        this.setParam('subOscDetune', (Math.random() - 0.5) * 10);
        this.setParam('noiseLevel', this.mapLin(Math.random(), 0.1, 1));
        
        this.setParam('lpFilterCutoff', this.mapExp(Math.random(), 100, 6000));
        this.setParam('lpFilterResonance', Math.random() > 0.6 ? this.mapLin(Math.random(), 0.5, 1) : Math.random());
        this.setParam('lpFilterCutoffModEnv', this.mapLin(Math.random(), -0.3, 0.8));
        this.setParam('lpFilterCutoffModLfo', Math.random());
        
        this.setParam('env1Attack', this.mapExp(Math.random(), 0.002, 5));
        this.setParam('env2Attack', 0.002);
        this.setParam('env2Decay', this.mapExp(Math.pow(Math.random(), 4), 0.008, 1.8));
        this.setParam('env2Sustain', 0);
        this.setParam('env2Release', this.params.env2Decay);
        
        if (this.params.env2Decay < 0.15 && this.params.env1Attack > 1) {
            this.setParam('env1Attack', this.params.env2Decay);
        }
        
        this.setParam('amp', Math.random() > 0.7 ? this.mapLin(Math.random(), 0.75, 11) : this.mapLin(Math.random(), 0.75, 1));
        this.setParam('ampMod', this.mapLin(Math.random(), 0, 0.2));
        
        this.setParam('ringModFade', this.mapLin(Math.random(), -15, 2));
        this.setParam('ringModMix', Math.random() > 0.4 ? Math.random() : 0);
    }
    
    mapLin(x, min, max) {
        return min + (max - min) * x;
    }
    
    mapExp(x, min, max) {
        if (min <= 0) min = 0.001;
        return min * Math.pow(max / min, x);
    }
    
    dispose() {
        try {
            this.lfo.osc.stop();
            this.ringMod.osc.stop();
            this.chorus.lfo1.stop();
            this.chorus.lfo2.stop();
            this.voices.forEach(v => v.dispose());
        } catch(e) {}
    }
}

class InternalVoice {
    constructor(ctx, parent) {
        this.ctx = ctx;
        this.parent = parent;
        this.active = false;
        this.releasing = false;
        
        this.mainOsc = ctx.createOscillator();
        this.mainOscGain = ctx.createGain();
        this.mainOsc.type = 'sawtooth';
        this.mainOscGain.gain.value = 0;
        
        this.subOsc = ctx.createOscillator();
        this.subOscGain = ctx.createGain();
        this.subOsc.type = 'square';
        this.subOscGain.gain.value = 0;
        
        this.noise = ctx.createBufferSource();
        this.noise.buffer = this.createNoiseBuffer();
        this.noise.loop = true;
        this.noiseGain = ctx.createGain();
        this.noiseGain.gain.value = 0;
        
        this.hpFilter = ctx.createBiquadFilter();
        this.hpFilter.type = 'highpass';
        this.hpFilter.frequency.value = 10;
        
        this.lpFilter1 = ctx.createBiquadFilter();
        this.lpFilter1.type = 'lowpass';
        this.lpFilter1.frequency.value = 1000;
        
        this.lpFilter2 = ctx.createBiquadFilter();
        this.lpFilter2.type = 'lowpass';
        this.lpFilter2.frequency.value = 1000;
        
        this.vca = ctx.createGain();
        this.vca.gain.value = 0;
        
        this.mainOsc.connect(this.mainOscGain);
        this.subOsc.connect(this.subOscGain);
        this.noise.connect(this.noiseGain);
        
        this.mainOscGain.connect(this.hpFilter);
        this.subOscGain.connect(this.hpFilter);
        this.noiseGain.connect(this.hpFilter);
        
        this.hpFilter.connect(this.lpFilter1);
        this.lpFilter1.connect(this.lpFilter2);
        this.lpFilter2.connect(this.vca);
        this.vca.connect(this.parent.chorus.preGain);
        
        this.mainOsc.start();
        this.subOsc.start();
        this.noise.start();
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
    
    clampFreq(freq) {
        return Math.max(20, Math.min(20000, freq));
    }
    
    triggerOn(freq, velocity, params, lastFreq) {
        const now = this.ctx.currentTime;
        this.active = true;
        this.releasing = false;
        
        this.vca.gain.cancelScheduledValues(now);
        this.vca.gain.setValueAtTime(0, now);
        
        const glide = params.glide;
        if (glide > 0.001) {
            this.mainOsc.frequency.cancelScheduledValues(now);
            this.mainOsc.frequency.setValueAtTime(lastFreq, now);
            this.mainOsc.frequency.linearRampToValueAtTime(freq, now + glide);
        } else {
            this.mainOsc.frequency.setTargetAtTime(freq, now, 0.001);
        }
        
        this.subOsc.frequency.setTargetAtTime(freq * 0.5 * Math.pow(2, params.subOscDetune / 12), now, 0.001);
        
        this.mainOscGain.gain.setTargetAtTime(params.mainOscLevel * 0.5, now, 0.001);
        this.subOscGain.gain.setTargetAtTime(params.subOscLevel * 0.4, now, 0.001);
        this.noiseGain.gain.setTargetAtTime(params.noiseLevel * 0.2, now, 0.001);
        
        const waveShapes = ['triangle', 'sawtooth', 'square'];
        this.mainOsc.type = waveShapes[params.oscWaveShape] || 'sawtooth';
        
        this.hpFilter.frequency.setTargetAtTime(this.clampFreq(params.hpFilterCutoff), now, 0.001);
        
        let baseLpFreq = params.lpFilterCutoff * Math.pow(freq / 440, params.lpFilterTracking);
        baseLpFreq = this.clampFreq(Math.min(12000, baseLpFreq));
        
        this.lpFilter1.frequency.setTargetAtTime(baseLpFreq, now, 0.001);
        this.lpFilter1.Q.setTargetAtTime(this.mapQ(params.lpFilterResonance), now, 0.001);
        
        if (params.lpFilterType === 1) {
            this.lpFilter2.frequency.setTargetAtTime(baseLpFreq, now, 0.001);
            this.lpFilter2.Q.setTargetAtTime(this.mapQ(params.lpFilterResonance) * 0.5, now, 0.001);
        } else {
            this.lpFilter2.frequency.setTargetAtTime(20000, now, 0.001);
        }
        
        const attack = Math.max(0.002, params.env2Attack);
        const decay = Math.max(0.002, params.env2Decay);
        const sustain = params.env2Sustain;
        
        this.vca.gain.linearRampToValueAtTime(velocity * 0.8, now + attack);
        this.vca.gain.linearRampToValueAtTime(velocity * sustain * 0.8, now + attack + decay);
        
        const envAmount = params.lpFilterCutoffModEnv;
        if (Math.abs(envAmount) > 0.01) {
            const maxModDepth = Math.min(4, 8000 / baseLpFreq);
            const scaledEnvAmount = envAmount * maxModDepth;
            
            let envTarget = baseLpFreq * (1 + scaledEnvAmount);
            let envSustain = baseLpFreq * (1 + scaledEnvAmount * sustain);
            
            envTarget = this.clampFreq(Math.min(18000, envTarget));
            envSustain = this.clampFreq(Math.min(18000, envSustain));
            
            this.lpFilter1.frequency.cancelScheduledValues(now);
            this.lpFilter1.frequency.setValueAtTime(baseLpFreq, now);
            this.lpFilter1.frequency.exponentialRampToValueAtTime(envTarget, now + attack);
            this.lpFilter1.frequency.exponentialRampToValueAtTime(envSustain, now + attack + decay);
        }
    }
    
    triggerOff() {
        if (!this.active || this.releasing) return;
        
        const now = this.ctx.currentTime;
        this.releasing = true;
        
        const release = Math.max(0.002, this.parent.params.env2Release);
        
        this.vca.gain.cancelScheduledValues(now);
        this.vca.gain.setValueAtTime(this.vca.gain.value, now);
        this.vca.gain.linearRampToValueAtTime(0, now + release);
        
        const currentFilterFreq = this.lpFilter1.frequency.value;
        this.lpFilter1.frequency.cancelScheduledValues(now);
        this.lpFilter1.frequency.setValueAtTime(this.clampFreq(currentFilterFreq), now);
        this.lpFilter1.frequency.exponentialRampToValueAtTime(100, now + release);
        
        setTimeout(() => {
            this.active = false;
            this.releasing = false;
        }, release * 1000 + 100);
    }
    
    mapQ(res) {
        return res * 19 + 0.5;
    }
    
    dispose() {
        try {
            this.mainOsc.stop();
            this.subOsc.stop();
            this.noise.stop();
        } catch(e) {}
    }
}

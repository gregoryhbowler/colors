// Vinegar Synth Engine (Passersby/Buchla-inspired)
// West Coast synthesis with waveshaping, wave folding, LPG, FM, LFO routing, and reverb

export class VinegarSynth {
    constructor(ctx) {
        this.ctx = ctx;
        this.output = ctx.createGain();
        this.output.gain.value = 0.3;
        
        // === Core VCO ===
        this.vco = ctx.createOscillator();
        this.vcoGain = ctx.createGain();
        this.vco.type = 'sine';
        this.vcoGain.gain.value = 1.0;
        this.currentFreq = 440;
        
        // === FM Modulators ===
        this.fmLow = {
            osc: ctx.createOscillator(),
            gain: ctx.createGain(),
            ratio: 0.66,
            amount: 0
        };
        this.fmLow.osc.type = 'sine';
        this.fmLow.gain.gain.value = 0;
        
        this.fmHigh = {
            osc: ctx.createOscillator(),
            gain: ctx.createGain(),
            ratio: 3.3,
            amount: 0
        };
        this.fmHigh.osc.type = 'sine';
        this.fmHigh.gain.gain.value = 0;
        
        // === Waveshaper + Wavefolder ===
        this.waveShaper = ctx.createWaveShaper();
        this.waveShape = 0.5;
        this.waveFolds = 0;
        
        // === LPG ===
        this.lpg = {
            filter: ctx.createBiquadFilter(),
            vca: ctx.createGain()
        };
        this.lpg.filter.type = 'lowpass';
        this.lpg.filter.frequency.value = 1000;
        this.lpg.filter.Q.value = 0.5;
        this.lpg.vca.gain.value = 0;
        
        // === Envelope ===
        this.envelope = {
            type: 0,
            attack: 0.04,
            peak: 10000,
            decay: 1.0,
            amp: 1.0
        };
        
        // === Glide ===
        this.glide = 0;
        
        // === Drift ===
        this.drift = 0;
        this.driftLFO = ctx.createOscillator();
        this.driftGain = ctx.createGain();
        this.driftLFO.type = 'sine';
        this.driftLFO.frequency.value = 0.2;
        this.driftGain.gain.value = 0;
        
        // === LFO ===
        this.lfo = {
            osc: ctx.createOscillator(),
            shape: 0,
            freq: 0.5,
            toFreq: ctx.createGain(),
            toWaveShape: ctx.createGain(),
            toWaveFolds: ctx.createGain(),
            toFmLow: ctx.createGain(),
            toFmHigh: ctx.createGain(),
            toAttack: ctx.createGain(),
            toPeak: ctx.createGain(),
            toDecay: ctx.createGain(),
            toReverbMix: ctx.createGain()
        };
        this.lfo.osc.type = 'triangle';
        this.lfo.osc.frequency.value = 0.5;
        
        this.lfoAmounts = {
            toFreq: 0,
            toWaveShape: 0,
            toWaveFolds: 0,
            toFmLow: 0,
            toFmHigh: 0,
            toAttack: 0,
            toPeak: 0,
            toDecay: 0,
            toReverbMix: 0
        };
        
        Object.values(this.lfo).forEach(node => {
            if (node && node.gain) {
                node.gain.value = 0;
            }
        });
        
        // === Reverb ===
        this.reverb = {
            delay1: ctx.createDelay(),
            delay2: ctx.createDelay(),
            delay3: ctx.createDelay(),
            delay4: ctx.createDelay(),
            feedback1: ctx.createGain(),
            feedback2: ctx.createGain(),
            feedback3: ctx.createGain(),
            feedback4: ctx.createGain(),
            wet: ctx.createGain(),
            dry: ctx.createGain(),
            mix: 0
        };
        
        this.reverb.delay1.delayTime.value = 0.037;
        this.reverb.delay2.delayTime.value = 0.053;
        this.reverb.delay3.delayTime.value = 0.071;
        this.reverb.delay4.delayTime.value = 0.089;
        this.reverb.feedback1.gain.value = 0.4;
        this.reverb.feedback2.gain.value = 0.37;
        this.reverb.feedback3.gain.value = 0.35;
        this.reverb.feedback4.gain.value = 0.33;
        this.reverb.wet.gain.value = 0;
        this.reverb.dry.gain.value = 1;
        
        // === Audio Routing ===
        this.fmLow.osc.connect(this.fmLow.gain);
        this.fmHigh.osc.connect(this.fmHigh.gain);
        this.fmLow.gain.connect(this.vco.frequency);
        this.fmHigh.gain.connect(this.vco.frequency);
        
        this.vco.connect(this.waveShaper);
        this.waveShaper.connect(this.vcoGain);
        this.vcoGain.connect(this.lpg.filter);
        this.lpg.filter.connect(this.lpg.vca);
        
        this.lpg.vca.connect(this.reverb.dry);
        this.lpg.vca.connect(this.reverb.delay1);
        
        this.reverb.delay1.connect(this.reverb.feedback1);
        this.reverb.feedback1.connect(this.reverb.delay2);
        this.reverb.delay2.connect(this.reverb.feedback2);
        this.reverb.feedback2.connect(this.reverb.delay3);
        this.reverb.delay3.connect(this.reverb.feedback3);
        this.reverb.feedback3.connect(this.reverb.delay4);
        this.reverb.delay4.connect(this.reverb.feedback4);
        
        this.reverb.delay1.connect(this.reverb.wet);
        this.reverb.delay2.connect(this.reverb.wet);
        this.reverb.delay3.connect(this.reverb.wet);
        this.reverb.delay4.connect(this.reverb.wet);
        
        this.reverb.feedback1.connect(this.reverb.delay1);
        this.reverb.feedback2.connect(this.reverb.delay2);
        this.reverb.feedback3.connect(this.reverb.delay3);
        this.reverb.feedback4.connect(this.reverb.delay4);
        
        this.reverb.dry.connect(this.output);
        this.reverb.wet.connect(this.output);
        
        this.driftLFO.connect(this.driftGain);
        this.driftGain.connect(this.vco.frequency);
        
        this.lfo.osc.connect(this.lfo.toFreq);
        this.lfo.osc.connect(this.lfo.toWaveShape);
        this.lfo.osc.connect(this.lfo.toWaveFolds);
        this.lfo.osc.connect(this.lfo.toFmLow);
        this.lfo.osc.connect(this.lfo.toFmHigh);
        this.lfo.osc.connect(this.lfo.toAttack);
        this.lfo.osc.connect(this.lfo.toPeak);
        this.lfo.osc.connect(this.lfo.toDecay);
        this.lfo.osc.connect(this.lfo.toReverbMix);
        
        this.lfo.toFreq.connect(this.vco.frequency);
        
        this.vco.start();
        this.fmLow.osc.start();
        this.fmHigh.osc.start();
        this.driftLFO.start();
        this.lfo.osc.start();
        
        this.updateWaveShape();
        this.isNotePlaying = false;
    }
    
    mapExp(norm, min, max) {
        if (min <= 0) min = 0.001;
        const ratio = max / min;
        return min * Math.pow(ratio, norm);
    }
    
    mapLin(norm, min, max) {
        return min + (max - min) * norm;
    }
    
    updateWaveShape() {
        const resolution = 2048;
        const curve = new Float32Array(resolution);
        const shape = this.waveShape;
        const folds = this.waveFolds;
        
        for (let i = 0; i < resolution; i++) {
            let x = (i / (resolution - 1)) * 2 - 1;
            let y;
            
            if (shape < 0.33) {
                const mix = shape / 0.33;
                const sine = Math.sin(x * Math.PI / 2);
                const tri = x;
                y = sine * (1 - mix) + tri * mix;
            } else if (shape < 0.66) {
                const mix = (shape - 0.33) / 0.33;
                const tri = x;
                const square = Math.sign(x) * 0.8;
                y = tri * (1 - mix) + square * mix;
            } else {
                const mix = (shape - 0.66) / 0.34;
                const square = Math.sign(x) * 0.8;
                const saw = x;
                y = square * (1 - mix) + saw * mix;
            }
            
            if (folds > 0) {
                const preGain = 1 + folds * 1.5;
                y *= preGain;
                
                const k = 1.5;
                y = Math.tanh(y * k);
                
                const wholeFolds = Math.floor(folds);
                const fractionalFold = folds - wholeFolds;
                
                for (let j = 0; j < wholeFolds; j++) {
                    if (y > 1) y = 2 - y;
                    if (y < -1) y = -2 - y;
                    y = Math.abs(y) * 2 - 1;
                }
                
                if (fractionalFold > 0) {
                    const folded = Math.abs(y) * 2 - 1;
                    y = y * (1 - fractionalFold) + folded * fractionalFold;
                }
                
                const postGain = 1 / (1 + folds * 0.3);
                y *= postGain;
            }
            
            y = Math.max(-1, Math.min(1, y));
            curve[i] = y;
        }
        
        this.waveShaper.curve = curve;
    }
    
    updateFMFrequencies(carrierFreq) {
        const now = this.ctx.currentTime;
        
        const fmLowFreq = carrierFreq * this.fmLow.ratio;
        this.fmLow.osc.frequency.setTargetAtTime(fmLowFreq, now, 0.001);
        
        const fmHighFreq = carrierFreq * this.fmHigh.ratio;
        this.fmHigh.osc.frequency.setTargetAtTime(fmHighFreq, now, 0.001);
        
        const fmLowDepth = this.fmLow.amount * carrierFreq * 0.2;
        const fmHighDepth = this.fmHigh.amount * carrierFreq * 0.5;
        
        this.fmLow.gain.gain.setTargetAtTime(fmLowDepth, now, 0.001);
        this.fmHigh.gain.gain.setTargetAtTime(fmHighDepth, now, 0.001);
    }
    
    noteOn(freq, velocity = 1) {
        const now = this.ctx.currentTime;
        this.isNotePlaying = true;
        
        if (this.glide > 0.001) {
            this.vco.frequency.cancelScheduledValues(now);
            this.vco.frequency.setValueAtTime(this.currentFreq, now);
            this.vco.frequency.linearRampToValueAtTime(freq, now + this.glide);
        } else {
            this.vco.frequency.setTargetAtTime(freq, now, 0.001);
        }
        
        this.currentFreq = freq;
        this.updateFMFrequencies(freq);
        
        this.lfo.toFreq.gain.setValueAtTime(this.lfoAmounts.toFreq * freq * 0.1, now);
        
        const attack = Math.max(0.003, this.envelope.attack);
        const decay = Math.max(0.01, this.envelope.decay);
        const peak = Math.max(100, Math.min(10000, this.envelope.peak));
        const amp = Math.min(1.0, this.envelope.amp / 11.0);
        
        const currentVcaGain = this.lpg.vca.gain.value;
        const currentFilterFreq = this.lpg.filter.frequency.value;
        
        if (this.envelope.type === 0) {
            this.lpg.vca.gain.cancelScheduledValues(now);
            this.lpg.vca.gain.setValueAtTime(currentVcaGain, now);
            this.lpg.vca.gain.linearRampToValueAtTime(amp * velocity, now + attack);
            this.lpg.vca.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
            
            this.lpg.filter.frequency.cancelScheduledValues(now);
            this.lpg.filter.frequency.setValueAtTime(Math.max(20, currentFilterFreq), now);
            this.lpg.filter.frequency.exponentialRampToValueAtTime(peak, now + attack);
            this.lpg.filter.frequency.exponentialRampToValueAtTime(100, now + attack + decay);
        } else {
            const sustainLevel = amp * 0.7;
            
            this.lpg.vca.gain.cancelScheduledValues(now);
            this.lpg.vca.gain.setValueAtTime(currentVcaGain, now);
            this.lpg.vca.gain.linearRampToValueAtTime(amp * velocity, now + attack);
            this.lpg.vca.gain.linearRampToValueAtTime(sustainLevel * velocity, now + attack + decay);
            
            this.lpg.filter.frequency.cancelScheduledValues(now);
            this.lpg.filter.frequency.setValueAtTime(Math.max(20, currentFilterFreq), now);
            this.lpg.filter.frequency.exponentialRampToValueAtTime(peak, now + attack);
            this.lpg.filter.frequency.exponentialRampToValueAtTime(
                Math.max(300, peak * 0.3),
                now + attack + decay
            );
        }
    }
    
    noteOff() {
        const now = this.ctx.currentTime;
        this.isNotePlaying = false;
        
        if (this.envelope.type === 1) {
            const release = Math.max(0.01, this.envelope.decay * 0.5);
            
            const currentVcaGain = this.lpg.vca.gain.value;
            const currentFilterFreq = this.lpg.filter.frequency.value;
            
            this.lpg.vca.gain.cancelScheduledValues(now);
            this.lpg.vca.gain.setValueAtTime(currentVcaGain, now);
            this.lpg.vca.gain.exponentialRampToValueAtTime(0.001, now + release);
            
            this.lpg.filter.frequency.cancelScheduledValues(now);
            this.lpg.filter.frequency.setValueAtTime(Math.max(20, currentFilterFreq), now);
            this.lpg.filter.frequency.exponentialRampToValueAtTime(100, now + release);
        }
    }
    
    setParam(param, value) {
        const now = this.ctx.currentTime;
        
        switch(param) {
            case 'glide':
                this.glide = value;
                break;
            case 'waveShape':
                this.waveShape = value;
                this.updateWaveShape();
                break;
            case 'waveFolds':
                this.waveFolds = value;
                this.updateWaveShape();
                break;
            case 'fmLowRatio':
                this.fmLow.ratio = value;
                if (this.isNotePlaying) this.updateFMFrequencies(this.currentFreq);
                break;
            case 'fmHighRatio':
                this.fmHigh.ratio = value;
                if (this.isNotePlaying) this.updateFMFrequencies(this.currentFreq);
                break;
            case 'fmLowAmount':
                this.fmLow.amount = value;
                if (this.isNotePlaying) this.updateFMFrequencies(this.currentFreq);
                break;
            case 'fmHighAmount':
                this.fmHigh.amount = value;
                if (this.isNotePlaying) this.updateFMFrequencies(this.currentFreq);
                break;
            case 'envType':
                this.envelope.type = value;
                break;
            case 'attack':
                this.envelope.attack = value;
                break;
            case 'peak':
                this.envelope.peak = value;
                break;
            case 'decay':
                this.envelope.decay = value;
                break;
            case 'amp':
                this.envelope.amp = value;
                break;
            case 'reverbMix':
                this.reverb.mix = value;
                this.reverb.wet.gain.setTargetAtTime(value * 0.4, now, 0.01);
                this.reverb.dry.gain.setTargetAtTime(1 - value * 0.3, now, 0.01);
                break;
            case 'lfoShape':
                this.lfo.shape = value;
                const shapes = ['triangle', 'sawtooth', 'square', 'square'];
                this.lfo.osc.type = shapes[value] || 'triangle';
                break;
            case 'lfoFreq':
                this.lfo.freq = value;
                this.lfo.osc.frequency.setTargetAtTime(value, now, 0.01);
                break;
            case 'lfo_to_freq_amount':
                this.lfoAmounts.toFreq = value;
                if (this.isNotePlaying) {
                    this.lfo.toFreq.gain.setValueAtTime(value * this.currentFreq * 0.1, now);
                }
                break;
            case 'lfo_to_wave_shape_amount':
                this.lfoAmounts.toWaveShape = value;
                break;
            case 'lfo_to_wave_folds_amount':
                this.lfoAmounts.toWaveFolds = value;
                break;
            case 'lfo_to_fm_low_amount':
                this.lfoAmounts.toFmLow = value;
                this.lfo.toFmLow.gain.setValueAtTime(value * 100, now);
                break;
            case 'lfo_to_fm_high_amount':
                this.lfoAmounts.toFmHigh = value;
                this.lfo.toFmHigh.gain.setValueAtTime(value * 200, now);
                break;
            case 'lfo_to_attack_amount':
                this.lfoAmounts.toAttack = value;
                break;
            case 'lfo_to_peak_amount':
                this.lfoAmounts.toPeak = value;
                break;
            case 'lfo_to_decay_amount':
                this.lfoAmounts.toDecay = value;
                break;
            case 'lfo_to_reverb_mix_amount':
                this.lfoAmounts.toReverbMix = value;
                this.lfo.toReverbMix.gain.setValueAtTime(value * 0.3, now);
                this.lfo.toReverbMix.connect(this.reverb.wet.gain);
                break;
            case 'drift':
                this.drift = value;
                this.driftGain.gain.setTargetAtTime(value * this.currentFreq * 0.0029, now, 0.01);
                break;
        }
    }
    
    randomPatch() {
        if (Math.random() > 0.7) {
            this.setParam('glide', Math.pow(Math.random(), 2) * 5);
        } else {
            this.setParam('glide', 0);
        }
        
        this.setParam('waveShape', Math.random());
        this.setParam('waveFolds', Math.pow(Math.random(), 2) * 3);
        this.setParam('fmLowRatio', this.mapLin(Math.random(), 0.1, 1.0));
        this.setParam('fmHighRatio', this.mapLin(Math.random(), 1.0, 10.0));
        
        if (Math.random() > 0.6) {
            this.setParam('fmLowAmount', Math.pow(Math.random(), 2) * 0.8);
        } else {
            this.setParam('fmLowAmount', 0);
        }
        
        if (Math.random() > 0.6) {
            this.setParam('fmHighAmount', Math.pow(Math.random(), 2) * 0.7);
        } else {
            this.setParam('fmHighAmount', 0);
        }
        
        this.setParam('envType', Math.random() > 0.7 ? 1 : 0);
        this.setParam('attack', this.mapExp(Math.pow(Math.random(), 4), 0.003, 8.0));
        this.setParam('peak', this.mapExp(Math.random(), 100, 10000));
        this.setParam('decay', this.mapExp(Math.pow(Math.random(), 1.5), 0.01, 8.0));
        this.setParam('amp', Math.pow(Math.random(), 0.5) * 11);
        
        if (Math.random() > 0.65) {
            this.setParam('reverbMix', Math.pow(Math.random(), 2) * 0.6);
        } else {
            this.setParam('reverbMix', 0);
        }
        
        this.setParam('lfoShape', Math.floor(Math.random() * 4));
        this.setParam('lfoFreq', this.mapExp(Math.pow(Math.random(), 2), 0.001, 10.0));
        
        const lfoParams = [
            'lfo_to_freq_amount', 'lfo_to_wave_shape_amount', 'lfo_to_wave_folds_amount',
            'lfo_to_fm_low_amount', 'lfo_to_fm_high_amount', 'lfo_to_attack_amount',
            'lfo_to_peak_amount', 'lfo_to_decay_amount', 'lfo_to_reverb_mix_amount'
        ];
        
        lfoParams.forEach(param => {
            if (Math.random() > 0.75) {
                this.setParam(param, Math.pow(Math.random(), 2) * 0.7);
            } else {
                this.setParam(param, 0);
            }
        });
        
        this.setParam('drift', Math.pow(Math.random(), 3) * 0.6);
    }
    
    dispose() {
        try {
            this.vco.stop();
            this.fmLow.osc.stop();
            this.fmHigh.osc.stop();
            this.driftLFO.stop();
            this.lfo.osc.stop();
        } catch(e) {}
    }
}

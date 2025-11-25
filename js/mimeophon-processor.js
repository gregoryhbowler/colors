// Mimeophon-Inspired Stereo Delay Processor
// Custom AudioWorklet implementation with rich modulation and spatial character

class MimeophonProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            // Zone & Rate
            { name: 'zone', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'rate', defaultValue: 0.5, minValue: 0, maxValue: 1 },
            
            // Modulation
            { name: 'microRate', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'microRateFreq', defaultValue: 2, minValue: 0.1, maxValue: 8 },
            { name: 'skew', defaultValue: 0, minValue: -1, maxValue: 1 },
            
            // Feedback
            { name: 'repeats', defaultValue: 0.3, minValue: 0, maxValue: 1.2 },
            { name: 'color', defaultValue: 0.5, minValue: 0, maxValue: 1 },
            { name: 'halo', defaultValue: 0, minValue: 0, maxValue: 1 },
            
            // Mix
            { name: 'mix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
            
            // Special controls (0 or 1)
            { name: 'hold', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'flip', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'pingPong', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'swap', defaultValue: 0, minValue: 0, maxValue: 1 }
        ];
    }
    
    constructor(options) {
        super();
        
        this.sampleRate = options.processorOptions?.sampleRate || 48000;
        
        // Circular buffer (10 seconds max)
        const maxDelaySamples = Math.ceil(this.sampleRate * 10);
        this.bufferL = new Float32Array(maxDelaySamples);
        this.bufferR = new Float32Array(maxDelaySamples);
        this.writeIndex = 0;
        this.bufferSize = maxDelaySamples;
        
        // Zone definitions (in seconds)
        this.zones = [
            { min: 0.005, max: 0.050 },   // Zone A: 5-50ms
            { min: 0.050, max: 0.400 },   // Zone B: 50-400ms
            { min: 0.400, max: 2.000 },   // Zone C: 400-2000ms
            { min: 2.000, max: 10.000 }   // Zone D: 2-10s
        ];
        
        // Delay state
        this.delayTimeL = 0.1;
        this.delayTimeR = 0.1;
        this.targetDelayTimeL = 0.1;
        this.targetDelayTimeR = 0.1;
        
        // LFO for μRate
        this.lfoPhase = 0;
        
        // Color filter state (cascaded biquads)
        this.filterStateL = this.createFilterState();
        this.filterStateR = this.createFilterState();
        
        // Halo diffusion state (4 allpass filters)
        this.haloStateL = this.createHaloState();
        this.haloStateR = this.createHaloState();
        
        // Feedback memory
        this.feedbackL = 0;
        this.feedbackR = 0;
        
        // Hold state
        this.holdActive = false;
        this.holdBufferL = new Float32Array(maxDelaySamples);
        this.holdBufferR = new Float32Array(maxDelaySamples);
        
        // Flip state
        this.flipActive = false;
        
        // Crossfade for tempo sync / zone changes
        this.crossfadeActive = false;
        this.crossfadeProgress = 0;
        this.crossfadeDuration = 0.02; // 20ms crossfade
        
        // Previous parameter values for change detection
        this.prevZone = 1;
        this.prevRate = 0.5;
        
        // Ping-pong state
        this.pingPongPhase = 0; // 0 = left, 1 = right
    }
    
    createFilterState() {
        return {
            // Two biquad filters for more complex shaping
            b1: { x1: 0, x2: 0, y1: 0, y2: 0 },
            b2: { x1: 0, x2: 0, y1: 0, y2: 0 },
            // Filter coefficients
            coefs1: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
            coefs2: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        };
    }
    
    createHaloState() {
        // 4 allpass filters with different delay times
        return {
            buffers: [
                new Float32Array(512),  // ~10ms at 48kHz
                new Float32Array(768),  // ~16ms
                new Float32Array(1024), // ~21ms
                new Float32Array(384)   // ~8ms
            ],
            indices: [0, 0, 0, 0],
            g: [0.5, 0.45, 0.4, 0.35] // Feedback coefficients
        };
    }
    
    // Get delay time based on zone and rate
    getDelayTime(zone, rate) {
        const z = Math.floor(zone);
        const zoneData = this.zones[Math.min(z, 3)];
        const t = zoneData.min + rate * (zoneData.max - zoneData.min);
        return t;
    }
    
    // Linear interpolation read from circular buffer
    readBuffer(buffer, delaySamples) {
        const size = this.bufferSize;
        const readPos = (this.writeIndex - delaySamples + size) % size;
        const readIndex = Math.floor(readPos);
        const frac = readPos - readIndex;
        
        const idx1 = readIndex % size;
        const idx2 = (readIndex + 1) % size;
        
        return buffer[idx1] * (1 - frac) + buffer[idx2] * frac;
    }
    
    // Reverse read from buffer
    readBufferReverse(buffer, delaySamples) {
        const size = this.bufferSize;
        const readPos = (this.writeIndex + delaySamples) % size;
        const readIndex = Math.floor(readPos);
        const frac = readPos - readIndex;
        
        const idx1 = readIndex % size;
        const idx2 = (readIndex + 1) % size;
        
        return buffer[idx1] * (1 - frac) + buffer[idx2] * frac;
    }
    
    // Soft saturation
    softSaturate(x) {
        // Soft tanh-like saturation
        if (x > 1) return 1 - Math.exp(-(x - 1));
        if (x < -1) return -1 + Math.exp(x + 1);
        return x;
    }
    
    // Asymmetric saturation (tape-like)
    asymmetricSaturate(x, bias = 0.3) {
        const shifted = x + bias;
        return Math.tanh(shifted * 1.5) - Math.tanh(bias * 1.5);
    }
    
    // Update color filter coefficients based on color parameter
    updateColorFilter(color, filterState) {
        // Color morphs through: dark → BBD → tape → bright → crisp
        
        if (color < 0.2) {
            // Dark: strong lowpass
            const freq = 4000 + color * 5 * 7000;
            this.setLowpass(filterState.coefs1, freq, 0.707);
            this.setLowpass(filterState.coefs2, freq * 0.5, 0.707);
        } else if (color < 0.4) {
            // BBD: band-limiting + mild resonance
            const t = (color - 0.2) / 0.2;
            const freq = 4000 + t * 6000;
            this.setLowpass(filterState.coefs1, freq, 1.5);
            this.setBandpass(filterState.coefs2, 2000, 2);
        } else if (color < 0.6) {
            // Tape: high-shelf loss
            const t = (color - 0.4) / 0.2;
            const freq = 8000 - t * 2000;
            this.setHighShelf(filterState.coefs1, freq, -3, 0.707);
            this.setLowpass(filterState.coefs2, 12000, 0.707);
        } else if (color < 0.8) {
            // Bright: wideband, subtle high boost
            const t = (color - 0.6) / 0.2;
            this.setHighShelf(filterState.coefs1, 8000, t * 2, 0.707);
            this.setAllpass(filterState.coefs2, 0);
        } else {
            // Crisp/Digital: high boost + presence
            const t = (color - 0.8) / 0.2;
            this.setHighShelf(filterState.coefs1, 6000, 3 + t * 2, 0.707);
            this.setPeaking(filterState.coefs2, 3000, 2, 1.5);
        }
    }
    
    // Biquad filter coefficient calculators
    setLowpass(coefs, freq, Q) {
        const w0 = 2 * Math.PI * freq / this.sampleRate;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        const alpha = sinw0 / (2 * Q);
        
        const b0 = (1 - cosw0) / 2;
        const b1 = 1 - cosw0;
        const b2 = (1 - cosw0) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cosw0;
        const a2 = 1 - alpha;
        
        coefs.b0 = b0 / a0;
        coefs.b1 = b1 / a0;
        coefs.b2 = b2 / a0;
        coefs.a1 = a1 / a0;
        coefs.a2 = a2 / a0;
    }
    
    setHighShelf(coefs, freq, gainDB, Q) {
        const A = Math.pow(10, gainDB / 40);
        const w0 = 2 * Math.PI * freq / this.sampleRate;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        const alpha = sinw0 / (2 * Q);
        
        const b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
        const b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
        const b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
        const a0 = (A + 1) - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
        const a1 = 2 * ((A - 1) - (A + 1) * cosw0);
        const a2 = (A + 1) - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
        
        coefs.b0 = b0 / a0;
        coefs.b1 = b1 / a0;
        coefs.b2 = b2 / a0;
        coefs.a1 = a1 / a0;
        coefs.a2 = a2 / a0;
    }
    
    setBandpass(coefs, freq, Q) {
        const w0 = 2 * Math.PI * freq / this.sampleRate;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        const alpha = sinw0 / (2 * Q);
        
        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * cosw0;
        const a2 = 1 - alpha;
        
        coefs.b0 = b0 / a0;
        coefs.b1 = b1 / a0;
        coefs.b2 = b2 / a0;
        coefs.a1 = a1 / a0;
        coefs.a2 = a2 / a0;
    }
    
    setPeaking(coefs, freq, gainDB, Q) {
        const A = Math.pow(10, gainDB / 40);
        const w0 = 2 * Math.PI * freq / this.sampleRate;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        const alpha = sinw0 / (2 * Q);
        
        const b0 = 1 + alpha * A;
        const b1 = -2 * cosw0;
        const b2 = 1 - alpha * A;
        const a0 = 1 + alpha / A;
        const a1 = -2 * cosw0;
        const a2 = 1 - alpha / A;
        
        coefs.b0 = b0 / a0;
        coefs.b1 = b1 / a0;
        coefs.b2 = b2 / a0;
        coefs.a1 = a1 / a0;
        coefs.a2 = a2 / a0;
    }
    
    setAllpass(coefs, freq) {
        if (freq === 0) {
            coefs.b0 = 1;
            coefs.b1 = 0;
            coefs.b2 = 0;
            coefs.a1 = 0;
            coefs.a2 = 0;
        } else {
            const w0 = 2 * Math.PI * freq / this.sampleRate;
            const cosw0 = Math.cos(w0);
            const sinw0 = Math.sin(w0);
            const alpha = sinw0 / 2;
            
            const b0 = 1 - alpha;
            const b1 = -2 * cosw0;
            const b2 = 1 + alpha;
            const a0 = 1 + alpha;
            const a1 = -2 * cosw0;
            const a2 = 1 - alpha;
            
            coefs.b0 = b0 / a0;
            coefs.b1 = b1 / a0;
            coefs.b2 = b2 / a0;
            coefs.a1 = a1 / a0;
            coefs.a2 = a2 / a0;
        }
    }
    
    // Process biquad filter
    processBiquad(input, state, coefs) {
        const output = coefs.b0 * input + 
                      coefs.b1 * state.x1 + 
                      coefs.b2 * state.x2 - 
                      coefs.a1 * state.y1 - 
                      coefs.a2 * state.y2;
        
        state.x2 = state.x1;
        state.x1 = input;
        state.y2 = state.y1;
        state.y1 = output;
        
        return output;
    }
    
    // Process halo diffusion (allpass cascade)
    processHalo(input, haloState, amount) {
        if (amount < 0.001) return input;
        
        let signal = input;
        
        for (let i = 0; i < 4; i++) {
            const buffer = haloState.buffers[i];
            const index = haloState.indices[i];
            const g = haloState.g[i] * amount;
            
            const delayed = buffer[index];
            const output = -g * signal + delayed;
            buffer[index] = signal + g * output;
            
            haloState.indices[i] = (index + 1) % buffer.length;
            signal = output;
        }
        
        return signal * 0.7 + input * 0.3; // Blend with dry
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !output || !input[0]) {
            return true;
        }
        
        const inputL = input[0];
        const inputR = input[1] || input[0];
        const outputL = output[0];
        const outputR = output[1] || output[0];
        
        const blockSize = outputL.length;
        
        // Get parameters (handle both constant and a-rate)
        const getParam = (param, index) => {
            return param.length > 1 ? param[index] : param[0];
        };
        
        for (let i = 0; i < blockSize; i++) {
            // Read parameters
            const zone = getParam(parameters.zone, i);
            const rate = getParam(parameters.rate, i);
            const microRate = getParam(parameters.microRate, i);
            const microRateFreq = getParam(parameters.microRateFreq, i);
            const skew = getParam(parameters.skew, i);
            const repeats = getParam(parameters.repeats, i);
            const color = getParam(parameters.color, i);
            const halo = getParam(parameters.halo, i);
            const mix = getParam(parameters.mix, i);
            const hold = getParam(parameters.hold, i);
            const flip = getParam(parameters.flip, i);
            const pingPong = getParam(parameters.pingPong, i);
            const swap = getParam(parameters.swap, i);
            
            // Update hold state
            const holdNow = hold > 0.5;
            if (holdNow && !this.holdActive) {
                // Entering hold - copy current buffer
                this.holdBufferL.set(this.bufferL);
                this.holdBufferR.set(this.bufferR);
                this.holdActive = true;
            } else if (!holdNow && this.holdActive) {
                this.holdActive = false;
            }
            
            // Update flip state
            this.flipActive = flip > 0.5;
            
            // Calculate base delay times
            const baseDelayTime = this.getDelayTime(zone, rate);
            
            // Apply μRate modulation (LFO)
            this.lfoPhase += 2 * Math.PI * microRateFreq / this.sampleRate;
            if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
            const lfoValue = Math.sin(this.lfoPhase);
            const microRateOffset = lfoValue * microRate * 0.015; // 0-15ms
            
            // Apply skew
            const skewAmount = skew * baseDelayTime * 0.5;
            this.targetDelayTimeL = baseDelayTime - skewAmount + microRateOffset;
            this.targetDelayTimeR = baseDelayTime + skewAmount + microRateOffset;
            
            // Apply swap
            if (swap > 0.5) {
                [this.targetDelayTimeL, this.targetDelayTimeR] = 
                    [this.targetDelayTimeR, this.targetDelayTimeL];
            }
            
            // Smooth delay time changes
            const smoothingCoef = 0.999;
            this.delayTimeL = this.delayTimeL * smoothingCoef + 
                             this.targetDelayTimeL * (1 - smoothingCoef);
            this.delayTimeR = this.delayTimeR * smoothingCoef + 
                             this.targetDelayTimeR * (1 - smoothingCoef);
            
            const delayL = Math.max(0.001, this.delayTimeL) * this.sampleRate;
            const delayR = Math.max(0.001, this.delayTimeR) * this.sampleRate;
            
            // Read from delay buffer
            let delayedL, delayedR;
            
            if (this.holdActive) {
                // Read from frozen hold buffer
                if (this.flipActive) {
                    delayedL = this.readBufferReverse(this.holdBufferL, delayL);
                    delayedR = this.readBufferReverse(this.holdBufferR, delayR);
                } else {
                    delayedL = this.readBuffer(this.holdBufferL, delayL);
                    delayedR = this.readBuffer(this.holdBufferR, delayR);
                }
            } else {
                if (this.flipActive) {
                    delayedL = this.readBufferReverse(this.bufferL, delayL);
                    delayedR = this.readBufferReverse(this.bufferR, delayR);
                } else {
                    delayedL = this.readBuffer(this.bufferL, delayL);
                    delayedR = this.readBuffer(this.bufferR, delayR);
                }
            }
            
            // Apply ping-pong crossfeed
            if (pingPong > 0.5) {
                // Alternate which channel gets the feedback
                const temp = delayedL;
                delayedL = this.feedbackR;
                delayedR = this.feedbackL;
            }
            
            // Update color filters
            this.updateColorFilter(color, this.filterStateL);
            this.updateColorFilter(color, this.filterStateR);
            
            // Process color filtering on delayed signal
            let coloredL = this.processBiquad(delayedL, this.filterStateL.b1, 
                                             this.filterStateL.coefs1);
            coloredL = this.processBiquad(coloredL, this.filterStateL.b2, 
                                         this.filterStateL.coefs2);
            
            let coloredR = this.processBiquad(delayedR, this.filterStateR.b1, 
                                             this.filterStateR.coefs1);
            coloredR = this.processBiquad(coloredR, this.filterStateR.b2, 
                                         this.filterStateR.coefs2);
            
            // Apply halo diffusion
            const haloedL = this.processHalo(coloredL, this.haloStateL, halo);
            const haloedR = this.processHalo(coloredR, this.haloStateR, halo);
            
            // Apply saturation based on color (more saturation in tape/BBD zones)
            let saturatedL, saturatedR;
            if (color < 0.6) {
                // Tape-like asymmetric saturation
                saturatedL = this.asymmetricSaturate(haloedL * 1.5, 0.2);
                saturatedR = this.asymmetricSaturate(haloedR * 1.5, 0.2);
            } else {
                // Softer symmetric saturation
                saturatedL = this.softSaturate(haloedL * 1.2);
                saturatedR = this.softSaturate(haloedR * 1.2);
            }
            
            // Calculate feedback
            const feedbackAmount = Math.min(1.1, repeats);
            this.feedbackL = saturatedL * feedbackAmount;
            this.feedbackR = saturatedR * feedbackAmount;
            
            // Write to buffer (unless hold is active)
            if (!this.holdActive) {
                this.bufferL[this.writeIndex] = inputL[i] + this.feedbackL * 0.9;
                this.bufferR[this.writeIndex] = inputR[i] + this.feedbackR * 0.9;
                this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
            }
            
            // Mix dry and wet
            outputL[i] = inputL[i] * (1 - mix) + saturatedL * mix;
            outputR[i] = inputR[i] * (1 - mix) + saturatedR * mix;
        }
        
        return true;
    }
}

registerProcessor('mimeophon-processor', MimeophonProcessor);

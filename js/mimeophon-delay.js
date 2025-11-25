// Mimeophon-style Stereo Delay
// Inspired by Make Noise Mimeophon with zones, micro-rate, and halo
// Uses AudioWorklet for proper DSP processing

export class MimeophonDelay {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Input/Output gain nodes
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.gain.value = 1.0;
        
        // The worklet node will be set up asynchronously
        this.workletNode = null;
        this.isReady = false;
        this.params = {};
        
        // Current parameter state (for UI updates and fallback)
        this.currentZone = 0;
        this.rate = 0.5;
        this.microRate = 0;
        this.microRateFreq = 2;
        this.skew = 0;
        this.repeats = 0.3;
        this.color = 0.5;
        this.halo = 0;
        this.hold = false;
        this.flip = false;
        this.pingPong = false;
        this.swap = false;
        
        // Zone presets (for display/reference)
        this.zones = [
            { name: 'A', range: '5-50ms', minTime: 0.005, maxTime: 0.050 },
            { name: 'B', range: '50-400ms', minTime: 0.050, maxTime: 0.400 },
            { name: 'C', range: '0.4-2s', minTime: 0.400, maxTime: 2.000 },
            { name: 'D', range: '2-10s', minTime: 2.000, maxTime: 10.000 }
        ];
        
        // Initialize worklet
        this.initPromise = this.initWorklet();
    }
    
    /**
     * Initialize the AudioWorklet processor
     */
    async initWorklet() {
        try {
            // Load the processor worklet
            await this.ctx.audioWorklet.addModule('./js/mimeophon-processor.js');
            
            // Create the worklet node
            this.workletNode = new AudioWorkletNode(this.ctx, 'mimeophon-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2],
                processorOptions: {
                    sampleRate: this.ctx.sampleRate
                }
            });
            
            // Connect: input -> worklet -> output
            this.input.connect(this.workletNode);
            this.workletNode.connect(this.output);
            
            // Store references to all parameters
            this.params = {
                zone: this.workletNode.parameters.get('zone'),
                rate: this.workletNode.parameters.get('rate'),
                microRate: this.workletNode.parameters.get('microRate'),
                microRateFreq: this.workletNode.parameters.get('microRateFreq'),
                skew: this.workletNode.parameters.get('skew'),
                repeats: this.workletNode.parameters.get('repeats'),
                color: this.workletNode.parameters.get('color'),
                halo: this.workletNode.parameters.get('halo'),
                mix: this.workletNode.parameters.get('mix'),
                hold: this.workletNode.parameters.get('hold'),
                flip: this.workletNode.parameters.get('flip'),
                pingPong: this.workletNode.parameters.get('pingPong'),
                swap: this.workletNode.parameters.get('swap')
            };
            
            // Set default for send effect (100% wet)
            this.params.mix.setValueAtTime(1.0, this.ctx.currentTime);
            
            this.isReady = true;
            console.log('[MimeophonDelay] AudioWorklet initialized successfully');
            
        } catch (error) {
            console.error('[MimeophonDelay] Failed to initialize worklet:', error);
            // Fall back to simple delay (not implemented here for brevity)
            throw error;
        }
    }
    
    /**
     * Ensure the worklet is ready before operations
     */
    async ensureReady() {
        if (!this.isReady) {
            await this.initPromise;
        }
    }
    
    /**
     * Set a parameter value with optional smoothing
     */
    setParamValue(paramName, value, smooth = true) {
        if (!this.isReady || !this.params[paramName]) {
            console.warn(`[MimeophonDelay] Parameter ${paramName} not ready`);
            return;
        }
        
        const param = this.params[paramName];
        const now = this.ctx.currentTime;
        
        if (smooth) {
            param.setTargetAtTime(value, now, 0.02);
        } else {
            param.setValueAtTime(value, now);
        }
    }
    
    // Zone selection (0-3: A, B, C, D)
    setZone(zoneIndex) {
        this.currentZone = Math.max(0, Math.min(3, zoneIndex));
        this.setParamValue('zone', this.currentZone, false);
    }
    
    // Rate within zone (0-1)
    setRate(value) {
        this.rate = Math.max(0, Math.min(1, value));
        this.setParamValue('rate', this.rate);
    }
    
    // MicroRate modulation amount (0-1)
    setMicroRate(value) {
        // Note: UI sends -1 to 1, but we want 0-1 for the worklet
        this.microRate = Math.max(0, Math.min(1, Math.abs(value)));
        this.setParamValue('microRate', this.microRate);
    }
    
    // MicroRate LFO frequency (0.1-8 Hz)
    setMicroRateFreq(value) {
        this.microRateFreq = Math.max(0.1, Math.min(8, value));
        this.setParamValue('microRateFreq', this.microRateFreq);
    }
    
    // Skew (-1 to +1) - stereo time offset
    setSkew(value) {
        this.skew = Math.max(-1, Math.min(1, value));
        this.setParamValue('skew', this.skew);
    }
    
    // Repeats/feedback (0-1.2)
    setRepeats(value) {
        this.repeats = Math.max(0, Math.min(1.2, value));
        this.setParamValue('repeats', this.repeats);
    }
    
    // Color/filter character (0-1)
    setColor(value) {
        this.color = Math.max(0, Math.min(1, value));
        this.setParamValue('color', this.color);
    }
    
    // Halo/diffusion (0-1)
    setHalo(value) {
        this.halo = Math.max(0, Math.min(1, value));
        this.setParamValue('halo', this.halo);
    }
    
    // Hold/freeze
    setHold(enabled) {
        this.hold = enabled;
        this.setParamValue('hold', enabled ? 1 : 0, false);
    }
    
    // Flip/reverse
    setFlip(enabled) {
        this.flip = enabled;
        this.setParamValue('flip', enabled ? 1 : 0, false);
    }
    
    // Ping-pong mode
    setPingPong(enabled) {
        this.pingPong = enabled;
        this.setParamValue('pingPong', enabled ? 1 : 0, false);
    }
    
    // Swap L/R times
    setSwap(enabled) {
        this.swap = enabled;
        this.setParamValue('swap', enabled ? 1 : 0, false);
    }
    
    // Wet/dry mix (for send effects, typically 1.0)
    setMix(value) {
        this.setParamValue('mix', Math.max(0, Math.min(1, value)));
    }
    
    // Get color name for UI display
    getColorName() {
        if (this.color < 0.2) return 'dark';
        if (this.color < 0.4) return 'BBD';
        if (this.color < 0.6) return 'tape';
        if (this.color < 0.8) return 'bright';
        return 'crisp';
    }
    
    // Get current delay time for display
    getCurrentDelayTime() {
        const zone = this.zones[this.currentZone];
        return zone.minTime + this.rate * (zone.maxTime - zone.minTime);
    }
    
    // Get delay time formatted
    getDelayTimeDisplay() {
        const time = this.getCurrentDelayTime();
        if (time < 0.1) {
            return `${Math.round(time * 1000)}ms`;
        } else if (time < 1) {
            return `${(time * 1000).toFixed(0)}ms`;
        } else {
            return `${time.toFixed(2)}s`;
        }
    }
    
    // Get all current parameter values
    getParams() {
        return {
            zone: this.currentZone,
            rate: this.rate,
            microRate: this.microRate,
            microRateFreq: this.microRateFreq,
            skew: this.skew,
            repeats: this.repeats,
            color: this.color,
            halo: this.halo,
            hold: this.hold,
            flip: this.flip,
            pingPong: this.pingPong,
            swap: this.swap
        };
    }
    
    // Load a preset
    loadPreset(preset) {
        if (preset.zone !== undefined) this.setZone(preset.zone);
        if (preset.rate !== undefined) this.setRate(preset.rate);
        if (preset.microRate !== undefined) this.setMicroRate(preset.microRate);
        if (preset.microRateFreq !== undefined) this.setMicroRateFreq(preset.microRateFreq);
        if (preset.skew !== undefined) this.setSkew(preset.skew);
        if (preset.repeats !== undefined) this.setRepeats(preset.repeats);
        if (preset.color !== undefined) this.setColor(preset.color);
        if (preset.halo !== undefined) this.setHalo(preset.halo);
        if (preset.hold !== undefined) this.setHold(preset.hold);
        if (preset.flip !== undefined) this.setFlip(preset.flip);
        if (preset.pingPong !== undefined) this.setPingPong(preset.pingPong);
        if (preset.swap !== undefined) this.setSwap(preset.swap);
    }
    
    // Connections
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    // Get static presets
    static getPresets() {
        return {
            // Short delays
            karplus: {
                zone: 0,
                rate: 0.8,
                microRate: 0,
                skew: 0,
                repeats: 0.85,
                color: 0.3,
                halo: 0
            },
            
            flange: {
                zone: 0,
                rate: 0.3,
                microRate: 0.8,
                microRateFreq: 0.3,
                skew: 0.5,
                repeats: 0.7,
                color: 0.5,
                halo: 0.3
            },
            
            chorus: {
                zone: 1,
                rate: 0.2,
                microRate: 0.6,
                microRateFreq: 1.5,
                skew: 0.3,
                repeats: 0.3,
                color: 0.6,
                halo: 0.5
            },
            
            // Medium delays
            slapback: {
                zone: 1,
                rate: 0.4,
                microRate: 0,
                skew: 0,
                repeats: 0.3,
                color: 0.4,
                halo: 0.2
            },
            
            dubEcho: {
                zone: 2,
                rate: 0.5,
                microRate: 0.1,
                skew: 0.2,
                repeats: 0.6,
                color: 0.3,
                halo: 0.6
            },
            
            tapeDelay: {
                zone: 2,
                rate: 0.6,
                microRate: 0.2,
                microRateFreq: 0.5,
                skew: 0,
                repeats: 0.5,
                color: 0.45,
                halo: 0.4
            },
            
            // Long delays
            ambient: {
                zone: 3,
                rate: 0.5,
                microRate: 0.3,
                microRateFreq: 0.2,
                skew: 0.4,
                repeats: 0.8,
                color: 0.7,
                halo: 0.8
            },
            
            shimmer: {
                zone: 3,
                rate: 0.7,
                microRate: 0.4,
                microRateFreq: 2,
                skew: 0.6,
                repeats: 0.9,
                color: 0.85,
                halo: 1.0
            }
        };
    }
}

// Mimeophon-style Stereo Delay
// Inspired by Make Noise Mimeophon with zones, micro-rate, and halo

export class MimeophonDelay {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Input/Output
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.gain.value = 1.0;
        
        // Wet/Dry - FIXED: Set to 100% wet for send/return usage
        this.wet = ctx.createGain();
        this.dry = ctx.createGain();
        this.wet.gain.value = 1.0;  // Output only wet signal
        this.dry.gain.value = 0;     // No dry signal (handled by main mix)
        
        // Stereo delay lines
        this.delayL = ctx.createDelay(5);
        this.delayR = ctx.createDelay(5);
        this.delayL.delayTime.value = 0.3;
        this.delayR.delayTime.value = 0.31;
        
        // Feedback paths
        this.feedbackL = ctx.createGain();
        this.feedbackR = ctx.createGain();
        this.feedbackL.gain.value = 0.3;
        this.feedbackR.gain.value = 0.3;
        
        // Cross-feedback for ping-pong
        this.crossL = ctx.createGain();
        this.crossR = ctx.createGain();
        this.crossL.gain.value = 0;
        this.crossR.gain.value = 0;
        
        // Color (tone) filters
        this.colorFilterL = ctx.createBiquadFilter();
        this.colorFilterR = ctx.createBiquadFilter();
        this.colorFilterL.type = 'lowpass';
        this.colorFilterR.type = 'lowpass';
        this.colorFilterL.frequency.value = 4000;
        this.colorFilterR.frequency.value = 4000;
        this.colorFilterL.Q.value = 0.5;
        this.colorFilterR.Q.value = 0.5;
        
        // Halo (reverb-like diffusion)
        this.haloL = this.createHaloNetwork('L');
        this.haloR = this.createHaloNetwork('R');
        this.haloMix = ctx.createGain();
        this.haloMix.gain.value = 0;
        
        // Stereo splitter/merger
        this.splitter = ctx.createChannelSplitter(2);
        this.merger = ctx.createChannelMerger(2);
        
        // Mono to stereo converter for input
        this.monoToStereo = ctx.createGain();
        
        // Zone presets (delay time multipliers)
        this.zones = [
            { name: 'A', baseTime: 0.1, spread: 0.02 },
            { name: 'B', baseTime: 0.25, spread: 0.03 },
            { name: 'C', baseTime: 0.5, spread: 0.05 },
            { name: 'D', baseTime: 1.0, spread: 0.08 }
        ];
        this.currentZone = 0;
        
        // Parameters
        this.rate = 0.5; // 0-1 within zone
        this.microRate = 0; // Fine adjustment
        this.repeats = 0.3;
        this.color = 0.5; // 0=dark, 0.5=neutral, 1=bright
        this.halo = 0;
        this.hold = false;
        this.flip = false;
        this.pingPong = false;
        
        // Build audio graph
        this.buildGraph();
        
        // Update initial state
        this.updateDelayTime();
        this.updateColor();
    }
    
    createHaloNetwork(side) {
        // Simple allpass diffusion network
        const ctx = this.ctx;
        
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // Series of short delays with feedback
        const delays = [];
        const times = [0.013, 0.017, 0.023, 0.029];
        
        let lastNode = input;
        
        for (let i = 0; i < times.length; i++) {
            const delay = ctx.createDelay();
            delay.delayTime.value = times[i] + (side === 'R' ? 0.002 : 0);
            
            const feedback = ctx.createGain();
            feedback.gain.value = 0.5;
            
            lastNode.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(output);
            
            lastNode = delay;
            delays.push({ delay, feedback });
        }
        
        return { input, output, delays };
    }
    
    buildGraph() {
        // Input -> dry path
        this.input.connect(this.dry);
        this.dry.connect(this.output);
        
        // Input -> delay lines
        this.input.connect(this.delayL);
        this.input.connect(this.delayR);
        
        // Delay -> color filters
        this.delayL.connect(this.colorFilterL);
        this.delayR.connect(this.colorFilterR);
        
        // Color -> feedback
        this.colorFilterL.connect(this.feedbackL);
        this.colorFilterR.connect(this.feedbackR);
        
        // Feedback -> back to delay (with cross-feedback)
        this.feedbackL.connect(this.delayL);
        this.feedbackR.connect(this.delayR);
        
        // Cross-feedback for ping-pong
        this.feedbackL.connect(this.crossL);
        this.feedbackR.connect(this.crossR);
        this.crossL.connect(this.delayR);
        this.crossR.connect(this.delayL);
        
        // Halo paths
        this.colorFilterL.connect(this.haloL.input);
        this.colorFilterR.connect(this.haloR.input);
        this.haloL.output.connect(this.haloMix);
        this.haloR.output.connect(this.haloMix);
        
        // Wet output
        this.colorFilterL.connect(this.wet);
        this.colorFilterR.connect(this.wet);
        this.haloMix.connect(this.wet);
        
        this.wet.connect(this.output);
    }
    
    updateDelayTime() {
        const zone = this.zones[this.currentZone];
        const baseTime = zone.baseTime * (0.2 + this.rate * 1.6);
        const microOffset = this.microRate * 0.05 * baseTime;
        
        const timeL = baseTime + microOffset;
        const timeR = baseTime + zone.spread + microOffset;
        
        const now = this.ctx.currentTime;
        this.delayL.delayTime.setTargetAtTime(Math.max(0.001, timeL), now, 0.05);
        this.delayR.delayTime.setTargetAtTime(Math.max(0.001, timeR), now, 0.05);
    }
    
    updateColor() {
        // 0 = dark (200Hz), 0.5 = neutral (4kHz), 1 = bright (12kHz)
        let freq;
        if (this.color < 0.5) {
            // Dark to neutral
            freq = 200 + (this.color * 2) * 3800;
        } else {
            // Neutral to bright
            freq = 4000 + ((this.color - 0.5) * 2) * 8000;
        }
        
        const now = this.ctx.currentTime;
        this.colorFilterL.frequency.setTargetAtTime(freq, now, 0.02);
        this.colorFilterR.frequency.setTargetAtTime(freq, now, 0.02);
    }
    
    updatePingPong() {
        const crossAmount = this.pingPong ? 0.7 : 0;
        const directAmount = this.pingPong ? 0.3 : 1;
        
        const now = this.ctx.currentTime;
        this.crossL.gain.setTargetAtTime(crossAmount, now, 0.02);
        this.crossR.gain.setTargetAtTime(crossAmount, now, 0.02);
        this.feedbackL.gain.setTargetAtTime(this.repeats * directAmount, now, 0.02);
        this.feedbackR.gain.setTargetAtTime(this.repeats * directAmount, now, 0.02);
    }
    
    // Parameter setters
    setZone(zoneIndex) {
        this.currentZone = Math.max(0, Math.min(3, zoneIndex));
        this.updateDelayTime();
    }
    
    setRate(value) {
        this.rate = Math.max(0, Math.min(1, value));
        this.updateDelayTime();
    }
    
    setMicroRate(value) {
        this.microRate = Math.max(-1, Math.min(1, value));
        this.updateDelayTime();
    }
    
    setRepeats(value) {
        this.repeats = Math.max(0, Math.min(1.2, value));
        this.updatePingPong();
    }
    
    setColor(value) {
        this.color = Math.max(0, Math.min(1, value));
        this.updateColor();
    }
    
    setHalo(value) {
        this.halo = Math.max(0, Math.min(1, value));
        const now = this.ctx.currentTime;
        this.haloMix.gain.setTargetAtTime(value * 0.4, now, 0.02);
    }
    
    setHold(enabled) {
        this.hold = enabled;
        const holdFeedback = enabled ? 1.0 : this.repeats;
        const now = this.ctx.currentTime;
        
        if (enabled) {
            this.feedbackL.gain.setTargetAtTime(0.98, now, 0.02);
            this.feedbackR.gain.setTargetAtTime(0.98, now, 0.02);
        } else {
            this.updatePingPong();
        }
    }
    
    setFlip(enabled) {
        this.flip = enabled;
        // Flip reverses the delay time relationship
        if (enabled) {
            const tempRate = 1 - this.rate;
            this.rate = tempRate;
            this.updateDelayTime();
        }
    }
    
    setPingPong(enabled) {
        this.pingPong = enabled;
        this.updatePingPong();
    }
    
    setMix(value) {
        const mix = Math.max(0, Math.min(1, value));
        const now = this.ctx.currentTime;
        this.wet.gain.setTargetAtTime(mix, now, 0.02);
        this.dry.gain.setTargetAtTime(1 - mix * 0.5, now, 0.02);
    }
    
    // Connections
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    getColorName() {
        if (this.color < 0.33) return 'dark';
        if (this.color < 0.66) return 'tape';
        return 'bright';
    }
}

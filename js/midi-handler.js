// MIDI Handler for Ableton Move
// Handles pad input and continuous encoder knobs

export class MIDIHandler {
    constructor() {
        this.midiAccess = null;
        this.inputs = [];
        this.outputs = [];
        
        // Callbacks
        this.onPadOn = null;
        this.onPadOff = null;
        this.onKnobChange = null;
        this.onConnectionChange = null;
        
        // Move MIDI mapping
        // Pads: MIDI notes 33-64 (A1-E4) mapped to our 32 pads
        // For Move in chromatic mode, bottom-left is A1 (33)
        this.padNoteOffset = 33; // A1 - FIXED from 36
        this.padCount = 32;
        
        // Knobs: CC 1-8 (or could be 21-28 depending on Move config)
        this.knobCCs = [1, 2, 3, 4, 5, 6, 7, 8];
        this.alternateKnobCCs = [21, 22, 23, 24, 25, 26, 27, 28];
        
        // Encoder tracking for relative mode
        this.lastKnobValues = new Array(8).fill(64); // Start at center
        this.knobAccumulators = new Array(8).fill(0);
        
        // Status
        this.isConnected = false;
        this.lastActivity = 0;
    }
    
    /**
     * Initialize Web MIDI
     */
    async init() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI not supported in this browser');
            return false;
        }
        
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            
            // Listen for device changes
            this.midiAccess.onstatechange = (e) => this.handleStateChange(e);
            
            // Connect to existing devices
            this.connectDevices();
            
            return true;
        } catch (err) {
            console.error('MIDI access denied:', err);
            return false;
        }
    }
    
    /**
     * Connect to all available MIDI devices
     */
    connectDevices() {
        this.inputs = [];
        this.outputs = [];
        
        // Get all inputs
        for (const input of this.midiAccess.inputs.values()) {
            this.inputs.push(input);
            input.onmidimessage = (msg) => this.handleMIDIMessage(msg);
            console.log(`MIDI Input connected: ${input.name}`);
        }
        
        // Get all outputs (for LED feedback if supported)
        for (const output of this.midiAccess.outputs.values()) {
            this.outputs.push(output);
            console.log(`MIDI Output available: ${output.name}`);
        }
        
        this.isConnected = this.inputs.length > 0;
        
        if (this.onConnectionChange) {
            this.onConnectionChange(this.isConnected, this.inputs);
        }
    }
    
    /**
     * Handle MIDI device connection changes
     */
    handleStateChange(event) {
        console.log(`MIDI device ${event.port.name}: ${event.port.state}`);
        this.connectDevices();
    }
    
    /**
     * Handle incoming MIDI messages
     */
    handleMIDIMessage(event) {
        const [status, data1, data2] = event.data;
        const channel = status & 0x0F;
        const messageType = status & 0xF0;
        
        this.lastActivity = performance.now();
        
        switch (messageType) {
            case 0x90: // Note On
                if (data2 > 0) {
                    this.handleNoteOn(data1, data2 / 127);
                } else {
                    this.handleNoteOff(data1);
                }
                break;
                
            case 0x80: // Note Off
                this.handleNoteOff(data1);
                break;
                
            case 0xB0: // Control Change
                this.handleCC(data1, data2);
                break;
        }
    }
    
    /**
     * Handle note on (pad press)
     */
   handleNoteOn(note, velocity) {
    // Just validate the note is in our expected range
    const padIndex = note - this.padNoteOffset;
    
    if (padIndex >= 0 && padIndex < this.padCount) {
        if (this.onPadOn) {
            this.onPadOn(note, velocity);  // Pass raw MIDI note, not padIndex
        }
    }
}

handleNoteOff(note) {
    const padIndex = note - this.padNoteOffset;
    
    if (padIndex >= 0 && padIndex < this.padCount) {
        if (this.onPadOff) {
            this.onPadOff(note);  // Pass raw MIDI note, not padIndex
        }
    }
}
    
    /**
     * Handle note off (pad release)
     */
    handleNoteOff(note) {
        const padIndex = note - this.padNoteOffset;
        
        if (padIndex >= 0 && padIndex < this.padCount) {
            if (this.onPadOff) {
                this.onPadOff(padIndex);
            }
        }
    }
    
    /**
     * Handle control change (knob turn)
     */
    handleCC(cc, value) {
        // Check if this is one of our knob CCs
        let knobIndex = this.knobCCs.indexOf(cc);
        if (knobIndex === -1) {
            knobIndex = this.alternateKnobCCs.indexOf(cc);
        }
        
        if (knobIndex === -1) return;
        
        // Handle endless encoder (relative mode)
        // Values 1-63 = clockwise (increment)
        // Values 65-127 = counter-clockwise (decrement)
        // Value 64 = no change
        
        let delta = 0;
        
        if (value < 64) {
            // Clockwise - positive increment
            delta = value;
        } else if (value > 64) {
            // Counter-clockwise - negative increment
            delta = value - 128;
        }
        
        // Accumulate and scale
        this.knobAccumulators[knobIndex] += delta;
        
        // Notify with direction and magnitude
        if (this.onKnobChange && delta !== 0) {
            this.onKnobChange(knobIndex, delta, this.knobAccumulators[knobIndex]);
        }
    }
    
    /**
     * Reset knob accumulator
     */
    resetKnobAccumulator(knobIndex) {
        if (knobIndex >= 0 && knobIndex < 8) {
            this.knobAccumulators[knobIndex] = 0;
        }
    }
    
    /**
     * Send LED feedback to device (if supported)
     */
    sendPadLED(padIndex, red, green, blue) {
        // This would need to be implemented based on Move's sysex protocol
        // For now, we'll use standard note-on velocity for brightness
        const note = padIndex + this.padNoteOffset;
        const velocity = Math.max(red, green, blue);
        
        for (const output of this.outputs) {
            output.send([0x90, note, velocity]);
        }
    }
    
    /**
     * Clear all pad LEDs
     */
    clearLEDs() {
        for (let i = 0; i < this.padCount; i++) {
            this.sendPadLED(i, 0, 0, 0);
        }
    }
    
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            deviceCount: this.inputs.length,
            devices: this.inputs.map(i => i.name),
            lastActivity: this.lastActivity
        };
    }
    
    /**
     * Check if there was recent activity
     */
    hasRecentActivity(thresholdMs = 100) {
        return performance.now() - this.lastActivity < thresholdMs;
    }
}

/**
 * Keyboard fallback for testing without MIDI
 */
export class KeyboardHandler {
    constructor() {
        this.onPadOn = null;
        this.onPadOff = null;
        this.onKnobChange = null;
        
        // Map keyboard keys to pads (4x8 grid)
        // Bottom row: z x c v b n m ,
        // Next row: a s d f g h j k
        // Next row: q w e r t y u i
        // Top row: 1 2 3 4 5 6 7 8
        this.keyMap = {
            // Row 0 (bottom)
            'z': 0, 'x': 1, 'c': 2, 'v': 3, 'b': 4, 'n': 5, 'm': 6, ',': 7,
            // Row 1
            'a': 8, 's': 9, 'd': 10, 'f': 11, 'g': 12, 'h': 13, 'j': 14, 'k': 15,
            // Row 2
            'q': 16, 'w': 17, 'e': 18, 'r': 19, 't': 20, 'y': 21, 'u': 22, 'i': 23,
            // Row 3 (top)
            '1': 24, '2': 25, '3': 26, '4': 27, '5': 28, '6': 29, '7': 30, '8': 31
        };
        
        // Knob keys: [ and ] for previous/next knob, up/down arrows for value
        this.selectedKnob = 0;
        
        this.activeKeys = new Set();
        this.enabled = false;
    }
    
    /**
     * Enable keyboard input
     */
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    /**
     * Disable keyboard input
     */
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    /**
     * Handle key press
     */
    handleKeyDown(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        const key = e.key.toLowerCase();
        
        // Check for pad key
        if (key in this.keyMap && !this.activeKeys.has(key)) {
            this.activeKeys.add(key);
            const padIndex = this.keyMap[key];
            if (this.onPadOn) {
                this.onPadOn(padIndex, 1);
            }
            e.preventDefault();
            return;
        }
        
        // Knob selection
        if (key === '[') {
            this.selectedKnob = Math.max(0, this.selectedKnob - 1);
            e.preventDefault();
            return;
        }
        if (key === ']') {
            this.selectedKnob = Math.min(7, this.selectedKnob + 1);
            e.preventDefault();
            return;
        }
        
        // Knob value change
        if (key === 'arrowup' || key === 'arrowright') {
            if (this.onKnobChange) {
                this.onKnobChange(this.selectedKnob, 1, 0);
            }
            e.preventDefault();
            return;
        }
        if (key === 'arrowdown' || key === 'arrowleft') {
            if (this.onKnobChange) {
                this.onKnobChange(this.selectedKnob, -1, 0);
            }
            e.preventDefault();
            return;
        }
    }
    
    /**
     * Handle key release
     */
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        
        if (key in this.keyMap && this.activeKeys.has(key)) {
            this.activeKeys.delete(key);
            const padIndex = this.keyMap[key];
            if (this.onPadOff) {
                this.onPadOff(padIndex);
            }
            e.preventDefault();
        }
    }
    
    /**
     * Get selected knob
     */
    getSelectedKnob() {
        return this.selectedKnob;
    }
}

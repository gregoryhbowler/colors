// Polyphonic Engine Wrapper
// Wraps any synth engine for polyphonic voice management

import { HoneySynth } from './engines/honey-engine.js';
import { VinegarSynth } from './engines/vinegar-engine.js';
import { MollySynth } from './engines/molly-engine.js';
import { midiToFreq } from './harmony.js';

/**
 * Voice state tracker
 */
class VoiceState {
    constructor(synth, index) {
        this.synth = synth;
        this.index = index;
        this.note = null;
        this.active = false;
        this.startTime = 0;
    }
    
    noteOn(note, velocity, time) {
        this.note = note;
        this.active = true;
        this.startTime = time;
        this.synth.noteOn(midiToFreq(note), velocity);
    }
    
    noteOff() {
        this.active = false;
        this.synth.noteOff();
    }
}

/**
 * Polyphonic Engine
 * Manages multiple voices of any synth type
 */
export class PolyphonicEngine {
    constructor(audioContext, maxVoices = 8) {
        this.ctx = audioContext;
        this.maxVoices = maxVoices;
        this.engineType = 'honey';
        this.voices = [];
        this.activeNotes = new Map(); // note -> voiceIndex
        
        // Output mixer
        this.output = this.ctx.createGain();
        this.output.gain.value = 0.8;
        
        // Pre-delay send (for effects)
        this.send = this.ctx.createGain();
        this.send.gain.value = 0;
        
        // Initialize voices
        this.initVoices();
    }
    
    /**
     * Initialize voice pool
     */
    initVoices() {
        // Clean up existing voices
        this.voices.forEach(v => {
            try {
                v.synth.output.disconnect();
                if (v.synth.dispose) v.synth.dispose();
            } catch(e) {}
        });
        
        this.voices = [];
        
        // Create new voices
        for (let i = 0; i < this.maxVoices; i++) {
            let synth;
            
            switch(this.engineType) {
                case 'vinegar':
                    synth = new VinegarSynth(this.ctx);
                    break;
                case 'molly':
                    synth = new MollySynth(this.ctx, 1); // Single voice per wrapper voice
                    break;
                case 'honey':
                default:
                    synth = new HoneySynth(this.ctx);
            }
            
            // Connect to output and send
            synth.output.connect(this.output);
            synth.output.connect(this.send);
            
            // Adjust voice volume based on voice count
            synth.output.gain.value = 0.3 / Math.sqrt(this.maxVoices);
            
            this.voices.push(new VoiceState(synth, i));
        }
    }
    
    /**
     * Set engine type (honey, vinegar, molly)
     */
    setEngineType(type) {
        if (this.engineType === type) return;
        this.engineType = type;
        this.initVoices();
    }
    
    /**
     * Set maximum polyphony
     */
    setPolyphony(count) {
        if (this.maxVoices === count) return;
        this.maxVoices = Math.max(1, Math.min(16, count));
        this.initVoices();
    }
    
    /**
     * Find a free voice or steal the oldest
     */
    allocateVoice() {
        // First, try to find a free voice
        for (const voice of this.voices) {
            if (!voice.active) {
                return voice;
            }
        }
        
        // All voices active - steal the oldest
        let oldest = this.voices[0];
        for (const voice of this.voices) {
            if (voice.startTime < oldest.startTime) {
                oldest = voice;
            }
        }
        
        // Release the stolen voice
        oldest.noteOff();
        return oldest;
    }
    
    /**
     * Find voice playing a specific note
     */
    findVoiceByNote(note) {
        const voiceIndex = this.activeNotes.get(note);
        if (voiceIndex !== undefined) {
            return this.voices[voiceIndex];
        }
        return null;
    }
    
    /**
     * Trigger a note on
     */
    noteOn(note, velocity = 1) {
        // Check if this note is already playing
        let voice = this.findVoiceByNote(note);
        
        if (!voice) {
            voice = this.allocateVoice();
        }
        
        // Track the note-to-voice mapping
        this.activeNotes.set(note, voice.index);
        
        voice.noteOn(note, velocity, this.ctx.currentTime);
    }
    
    /**
     * Trigger a note off
     */
    noteOff(note) {
        const voice = this.findVoiceByNote(note);
        if (voice) {
            voice.noteOff();
            this.activeNotes.delete(note);
        }
    }
    
    /**
     * All notes off
     */
    allNotesOff() {
        for (const voice of this.voices) {
            if (voice.active) {
                voice.noteOff();
            }
        }
        this.activeNotes.clear();
    }
    
    /**
     * Set a synth parameter on all voices
     */
    setParam(param, value) {
        for (const voice of this.voices) {
            voice.synth.setParam(param, value);
        }
    }
    
    /**
     * Randomize patch on all voices
     */
    randomPatch() {
        // Generate random patch on first voice
        this.voices[0].synth.randomPatch();
        
        // Copy parameters to other voices (they share settings)
        // For simplicity, just randomize all voices
        for (let i = 1; i < this.voices.length; i++) {
            this.voices[i].synth.randomPatch();
        }
    }
    
    /**
     * Get current active voice count
     */
    getActiveVoiceCount() {
        return this.voices.filter(v => v.active).length;
    }
    
    /**
     * Connect output to destination
     */
    connect(destination) {
        this.output.connect(destination);
    }
    
    /**
     * Connect send to effect
     */
    connectSend(destination) {
        this.send.connect(destination);
    }
    
    /**
     * Set send level
     */
    setSendLevel(level) {
        this.send.gain.setTargetAtTime(level, this.ctx.currentTime, 0.01);
    }
    
    /**
     * Dispose all voices
     */
    dispose() {
        this.allNotesOff();
        this.voices.forEach(v => {
            try {
                v.synth.output.disconnect();
                if (v.synth.dispose) v.synth.dispose();
            } catch(e) {}
        });
        this.voices = [];
    }
}

// COLORS — Style Generators
// Base classes and utilities for generating gestures in different artistic styles

import { Gesture, GestureEvent, SeededRandom } from './gesture-core.js';
import { midiToFreq, NOTE_NAMES, quantizeToScale } from './harmony.js';

/**
 * Base class for all style generators
 */
export class StyleGenerator {
    constructor(styleId, styleName) {
        this.styleId = styleId;
        this.styleName = styleName;
    }
    
    /**
     * Generate a gesture based on slot config and contexts
     * Must be implemented by subclasses
     */
    generate(slotConfig, harmonicContext, performanceContext) {
        throw new Error('StyleGenerator.generate() must be implemented by subclass');
    }
    
    /**
     * Helper: Get scale notes in a specific register
     */
    getScaleNotesInRegister(harmonicContext, centerNote, rangeOctaves = 2) {
        const scaleNotes = harmonicContext.scaleNotes;
        const minNote = centerNote - (rangeOctaves * 12);
        const maxNote = centerNote + (rangeOctaves * 12);
        
        return scaleNotes.filter(n => n >= minNote && n <= maxNote);
    }
    
    /**
     * Helper: Quantize note to scale
     */
    quantizeNote(note, harmonicContext) {
        return quantizeToScale(note, harmonicContext.root, harmonicContext.scale);
    }
    
    /**
     * Helper: Apply microtiming
     */
    applyMicrotiming(time, amount, rng) {
        if (amount === 0) return time;
        const jitter = (rng.next() - 0.5) * amount * 0.1;
        return Math.max(0, time + jitter);
    }
    
    /**
     * Helper: Get note name
     */
    getNoteName(note) {
        return NOTE_NAMES[note % 12] + Math.floor(note / 12 - 1);
    }
    
    /**
     * Helper: Build chord from root
     */
    buildChord(rootNote, intervals) {
        return intervals.map(i => rootNote + i);
    }
    
    /**
     * Helper: Get quartal chord (4ths)
     */
    getQuartalChord(rootNote, noteCount = 3) {
        const chord = [];
        for (let i = 0; i < noteCount; i++) {
            chord.push(rootNote + i * 5); // Perfect 4th = 5 semitones
        }
        return chord;
    }
    
    /**
     * Helper: Get quintal chord (5ths)
     */
    getQuintalChord(rootNote, noteCount = 3) {
        const chord = [];
        for (let i = 0; i < noteCount; i++) {
            chord.push(rootNote + i * 7); // Perfect 5th = 7 semitones
        }
        return chord;
    }
}

/**
 * Style Registry
 * Central registry for all available style generators
 */
export class StyleRegistry {
    constructor() {
        this.styles = new Map();
    }
    
    /**
     * Register a style generator
     */
    register(generator) {
        this.styles.set(generator.styleId, generator);
        console.log(`[StyleRegistry] Registered style: ${generator.styleId} (${generator.styleName})`);
    }
    
    /**
     * Get a style generator
     */
    get(styleId) {
        return this.styles.get(styleId);
    }
    
    /**
     * Check if style exists
     */
    has(styleId) {
        return this.styles.has(styleId);
    }
    
    /**
     * Get all style IDs
     */
    getAllStyleIds() {
        return Array.from(this.styles.keys());
    }
    
    /**
     * Generate a gesture using registered style
     */
    generate(slotConfig, harmonicContext, performanceContext) {
        const generator = this.get(slotConfig.styleId);
        
        if (!generator) {
            console.warn(`[StyleRegistry] Unknown style: ${slotConfig.styleId}, using default`);
            // Return empty gesture as fallback
            return new Gesture({
                typeId: 'empty',
                slotId: slotConfig.slotId,
                role: slotConfig.role,
                events: [],
                display: 'Empty'
            });
        }
        
        return generator.generate(slotConfig, harmonicContext, performanceContext);
    }
}

/**
 * Create the global style registry
 */
export const styleRegistry = new StyleRegistry();

/**
 * Helper functions for gesture generation
 */

/**
 * Create a scalar run (ascending or descending)
 */
export function createScalarRun(scaleNotes, startNote, direction = 1, noteCount = 8, rhythmPattern = null) {
    const events = [];
    const startIndex = scaleNotes.indexOf(startNote);
    
    if (startIndex === -1) return events;
    
    for (let i = 0; i < noteCount; i++) {
        const index = startIndex + (i * direction);
        if (index < 0 || index >= scaleNotes.length) break;
        
        const time = rhythmPattern ? rhythmPattern[i % rhythmPattern.length] : i * 0.25;
        
        events.push(new GestureEvent({
            time: time,
            note: scaleNotes[index],
            velocity: 0.7 + Math.random() * 0.2,
            duration: 0.2
        }));
    }
    
    return events;
}

/**
 * Create a broken chord (arpeggiated)
 */
export function createBrokenChord(chordNotes, pattern = 'up', loops = 1, beatLength = 2) {
    const events = [];
    let sequence = [];
    
    switch (pattern) {
        case 'up':
            sequence = chordNotes;
            break;
        case 'down':
            sequence = [...chordNotes].reverse();
            break;
        case 'upDown':
            sequence = [...chordNotes, ...chordNotes.slice(1, -1).reverse()];
            break;
        case 'random':
            sequence = chordNotes.sort(() => Math.random() - 0.5);
            break;
    }
    
    const timePerNote = beatLength / sequence.length;
    
    for (let loop = 0; loop < loops; loop++) {
        for (let i = 0; i < sequence.length; i++) {
            events.push(new GestureEvent({
                time: (loop * beatLength) + (i * timePerNote),
                note: sequence[i],
                velocity: 0.7 + Math.random() * 0.2,
                duration: timePerNote * 0.8
            }));
        }
    }
    
    return events;
}

/**
 * Create a pedal tone with melody
 */
export function createPedalWithMelody(pedalNote, melodyNotes, melodyRhythm = [0, 0.5, 1, 1.5]) {
    const events = [];
    
    // Pedal tone
    events.push(new GestureEvent({
        time: 0,
        note: pedalNote,
        velocity: 0.5,
        duration: melodyRhythm[melodyRhythm.length - 1] + 0.5,
        tag: 'pedal'
    }));
    
    // Melody
    for (let i = 0; i < melodyNotes.length && i < melodyRhythm.length; i++) {
        events.push(new GestureEvent({
            time: melodyRhythm[i],
            note: melodyNotes[i],
            velocity: 0.8,
            duration: 0.4
        }));
    }
    
    return events;
}

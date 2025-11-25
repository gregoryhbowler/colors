// COLORS — Gesture Palette Core
// Data structures and types for the keyboard-spanning gesture system

/**
 * Configuration for a single keyboard slot
 * Each slot (MIDI note or index) has its own gesture behavior
 */
export class SlotConfig {
    constructor({
        slotId = 60,
        styleId = 'lyricalMinimal',
        role = 'chords',
        density = 0.5,
        complexity = 0.5,
        tension = 0.3,
        registerShift = 0,
        rhythmLoose = 0.2,
        motifVariation = 0.3,
        seed = Math.random()
    } = {}) {
        this.slotId = slotId;           // MIDI note number or logical index
        this.styleId = styleId;         // Which style generator to use
        this.role = role;               // 'chords', 'lead', 'texture', 'bass', 'percussion'
        this.density = density;         // 0-1: How many notes
        this.complexity = complexity;   // 0-1: How intricate the pattern
        this.tension = tension;         // 0-1: Dissonance/chromaticism
        this.registerShift = registerShift; // -2..+2: Octave adjustment
        this.rhythmLoose = rhythmLoose; // 0-1: Microtiming/humanization
        this.motifVariation = motifVariation; // 0-1: Pattern mutation
        this.seed = seed;               // Stable randomness per slot
    }
}

/**
 * A single event within a gesture
 */
export class GestureEvent {
    constructor({
        time = 0,
        note = 60,
        velocity = 0.8,
        duration = 0.5,
        tag = null
    } = {}) {
        this.time = time;           // Beats from gesture start
        this.note = note;           // MIDI note number
        this.velocity = velocity;   // 0-1
        this.duration = duration;   // Beats
        this.tag = tag;            // 'accent', 'grace', 'cluster', 'pedal', 'ghost', 'slide'
    }
}

/**
 * A complete gesture with all its events
 */
export class Gesture {
    constructor({
        typeId = 'unknown',
        slotId = 60,
        role = 'chords',
        events = [],
        loopLengthBeats = null,
        display = ''
    } = {}) {
        this.typeId = typeId;               // Style identifier
        this.slotId = slotId;               // Which keyboard slot
        this.role = role;                   // Musical role
        this.events = events;               // Array of GestureEvent
        this.loopLengthBeats = loopLengthBeats; // null = one-shot, number = loop
        this.display = display;             // UI label
    }
    
    /**
     * Get total duration of gesture in beats
     */
    getTotalDuration() {
        if (this.events.length === 0) return 0;
        return Math.max(...this.events.map(e => e.time + e.duration));
    }
    
    /**
     * Get all unique notes in gesture
     */
    getUniqueNotes() {
        return [...new Set(this.events.map(e => e.note))];
    }
}

/**
 * Harmonic context for gesture generation
 */
export class HarmonicContext {
    constructor({
        root = 'C',
        scale = 'major',
        scaleNotes = [],
        diatonicChords = [],
        currentChord = null,
        progression = []
    } = {}) {
        this.root = root;
        this.scale = scale;
        this.scaleNotes = scaleNotes;       // Array of MIDI notes in scale
        this.diatonicChords = diatonicChords; // Available chords
        this.currentChord = currentChord;   // Currently playing chord
        this.progression = progression;     // Chord progression history
    }
}

/**
 * Performance context for dynamic gesture generation
 */
export class PerformanceContext {
    constructor({
        barCount = 0,
        globalIntensity = 0.5,
        lastChords = [],
        tempo = 120
    } = {}) {
        this.barCount = barCount;
        this.globalIntensity = globalIntensity;
        this.lastChords = lastChords;
        this.tempo = tempo;
    }
    
    /**
     * Get milliseconds per beat
     */
    getMsPerBeat() {
        return 60000 / this.tempo;
    }
    
    /**
     * Get seconds per beat
     */
    getSecsPerBeat() {
        return 60 / this.tempo;
    }
}

/**
 * Seeded random number generator for consistent variation
 */
export class SeededRandom {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
    
    range(min, max) {
        return min + this.next() * (max - min);
    }
    
    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }
    
    choice(array) {
        return array[this.int(0, array.length - 1)];
    }
    
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

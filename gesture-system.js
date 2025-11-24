// Gesture System
// Generates and manages musical gestures for the 32-pad grid

import { 
    getDiatonicChords, 
    getScaleNotes, 
    generateVoicings,
    generateArpPatterns,
    getRandomScaleNote,
    midiToFreq,
    NOTE_NAMES,
    getChordSymbol,
    generateMelodicPhrase
} from './harmony.js';

// Gesture type definitions
export const GESTURE_TYPES = [
    { id: 'block', name: 'BLOCK', description: 'Block chords' },
    { id: 'strum', name: 'STRUM', description: 'Strummed chords' },
    { id: 'arp', name: 'ARP', description: 'Arpeggiated patterns' },
    { id: 'single', name: 'SINGLE', description: 'Single notes' },
    { id: 'staccato', name: 'STACCATO', description: 'Staccato notes' },
    { id: 'groove', name: 'GROOVE', description: 'Tempo-synced loops' },
    { id: 'oneshot', name: 'ONESHOT', description: 'One-shot patterns' },
    { id: 'perc', name: 'PERC', description: 'Percussive hits' }
];

/**
 * Generate a block chord gesture
 */
function generateBlockChord(chord, voicingIndex = 0) {
    const voicings = generateVoicings(chord);
    const voicing = voicings[voicingIndex % voicings.length];
    
    return {
        type: 'block',
        typeName: 'BLOCK',
        chord: chord.symbol,
        notes: voicing,
        frequencies: voicing.map(midiToFreq),
        duration: 'sustain', // Sustains while held
        display: chord.symbol
    };
}

/**
 * Generate a strummed chord gesture
 */
function generateStrumChord(chord, direction = 'up', voicingIndex = 0) {
    const voicings = generateVoicings(chord);
    const voicing = voicings[voicingIndex % voicings.length];
    const notes = direction === 'down' ? [...voicing].reverse() : voicing;
    
    return {
        type: 'strum',
        typeName: 'STRUM',
        chord: chord.symbol,
        notes: notes,
        frequencies: notes.map(midiToFreq),
        direction: direction,
        duration: 'sustain',
        display: `${chord.symbol} ${direction === 'up' ? '↑' : '↓'}`
    };
}

/**
 * Generate an arpeggio gesture
 */
function generateArpGesture(chord, patternType = 'up') {
    const patterns = generateArpPatterns(chord.notes);
    const pattern = patterns.find(p => p.name === patternType) || patterns[0];
    
    return {
        type: 'arp',
        typeName: 'ARP',
        chord: chord.symbol,
        notes: pattern.notes,
        frequencies: pattern.notes.map(midiToFreq),
        pattern: patternType,
        duration: 'loop', // Loops while held
        display: `${chord.symbol} arp`
    };
}

/**
 * Generate a single note gesture
 */
function generateSingleNote(note, octave = 4) {
    const midi = note + (octave + 1) * 12;
    const noteName = NOTE_NAMES[note % 12];
    
    return {
        type: 'single',
        typeName: 'SINGLE',
        notes: [midi],
        frequencies: [midiToFreq(midi)],
        duration: 'sustain',
        display: `${noteName}${octave}`
    };
}

/**
 * Generate a staccato note gesture
 */
function generateStaccatoNote(note, octave = 4) {
    const midi = note + (octave + 1) * 12;
    const noteName = NOTE_NAMES[note % 12];
    
    return {
        type: 'staccato',
        typeName: 'STACCATO',
        notes: [midi],
        frequencies: [midiToFreq(midi)],
        duration: 'short', // Fixed short duration
        gateTime: 0.1, // 100ms gate
        display: `${noteName}${octave}·`
    };
}

/**
 * Generate a groove pattern (tempo-synced loop)
 */
function generateGroovePattern(chord, patternIndex = 0) {
    const patterns = [
        // Downbeat emphasis
        { steps: [1, 0, 0, 0, 1, 0, 0, 0], name: 'pulse' },
        // Offbeat
        { steps: [0, 0, 1, 0, 0, 0, 1, 0], name: 'offbeat' },
        // Syncopated
        { steps: [1, 0, 0, 1, 0, 0, 1, 0], name: 'syncopated' },
        // Dense
        { steps: [1, 0, 1, 0, 1, 0, 1, 0], name: 'dense' },
        // Sparse
        { steps: [1, 0, 0, 0, 0, 0, 0, 0], name: 'sparse' },
        // Driving
        { steps: [1, 1, 0, 1, 1, 0, 1, 0], name: 'driving' }
    ];
    
    const pattern = patterns[patternIndex % patterns.length];
    
    return {
        type: 'groove',
        typeName: 'GROOVE',
        chord: chord.symbol,
        notes: chord.notes,
        frequencies: chord.notes.map(midiToFreq),
        pattern: pattern.steps,
        patternName: pattern.name,
        duration: 'loop',
        stepsPerBeat: 2, // 8 steps = 4 beats = 1 bar
        display: `${chord.symbol} ${pattern.name}`
    };
}

/**
 * Generate a one-shot pattern
 */
function generateOneshotPattern(chord, patternType = 'riff') {
    const patterns = {
        riff: [
            { note: 0, time: 0, velocity: 1 },
            { note: 2, time: 0.25, velocity: 0.8 },
            { note: 1, time: 0.5, velocity: 0.9 },
            { note: 0, time: 0.75, velocity: 0.7 }
        ],
        stab: [
            { note: 'chord', time: 0, velocity: 1 },
            { note: 'chord', time: 0.5, velocity: 0.6 }
        ],
        cascade: chord.notes.map((n, i) => ({
            note: i,
            time: i * 0.1,
            velocity: 1 - i * 0.15
        })),
        burst: [
            { note: 'chord', time: 0, velocity: 1 },
            { note: 'chord', time: 0.08, velocity: 0.8 },
            { note: 'chord', time: 0.16, velocity: 0.6 }
        ]
    };
    
    return {
        type: 'oneshot',
        typeName: 'ONESHOT',
        chord: chord.symbol,
        notes: chord.notes,
        frequencies: chord.notes.map(midiToFreq),
        pattern: patterns[patternType] || patterns.riff,
        patternType: patternType,
        duration: 'oneshot',
        display: `${chord.symbol} ${patternType}`
    };
}

/**
 * Generate a percussive gesture
 */
function generatePercGesture(scaleNotes, style = 'hit') {
    const styles = {
        hit: {
            notes: [scaleNotes[0]],
            gateTime: 0.05,
            velocity: 1
        },
        flam: {
            notes: [scaleNotes[0], scaleNotes[0]],
            delays: [0, 0.02],
            gateTime: 0.05,
            velocity: [0.7, 1]
        },
        roll: {
            notes: Array(4).fill(scaleNotes[0]),
            delays: [0, 0.05, 0.1, 0.15],
            gateTime: 0.03,
            velocity: [0.6, 0.7, 0.8, 1]
        },
        cluster: {
            notes: scaleNotes.slice(0, 3),
            delays: [0, 0.01, 0.02],
            gateTime: 0.08,
            velocity: [1, 0.9, 0.8]
        }
    };
    
    const styleData = styles[style] || styles.hit;
    const noteName = NOTE_NAMES[scaleNotes[0] % 12];
    
    return {
        type: 'perc',
        typeName: 'PERC',
        notes: styleData.notes,
        frequencies: styleData.notes.map(midiToFreq),
        delays: styleData.delays || [0],
        gateTime: styleData.gateTime,
        velocities: Array.isArray(styleData.velocity) ? styleData.velocity : [styleData.velocity],
        style: style,
        duration: 'oneshot',
        display: `${noteName} ${style}`
    };
}

/**
 * Gesture Grid Manager
 */
export class GestureGrid {
    constructor() {
        this.pads = new Array(32).fill(null);
        this.columnTypes = new Array(8).fill(0); // Index into GESTURE_TYPES
        this.root = 'C';
        this.scale = 'major';
        this.octave = 4;
        
        // Strum settings
        this.strumSpeed = 60; // ms between notes
        this.strumVariance = 0.3; // 0-1 variance amount
        
        // Tempo for grooves
        this.tempo = 120;
    }
    
    /**
     * Set harmony parameters
     */
    setHarmony(root, scale) {
        this.root = root;
        this.scale = scale;
        this.regenerate();
    }
    
    /**
     * Set column gesture type
     */
    setColumnType(column, typeIndex) {
        if (column >= 0 && column < 8) {
            this.columnTypes[column] = typeIndex % GESTURE_TYPES.length;
            this.regenerateColumn(column);
        }
    }
    
    /**
     * Get column gesture type name
     */
    getColumnTypeName(column) {
        return GESTURE_TYPES[this.columnTypes[column]].name;
    }
    
    /**
     * Regenerate all pads
     */
    regenerate() {
        const chords = getDiatonicChords(this.root, this.scale, this.octave);
        const scaleNotes = getScaleNotes(this.root, this.scale, this.octave - 1, this.octave + 1);
        
        for (let col = 0; col < 8; col++) {
            this.regenerateColumn(col, chords, scaleNotes);
        }
    }
    
    /**
     * Regenerate a single column
     */
    regenerateColumn(column, chords = null, scaleNotes = null) {
        if (!chords) {
            chords = getDiatonicChords(this.root, this.scale, this.octave);
        }
        if (!scaleNotes) {
            scaleNotes = getScaleNotes(this.root, this.scale, this.octave - 1, this.octave + 1);
        }
        
        const gestureType = GESTURE_TYPES[this.columnTypes[column]];
        
        for (let row = 0; row < 4; row++) {
            const padIndex = row * 8 + column;
            const chord = chords[row % chords.length];
            const variation = row;
            
            this.pads[padIndex] = this.generateGestureForType(
                gestureType.id, 
                chord, 
                scaleNotes, 
                variation
            );
        }
    }
    
    /**
     * Generate gesture based on type
     */
    generateGestureForType(typeId, chord, scaleNotes, variation) {
        switch(typeId) {
            case 'block':
                return generateBlockChord(chord, variation);
            
            case 'strum':
                const directions = ['up', 'down', 'up', 'down'];
                return generateStrumChord(chord, directions[variation], variation);
            
            case 'arp':
                const arpPatterns = ['up', 'down', 'upDown', 'pedal'];
                return generateArpGesture(chord, arpPatterns[variation]);
            
            case 'single':
                const noteIndex = variation * 2;
                const note = scaleNotes[noteIndex % scaleNotes.length];
                return generateSingleNote(note % 12, Math.floor(note / 12) - 1);
            
            case 'staccato':
                const stacNote = scaleNotes[(variation * 3) % scaleNotes.length];
                return generateStaccatoNote(stacNote % 12, Math.floor(stacNote / 12) - 1);
            
            case 'groove':
                return generateGroovePattern(chord, variation);
            
            case 'oneshot':
                const oneshotTypes = ['riff', 'stab', 'cascade', 'burst'];
                return generateOneshotPattern(chord, oneshotTypes[variation]);
            
            case 'perc':
                const percStyles = ['hit', 'flam', 'roll', 'cluster'];
                return generatePercGesture(scaleNotes.slice(variation * 2), percStyles[variation]);
            
            default:
                return generateBlockChord(chord, variation);
        }
    }
    
    /**
     * Get pad at index
     */
    getPad(index) {
        return this.pads[index];
    }
    
    /**
     * Get pad at row/column
     */
    getPadAt(row, column) {
        return this.pads[row * 8 + column];
    }
    
    /**
     * Set strum parameters
     */
    setStrumParams(speed, variance) {
        this.strumSpeed = speed;
        this.strumVariance = variance;
    }
    
    /**
     * Set tempo
     */
    setTempo(bpm) {
        this.tempo = bpm;
    }
    
    /**
     * Get strum delay for a note
     */
    getStrumDelay(noteIndex) {
        const baseDelay = noteIndex * this.strumSpeed;
        const variance = (Math.random() - 0.5) * 2 * this.strumVariance * this.strumSpeed;
        return Math.max(0, baseDelay + variance);
    }
    
    /**
     * Get ms per beat
     */
    getMsPerBeat() {
        return 60000 / this.tempo;
    }
}

/**
 * Gesture Player
 * Handles playback of gestures
 */
export class GesturePlayer {
    constructor(engine) {
        this.engine = engine;
        this.activeGestures = new Map(); // padIndex -> playback state
        this.grid = null;
    }
    
    /**
     * Set grid reference
     */
    setGrid(grid) {
        this.grid = grid;
    }
    
    /**
     * Trigger pad on
     */
    triggerPad(padIndex, velocity = 1) {
        if (!this.grid) return;
        
        const gesture = this.grid.getPad(padIndex);
        if (!gesture) return;
        
        // Stop any existing playback for this pad
        this.releasePad(padIndex);
        
        // Start new playback
        const playbackState = {
            gesture,
            velocity,
            startTime: performance.now(),
            activeNotes: [],
            intervalId: null,
            stepIndex: 0
        };
        
        this.activeGestures.set(padIndex, playbackState);
        
        // Play based on gesture type
        switch(gesture.type) {
            case 'block':
                this.playBlock(playbackState);
                break;
            case 'strum':
                this.playStrum(playbackState);
                break;
            case 'arp':
                this.startArp(playbackState, padIndex);
                break;
            case 'single':
            case 'staccato':
                this.playSingle(playbackState);
                break;
            case 'groove':
                this.startGroove(playbackState, padIndex);
                break;
            case 'oneshot':
                this.playOneshot(playbackState);
                break;
            case 'perc':
                this.playPerc(playbackState);
                break;
        }
        
        return gesture;
    }
    
    /**
     * Release pad
     */
    releasePad(padIndex) {
        const state = this.activeGestures.get(padIndex);
        if (!state) return;
        
        // Stop any loops
        if (state.intervalId) {
            clearInterval(state.intervalId);
        }
        
        // Release all active notes
        for (const note of state.activeNotes) {
            this.engine.noteOff(note);
        }
        
        this.activeGestures.delete(padIndex);
    }
    
    /**
     * Release all pads
     */
    releaseAll() {
        for (const padIndex of this.activeGestures.keys()) {
            this.releasePad(padIndex);
        }
    }
    
    /**
     * Play block chord
     */
    playBlock(state) {
        for (const note of state.gesture.notes) {
            this.engine.noteOn(note, state.velocity);
            state.activeNotes.push(note);
        }
    }
    
    /**
     * Play strummed chord
     */
    playStrum(state) {
        const notes = state.gesture.notes;
        
        notes.forEach((note, i) => {
            const delay = this.grid.getStrumDelay(i);
            
            setTimeout(() => {
                if (this.activeGestures.has(state)) {
                    this.engine.noteOn(note, state.velocity * (1 - i * 0.05));
                    state.activeNotes.push(note);
                }
            }, delay);
        });
    }
    
    /**
     * Start arpeggio loop
     */
    startArp(state, padIndex) {
        const notes = state.gesture.notes;
        const msPerNote = this.grid.getMsPerBeat() / 4; // 16th notes
        
        // Play first note immediately
        this.playArpNote(state, 0);
        
        // Start loop
        state.intervalId = setInterval(() => {
            state.stepIndex = (state.stepIndex + 1) % notes.length;
            this.playArpNote(state, state.stepIndex);
        }, msPerNote);
    }
    
    /**
     * Play single arp note
     */
    playArpNote(state, index) {
        // Release previous notes
        for (const note of state.activeNotes) {
            this.engine.noteOff(note);
        }
        state.activeNotes = [];
        
        // Play new note
        const note = state.gesture.notes[index];
        this.engine.noteOn(note, state.velocity);
        state.activeNotes.push(note);
    }
    
    /**
     * Play single/staccato note
     */
    playSingle(state) {
        const note = state.gesture.notes[0];
        this.engine.noteOn(note, state.velocity);
        state.activeNotes.push(note);
        
        // Auto-release for staccato
        if (state.gesture.type === 'staccato') {
            setTimeout(() => {
                this.engine.noteOff(note);
                state.activeNotes = state.activeNotes.filter(n => n !== note);
            }, state.gesture.gateTime * 1000);
        }
    }
    
    /**
     * Start groove pattern loop
     */
    startGroove(state, padIndex) {
        const pattern = state.gesture.pattern;
        const msPerStep = this.grid.getMsPerBeat() / state.gesture.stepsPerBeat;
        
        // Play first step if active
        if (pattern[0]) {
            this.playGrooveStep(state);
        }
        
        // Start loop
        state.intervalId = setInterval(() => {
            state.stepIndex = (state.stepIndex + 1) % pattern.length;
            
            // Release previous notes
            for (const note of state.activeNotes) {
                this.engine.noteOff(note);
            }
            state.activeNotes = [];
            
            // Play if step is active
            if (pattern[state.stepIndex]) {
                this.playGrooveStep(state);
            }
        }, msPerStep);
    }
    
    /**
     * Play groove step
     */
    playGrooveStep(state) {
        for (const note of state.gesture.notes) {
            this.engine.noteOn(note, state.velocity * (0.8 + Math.random() * 0.2));
            state.activeNotes.push(note);
        }
    }
    
    /**
     * Play oneshot pattern
     */
    playOneshot(state) {
        const pattern = state.gesture.pattern;
        const notes = state.gesture.notes;
        
        for (const step of pattern) {
            const delay = step.time * this.grid.getMsPerBeat();
            
            setTimeout(() => {
                if (step.note === 'chord') {
                    // Play all chord notes
                    for (const note of notes) {
                        this.engine.noteOn(note, state.velocity * step.velocity);
                    }
                } else {
                    // Play single note from chord
                    const noteIndex = step.note % notes.length;
                    this.engine.noteOn(notes[noteIndex], state.velocity * step.velocity);
                }
            }, delay);
        }
        
        // Schedule note offs
        const totalDuration = Math.max(...pattern.map(s => s.time)) * this.grid.getMsPerBeat() + 200;
        setTimeout(() => {
            this.engine.allNotesOff();
        }, totalDuration);
    }
    
    /**
     * Play percussive gesture
     */
    playPerc(state) {
        const { notes, delays, velocities, gateTime } = state.gesture;
        
        notes.forEach((note, i) => {
            const delay = (delays[i] || 0) * 1000;
            const velocity = velocities[i] || state.velocity;
            
            setTimeout(() => {
                this.engine.noteOn(note, velocity);
                
                // Auto-release
                setTimeout(() => {
                    this.engine.noteOff(note);
                }, gateTime * 1000);
            }, delay);
        });
    }
}

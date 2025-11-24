// Harmony Module
// Generates scales, chords, and musical content within a key

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale intervals (semitones from root)
export const SCALES = {
    major:           [0, 2, 4, 5, 7, 9, 11],
    minor:           [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor:   [0, 2, 3, 5, 7, 8, 11],
    melodicMinor:    [0, 2, 3, 5, 7, 9, 11],
    dorian:          [0, 2, 3, 5, 7, 9, 10],
    phrygian:        [0, 1, 3, 5, 7, 8, 10],
    lydian:          [0, 2, 4, 6, 7, 9, 11],
    mixolydian:      [0, 2, 4, 5, 7, 9, 10],
    locrian:         [0, 1, 3, 5, 6, 8, 10],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    blues:           [0, 3, 5, 6, 7, 10]
};

// Chord types (intervals from root)
export const CHORD_TYPES = {
    major:      { intervals: [0, 4, 7], symbol: '' },
    minor:      { intervals: [0, 3, 7], symbol: 'm' },
    dim:        { intervals: [0, 3, 6], symbol: '°' },
    aug:        { intervals: [0, 4, 8], symbol: '+' },
    maj7:       { intervals: [0, 4, 7, 11], symbol: 'maj7' },
    min7:       { intervals: [0, 3, 7, 10], symbol: 'm7' },
    dom7:       { intervals: [0, 4, 7, 10], symbol: '7' },
    dim7:       { intervals: [0, 3, 6, 9], symbol: '°7' },
    min7b5:     { intervals: [0, 3, 6, 10], symbol: 'ø7' },
    sus2:       { intervals: [0, 2, 7], symbol: 'sus2' },
    sus4:       { intervals: [0, 5, 7], symbol: 'sus4' },
    add9:       { intervals: [0, 4, 7, 14], symbol: 'add9' },
    madd9:      { intervals: [0, 3, 7, 14], symbol: 'madd9' },
    power:      { intervals: [0, 7], symbol: '5' },
    power8:     { intervals: [0, 7, 12], symbol: '5' }
};

// Diatonic chord qualities for each scale degree
const DIATONIC_CHORDS = {
    major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'],
    minor: ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'],
    harmonicMinor: ['minor', 'dim', 'aug', 'minor', 'major', 'major', 'dim'],
    melodicMinor: ['minor', 'minor', 'aug', 'major', 'major', 'dim', 'dim'],
    dorian: ['minor', 'minor', 'major', 'major', 'minor', 'dim', 'major'],
    phrygian: ['minor', 'major', 'major', 'minor', 'dim', 'major', 'minor'],
    lydian: ['major', 'major', 'minor', 'dim', 'major', 'minor', 'minor'],
    mixolydian: ['major', 'minor', 'dim', 'major', 'minor', 'minor', 'major'],
    locrian: ['dim', 'major', 'minor', 'minor', 'major', 'major', 'minor']
};

/**
 * Convert note name to MIDI number
 */
export function noteToMidi(noteName, octave = 4) {
    const noteIndex = NOTE_NAMES.indexOf(noteName.toUpperCase());
    if (noteIndex === -1) return 60;
    return noteIndex + (octave + 1) * 12;
}

/**
 * Convert MIDI number to frequency
 */
export function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Get scale notes as MIDI numbers in a given octave range
 */
export function getScaleNotes(root, scaleName, octaveLow = 3, octaveHigh = 5) {
    const rootIndex = NOTE_NAMES.indexOf(root);
    if (rootIndex === -1) return [];
    
    const scaleIntervals = SCALES[scaleName] || SCALES.major;
    const notes = [];
    
    for (let octave = octaveLow; octave <= octaveHigh; octave++) {
        for (const interval of scaleIntervals) {
            const midi = (rootIndex + interval) + (octave + 1) * 12;
            if (midi >= 36 && midi <= 96) { // Keep in reasonable range
                notes.push(midi);
            }
        }
    }
    
    return [...new Set(notes)].sort((a, b) => a - b);
}

/**
 * Build a chord from root MIDI note
 */
export function buildChord(rootMidi, chordType, inversion = 0) {
    const chord = CHORD_TYPES[chordType] || CHORD_TYPES.major;
    let notes = chord.intervals.map(interval => rootMidi + interval);
    
    // Apply inversion
    for (let i = 0; i < inversion && i < notes.length - 1; i++) {
        notes[i] += 12;
    }
    
    return notes.sort((a, b) => a - b);
}

/**
 * Get diatonic chords for a scale
 */
export function getDiatonicChords(root, scaleName, octave = 4) {
    const rootIndex = NOTE_NAMES.indexOf(root);
    const scaleIntervals = SCALES[scaleName] || SCALES.major;
    const chordQualities = DIATONIC_CHORDS[scaleName] || DIATONIC_CHORDS.major;
    
    const chords = [];
    
    for (let i = 0; i < scaleIntervals.length && i < chordQualities.length; i++) {
        const chordRoot = (rootIndex + scaleIntervals[i]) % 12;
        const chordRootMidi = chordRoot + (octave + 1) * 12;
        const chordType = chordQualities[i];
        const chordNotes = buildChord(chordRootMidi, chordType);
        
        chords.push({
            degree: i + 1,
            root: NOTE_NAMES[chordRoot],
            type: chordType,
            symbol: NOTE_NAMES[chordRoot] + CHORD_TYPES[chordType].symbol,
            notes: chordNotes,
            frequencies: chordNotes.map(midiToFreq)
        });
    }
    
    return chords;
}

/**
 * Generate chord voicings (different inversions and spacings)
 */
export function generateVoicings(chord, count = 4) {
    const voicings = [chord.notes]; // Original
    
    // Inversions
    for (let inv = 1; inv < chord.notes.length; inv++) {
        const inverted = buildChord(chord.notes[0] - chord.notes[0] % 12, chord.type, inv);
        voicings.push(inverted);
    }
    
    // Drop voicings (drop the second-highest note an octave)
    if (chord.notes.length >= 3) {
        const dropped = [...chord.notes];
        dropped[dropped.length - 2] -= 12;
        dropped.sort((a, b) => a - b);
        voicings.push(dropped);
    }
    
    // Open voicing (spread notes across octaves)
    if (chord.notes.length >= 3) {
        const open = chord.notes.map((note, i) => {
            if (i % 2 === 1) return note + 12;
            return note;
        });
        voicings.push(open.sort((a, b) => a - b));
    }
    
    // Octave doubled root
    const doubled = [...chord.notes, chord.notes[0] + 12];
    voicings.push(doubled.sort((a, b) => a - b));
    
    return voicings.slice(0, count);
}

/**
 * Generate arpeggio patterns
 */
export function generateArpPatterns(chordNotes) {
    const patterns = [];
    
    // Up
    patterns.push({ name: 'up', notes: [...chordNotes] });
    
    // Down
    patterns.push({ name: 'down', notes: [...chordNotes].reverse() });
    
    // Up-Down
    const upDown = [...chordNotes, ...chordNotes.slice(1, -1).reverse()];
    patterns.push({ name: 'upDown', notes: upDown });
    
    // Down-Up
    const downUp = [...chordNotes].reverse().concat(chordNotes.slice(1, -1));
    patterns.push({ name: 'downUp', notes: downUp });
    
    // Random order
    const shuffled = [...chordNotes].sort(() => Math.random() - 0.5);
    patterns.push({ name: 'random', notes: shuffled });
    
    // Pedal (root + alternating)
    if (chordNotes.length >= 2) {
        const pedal = [];
        for (let i = 1; i < chordNotes.length; i++) {
            pedal.push(chordNotes[0], chordNotes[i]);
        }
        patterns.push({ name: 'pedal', notes: pedal });
    }
    
    return patterns;
}

/**
 * Get a random note from the scale
 */
export function getRandomScaleNote(scaleNotes) {
    return scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
}

/**
 * Get a random chord from the diatonic set
 */
export function getRandomDiatonicChord(root, scaleName, octave = 4) {
    const chords = getDiatonicChords(root, scaleName, octave);
    return chords[Math.floor(Math.random() * chords.length)];
}

/**
 * Quantize a note to the nearest scale degree
 */
export function quantizeToScale(midiNote, root, scaleName) {
    const rootIndex = NOTE_NAMES.indexOf(root);
    const scaleIntervals = SCALES[scaleName] || SCALES.major;
    
    const noteClass = midiNote % 12;
    const octave = Math.floor(midiNote / 12);
    
    // Find nearest scale degree
    let minDist = 12;
    let nearestInterval = 0;
    
    for (const interval of scaleIntervals) {
        const scaleDegree = (rootIndex + interval) % 12;
        let dist = Math.abs(noteClass - scaleDegree);
        if (dist > 6) dist = 12 - dist;
        
        if (dist < minDist) {
            minDist = dist;
            nearestInterval = (scaleDegree);
        }
    }
    
    return octave * 12 + nearestInterval;
}

/**
 * Generate a melodic phrase
 */
export function generateMelodicPhrase(root, scaleName, length = 4, octaveLow = 4, octaveHigh = 5) {
    const scaleNotes = getScaleNotes(root, scaleName, octaveLow, octaveHigh);
    const phrase = [];
    
    let currentIndex = Math.floor(scaleNotes.length / 2);
    
    for (let i = 0; i < length; i++) {
        // Weighted random walk
        const step = Math.floor(Math.random() * 5) - 2; // -2 to +2
        currentIndex = Math.max(0, Math.min(scaleNotes.length - 1, currentIndex + step));
        phrase.push(scaleNotes[currentIndex]);
    }
    
    return phrase;
}

/**
 * Get chord symbol for display
 */
export function getChordSymbol(root, chordType) {
    const chord = CHORD_TYPES[chordType];
    return root + (chord ? chord.symbol : '');
}

/**
 * Check if notes are in scale
 */
export function notesInScale(notes, root, scaleName) {
    const rootIndex = NOTE_NAMES.indexOf(root);
    const scaleIntervals = SCALES[scaleName] || SCALES.major;
    const scaleNoteClasses = scaleIntervals.map(i => (rootIndex + i) % 12);
    
    return notes.every(note => scaleNoteClasses.includes(note % 12));
}

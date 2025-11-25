// COLORS — Main Application Controller
// Now with keyboard-spanning gesture palette system

import { PolyphonicEngine } from './polyphonic-engine.js';
import { KeyboardGesturePalette } from './keyboard-palette.js';
import { EventGesturePlayer } from './event-gesture-player.js';
import { MimeophonDelay } from './mimeophon-delay.js';
import { MIDIHandler, KeyboardHandler } from './midi-handler.js';
import { WAVRecorder } from './recorder.js';
import { NOTE_NAMES, SCALES, getScaleNotes, getDiatonicChords, buildChord, generateVoicings, CHORD_TYPES } from './harmony.js';

class GestaltApp {
    constructor() {
        this.audioContext = null;
        this.engine = null;
        this.delay = null;
        this.palette = null; // NEW: Keyboard-spanning palette
        this.player = null;  // NEW: Event-based player
        this.midiHandler = null;
        this.keyboardHandler = null;
        this.recorder = null;
        this.masterGain = null;
        
        this.isInitialized = false;
        this.isGridVisible = false;
        this.lastRecordingBlob = null;
        this.actionMode = 'motif';
        this.activeNotesBySlot = new Map();
        this.gridStartSlot = 48;
        this.nonMusicianGrid = new Map();
        this.lockedNonMusicianSlots = new Set();
        this.nonMusicianOctave = 3;
        
        // UI element references
        this.elements = {};
        
        // Bind methods
        this.init = this.init.bind(this);
        this.handlePadOn = this.handlePadOn.bind(this);
        this.handlePadOff = this.handlePadOff.bind(this);
        this.handleKnobChange = this.handleKnobChange.bind(this);
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // MIDI status
            midiStatus: document.getElementById('midiStatus'),
            
            // Engine controls
            engineBtns: document.querySelectorAll('.engine-btn'),
            randomizePatch: document.getElementById('randomizePatch'),
            polyphony: document.getElementById('polyphony'),
            polyphonyValue: document.getElementById('polyphonyValue'),
            
            // Harmony controls
            rootNote: document.getElementById('rootNote'),
            scaleMode: document.getElementById('scaleMode'),
            
            // Tempo
            tempo: document.getElementById('tempo'),
            tempoValue: document.getElementById('tempoValue'),

            // Actions
            actionModeBtns: document.querySelectorAll('.mode-btn'),
            actionModeHint: document.getElementById('actionModeHint'),
            nonMusicianOctaveRow: document.getElementById('nonMusicianOctaveRow'),
            nonMusicianOctave: document.getElementById('nonMusicianOctave'),
            regenerateGestures: document.getElementById('regenerateGestures'),
            evolveMotif: document.getElementById('evolveMotif'),
            toggleGrid: document.getElementById('toggleGrid'),
            
            // Knob display
            knobLabels: Array.from({ length: 8 }, (_, i) => document.getElementById(`knobLabel${i}`)),
            knobIndicators: document.querySelectorAll('.knob-indicator'),
            
            // Pad grid
            padGridContainer: document.getElementById('padGridContainer'),
            padGrid: document.getElementById('padGrid'),
            
            // Active gesture display
            activeGestureInfo: document.getElementById('activeGestureInfo'),
            
            // Delay controls
            delaySend: document.getElementById('delaySend'),
            delaySendValue: document.getElementById('delaySendValue'),
            zoneBtns: document.querySelectorAll('.zone-btn'),
            delayRate: document.getElementById('delayRate'),
            delayRateValue: document.getElementById('delayRateValue'),
            delayMicroRate: document.getElementById('delayMicroRate'),
            delayMicroRateValue: document.getElementById('delayMicroRateValue'),
            delayRepeats: document.getElementById('delayRepeats'),
            delayRepeatsValue: document.getElementById('delayRepeatsValue'),
            delayColor: document.getElementById('delayColor'),
            delayColorValue: document.getElementById('delayColorValue'),
            delayHalo: document.getElementById('delayHalo'),
            delayHaloValue: document.getElementById('delayHaloValue'),
            delayHold: document.getElementById('delayHold'),
            delayFlip: document.getElementById('delayFlip'),
            delayPingPong: document.getElementById('delayPingPong'),
            
            // Master
            masterVolume: document.getElementById('masterVolume'),
            masterVolumeValue: document.getElementById('masterVolumeValue'),
            
            // Recording
            recordBtn: document.getElementById('recordBtn'),
            recordTime: document.getElementById('recordTime'),
            downloadBtn: document.getElementById('downloadBtn')
        };
    }
    
    /**
     * Initialize audio context and all modules
     */
    async init() {
        if (this.isInitialized) return;
        
        console.log('[GestaltApp] Initializing with keyboard-spanning gesture system...');
        
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume if suspended (autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        console.log(`[GestaltApp] Audio context created: ${this.audioContext.sampleRate} Hz`);
        
        // Create master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.audioContext.destination);
        
        // Create delay effect
        this.delay = new MimeophonDelay(this.audioContext);
        this.delay.connect(this.masterGain);
        
        // Create polyphonic engine
        this.engine = new PolyphonicEngine(this.audioContext, 8);
        this.engine.connect(this.masterGain);
        this.engine.connectSend(this.delay.input);
        
        // Create keyboard-spanning gesture palette (NEW!)
        console.log('[GestaltApp] Creating keyboard gesture palette...');
        this.palette = new KeyboardGesturePalette({
            minSlot: 36,  // C2
            maxSlot: 96,  // C7
            root: this.elements.rootNote.value,
            scale: this.elements.scaleMode.value,
            tempo: parseInt(this.elements.tempo.value)
        });
        
        // Create event-based gesture player (NEW!)
        this.player = new EventGesturePlayer(this.engine, this.palette);
        
        // Print palette stats
        const stats = this.palette.getStats();
        console.log('[GestaltApp] Palette stats:', stats);
        
        // Create recorder
        this.recorder = new WAVRecorder(this.audioContext);
        this.recorder.connectSource(this.masterGain);
        
        // Initialize MIDI
        this.midiHandler = new MIDIHandler();
        this.midiHandler.onPadOn = this.handlePadOn;
        this.midiHandler.onPadOff = this.handlePadOff;
        this.midiHandler.onKnobChange = this.handleKnobChange;
        this.midiHandler.onConnectionChange = this.updateMIDIStatus.bind(this);
        await this.midiHandler.init();
        
        // Initialize keyboard fallback
        this.keyboardHandler = new KeyboardHandler();
        this.keyboardHandler.onPadOn = this.handlePadOn;
        this.keyboardHandler.onPadOff = this.handlePadOff;
        this.keyboardHandler.onKnobChange = this.handleKnobChange;
        this.keyboardHandler.enable();
        
        this.isInitialized = true;
        
        // Update UI
        console.log('[GestaltApp] Updating UI...');
        this.updateKnobLabels();
        this.buildPadGrid();
        
        console.log('[GestaltApp] Initialization complete!');
    }
    
    /**
     * Setup all UI event listeners
     */
    setupEventListeners() {
        // Click anywhere to init audio (browser autoplay policy)
        document.addEventListener('click', () => {
            if (!this.isInitialized) {
                this.init();
            }
        }, { once: false });
        
        // Engine selection
        this.elements.engineBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectEngine(btn.dataset.engine);
            });
        });
        
        // Randomize patch
        this.elements.randomizePatch.addEventListener('click', () => {
            if (this.engine) {
                this.engine.randomPatch();
            }
        });
        
        // Polyphony
        this.elements.polyphony.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.polyphonyValue.textContent = value;
            if (this.engine) {
                this.engine.setPolyphony(value);
            }
        });
        
        // Harmony changes
        this.elements.rootNote.addEventListener('change', () => this.updateHarmony());
        this.elements.scaleMode.addEventListener('change', () => this.updateHarmony());
        
        // Tempo
        this.elements.tempo.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.tempoValue.textContent = value;
            if (this.palette) {
                this.palette.setTempo(value);
            }
        });

        // Mode switching
        this.elements.actionModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setActionMode(btn.dataset.mode);
            });
        });

        // Non-musician octave selection
        if (this.elements.nonMusicianOctave) {
            this.elements.nonMusicianOctave.addEventListener('input', (e) => {
                const value = Math.min(7, Math.max(1, parseInt(e.target.value) || this.nonMusicianOctave));
                e.target.value = value;
                this.nonMusicianOctave = value;
                if (this.actionMode === 'nonMusician') {
                    this.generateNonMusicianGrid({ respectLocks: true });
                    this.buildPadGrid();
                }
            });
        }

        // Regenerate grid
        this.elements.regenerateGestures.addEventListener('click', () => {
            console.log('[GestaltApp] Regenerate button clicked');
            if (this.actionMode === 'nonMusician') {
                this.generateNonMusicianGrid({ respectLocks: true, reshuffle: true });
                this.buildPadGrid();
            } else if (this.palette) {
                // Randomize distribution and regenerate
                this.palette.randomizeDistribution();
                this.updateKnobLabels();
                this.buildPadGrid();
            }
        });

        // Evolve unlocked gestures using locked references
        this.elements.evolveMotif.addEventListener('click', () => {
            console.log('[GestaltApp] Evolve button clicked');
            if (this.actionMode === 'nonMusician') {
                this.generateNonMusicianGrid({ respectLocks: true, reshuffle: true, jitterVoicings: true });
                this.buildPadGrid();
            } else if (this.palette) {
                this.palette.evolveUnlockedSlots();
                this.updateKnobLabels();
                this.buildPadGrid();
            }
        });
        
        // Toggle grid visibility
        this.elements.toggleGrid.addEventListener('click', () => {
            this.toggleGridVisibility();
        });
        
        // Delay controls
        this.elements.delaySend.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.delaySendValue.textContent = `${value}%`;
            if (this.engine) {
                this.engine.setSendLevel(value / 100);
            }
        });
        
        this.elements.zoneBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectZone(parseInt(btn.dataset.zone));
            });
        });
        
        this.elements.delayRate.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.delayRateValue.textContent = `${value}%`;
            if (this.delay) {
                this.delay.setRate(value / 100);
            }
        });
        
        this.elements.delayMicroRate.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.delayMicroRateValue.textContent = `${value}%`;
            if (this.delay) {
                this.delay.setMicroRate((value - 50) / 50);
            }
        });
        
        this.elements.delayRepeats.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.delayRepeatsValue.textContent = `${value}%`;
            if (this.delay) {
                this.delay.setRepeats(value / 100);
            }
        });
        
        this.elements.delayColor.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (this.delay) {
                this.delay.setColor(value / 100);
                this.elements.delayColorValue.textContent = this.delay.getColorName();
            }
        });
        
        this.elements.delayHalo.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.delayHaloValue.textContent = `${value}%`;
            if (this.delay) {
                this.delay.setHalo(value / 100);
            }
        });
        
        this.elements.delayHold.addEventListener('click', () => {
            this.elements.delayHold.classList.toggle('active');
            if (this.delay) {
                this.delay.setHold(this.elements.delayHold.classList.contains('active'));
            }
        });
        
        this.elements.delayFlip.addEventListener('click', () => {
            this.elements.delayFlip.classList.toggle('active');
            if (this.delay) {
                this.delay.setFlip(this.elements.delayFlip.classList.contains('active'));
            }
        });
        
        this.elements.delayPingPong.addEventListener('click', () => {
            this.elements.delayPingPong.classList.toggle('active');
            if (this.delay) {
                this.delay.setPingPong(this.elements.delayPingPong.classList.contains('active'));
            }
        });
        
        // Master volume
        this.elements.masterVolume.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.masterVolumeValue.textContent = `${value}%`;
            if (this.masterGain) {
                this.masterGain.gain.setTargetAtTime(value / 100, this.audioContext.currentTime, 0.02);
            }
        });
        
        // Recording
        this.elements.recordBtn.addEventListener('click', () => {
            this.toggleRecording();
        });
        
        this.elements.downloadBtn.addEventListener('click', () => {
            if (this.lastRecordingBlob) {
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
                WAVRecorder.downloadBlob(this.lastRecordingBlob, `colors-${timestamp}.wav`);
            }
        });
    }

    /**
     * Toggle action mode between motif (gestures), musician (quantized notes), and non-musician (chord atlas)
     */
    setActionMode(mode) {
        if (!['motif', 'musician', 'nonMusician'].includes(mode) || mode === this.actionMode) return;

        this.actionMode = mode;

        this.elements.actionModeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.engine?.allNotesOff();
        this.activeNotesBySlot.clear();

        if (mode === 'musician') {
            this.elements.actionModeHint.textContent = 'Generate a patch and play the keyboard quantized to the selected scale.';
        } else if (mode === 'nonMusician') {
            this.elements.actionModeHint.textContent = 'Explore chords, dyads, and voicings from the selected key and mode.';
            this.generateNonMusicianGrid({ respectLocks: true });
        } else {
            this.elements.actionModeHint.textContent = 'Generate and evolve gestural motifs on the grid.';
        }

        this.elements.nonMusicianOctaveRow?.classList.toggle('hidden', mode !== 'nonMusician');

        this.buildPadGrid();
        this.updateActiveGestureDisplay(null);
    }
    
    /**
     * Select synth engine
     */
    selectEngine(engineType) {
        if (!this.engine) return;
        
        console.log(`[GestaltApp] Selecting engine: ${engineType}`);
        
        // Update UI
        this.elements.engineBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.engine === engineType);
        });
        
        // Update engine
        this.engine.setEngineType(engineType);
        
        // Randomize new patch
        this.engine.randomPatch();
    }
    
    /**
     * Select delay zone
     */
    selectZone(zoneIndex) {
        if (!this.delay) return;
        
        this.elements.zoneBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.zone) === zoneIndex);
        });
        
        this.delay.setZone(zoneIndex);
    }
    
    /**
     * Update harmony (root/scale)
     */
    updateHarmony() {
        if (!this.palette) return;

        if (this.actionMode === 'nonMusician' && this.nonMusicianGrid.size === 0) {
            this.generateNonMusicianGrid();
        }

        const root = this.elements.rootNote.value;
        const scale = this.elements.scaleMode.value;
        
        console.log(`[GestaltApp] Updating harmony: ${root} ${scale}`);

        this.palette.setHarmony(root, scale);
        this.generateNonMusicianGrid({ respectLocks: true });
        this.buildPadGrid();
    }

    /**
     * Normalize an incoming pad or MIDI note to the active grid slot
     */
    normalizeSlotId(slotId) {
        const midiOffset = this.midiHandler?.padNoteOffset ?? 33;
        const padCount = this.midiHandler?.padCount ?? 32;

        // If we received a MIDI note in the pad range, map it to our grid window
        if (slotId >= midiOffset && slotId < midiOffset + padCount) {
            return this.gridStartSlot + (slotId - midiOffset);
        }

        // If we received a raw pad index (from keyboard handler), map directly
        if (slotId >= 0 && slotId < padCount) {
            return this.gridStartSlot + slotId;
        }

        return slotId;
    }

    /**
     * Build a scale note list that spans the full pad grid without repeating pitches
     */
    getMusicianScaleNotes() {
        const root = this.elements.rootNote.value;
        const scale = this.elements.scaleMode.value;
        const padCount = this.midiHandler?.padCount ?? 32;

        const scaleLength = (SCALES[scale] || SCALES.major).length;
        const startOctave = Math.floor(this.gridStartSlot / 12) - 1;
        const extraOctaves = Math.ceil((padCount + 1) / scaleLength) + 2;

        const octaveLow = Math.max(-1, startOctave - 2);
        const octaveHigh = Math.min(10, octaveLow + extraOctaves);

        return getScaleNotes(root, scale, octaveLow, octaveHigh, 0, 127);
    }

    /**
     * Quantize an incoming slot/pad note to the current scale without duplicate pitches
     */
    quantizeSlot(slotId) {
        const scaleNotes = this.getMusicianScaleNotes();
        if (!scaleNotes.length) return slotId;

        const padOffset = slotId - this.gridStartSlot;

        const nearestIndex = scaleNotes.reduce((closestIdx, note, idx) => {
            const currentDistance = Math.abs(note - this.gridStartSlot);
            const bestDistance = Math.abs(scaleNotes[closestIdx] - this.gridStartSlot);
            return currentDistance < bestDistance ? idx : closestIdx;
        }, 0);

        const targetIndex = nearestIndex + padOffset;

        if (targetIndex < 0) {
            return scaleNotes[0];
        }

        if (targetIndex >= scaleNotes.length) {
            return scaleNotes[scaleNotes.length - 1];
        }

        return scaleNotes[targetIndex];
    }

    /**
     * Get a label for the current scale (e.g. "C Major")
     */
    getScaleLabel() {
        const root = this.elements.rootNote.value;
        const scaleOption = this.elements.scaleMode.options[this.elements.scaleMode.selectedIndex];
        return `${root} ${scaleOption?.textContent || this.elements.scaleMode.value}`;
    }

    /**
     * Convert MIDI note number to note name + octave
     */
    getNoteName(midiNote) {
        const noteName = NOTE_NAMES[midiNote % 12] || '?';
        const octave = Math.floor(midiNote / 12) - 1;
        return `${noteName}${octave}`;
    }

    /**
     * Format a chord label using the chord type symbol
     */
    getChordLabel(rootMidi, chordType) {
        const symbol = CHORD_TYPES[chordType]?.symbol || '';
        const rootName = NOTE_NAMES[rootMidi % 12] || '?';
        return `${rootName}${symbol}`;
    }

    /**
     * Build a pool of chord and interval options for non-musician mode
     */
    buildNonMusicianChordPool() {
        const root = this.elements.rootNote.value;
        const scale = this.elements.scaleMode.value;
        const diatonicChords = getDiatonicChords(root, scale, 3);

        const pool = [];
        const voicingNames = ['Closed', '1st Inv', '2nd Inv', 'Drop', 'Open', 'Double'];

        const addChordVariant = (rootMidi, chordType, tag = '') => {
            const baseNotes = buildChord(rootMidi, chordType);
            const voicings = generateVoicings({ notes: baseNotes, type: chordType }, 6);
            const label = this.getChordLabel(rootMidi, chordType);

            voicings.forEach((notes, i) => {
                pool.push({
                    type: 'chord',
                    label,
                    chordType,
                    description: `${tag || CHORD_TYPES[chordType]?.symbol || chordType}${voicingNames[i] ? ` • ${voicingNames[i]}` : ''}`.trim(),
                    notes
                });
            });
        };

        const addDyads = (rootMidi) => {
            const intervals = [3, 4, 7, 10, 14];
            const intervalNames = { 3: 'm3', 4: 'M3', 7: '5th', 10: 'm7', 14: '9th' };

            intervals.forEach(interval => {
                const upper = rootMidi + interval;
                const rootName = NOTE_NAMES[rootMidi % 12] || '?';
                const upperName = NOTE_NAMES[upper % 12] || '?';
                pool.push({
                    type: 'chord',
                    label: `${rootName}-${upperName}`,
                    chordType: 'dyad',
                    description: `Dyad • ${intervalNames[interval] || `${interval}st`}`,
                    notes: [rootMidi, upper]
                });
            });
        };

        diatonicChords.forEach(chord => {
            const rootMidi = chord.notes[0];

            // Core triad
            addChordVariant(rootMidi, chord.type, 'Triad');

            // Extensions and colors
            if (chord.type === 'major') {
                addChordVariant(rootMidi, 'maj7', '7th');
                addChordVariant(rootMidi, 'dom7', 'Dominant');
                addChordVariant(rootMidi, 'add9', 'Add9');
                addChordVariant(rootMidi, 'maj9', '9th');
                addChordVariant(rootMidi, 'sus2', 'Suspended');
                addChordVariant(rootMidi, 'sus4', 'Suspended');
                addChordVariant(rootMidi, 'power', 'Power');
            } else if (chord.type === 'minor') {
                addChordVariant(rootMidi, 'minor', 'Triad');
                addChordVariant(rootMidi, 'min7', '7th');
                addChordVariant(rootMidi, 'madd9', 'Add9');
                addChordVariant(rootMidi, 'min9', '9th');
                addChordVariant(rootMidi, 'sus2', 'Suspended');
                addChordVariant(rootMidi, 'sus4', 'Suspended');
                addChordVariant(rootMidi, 'power', 'Power');
            } else if (chord.type === 'dim') {
                addChordVariant(rootMidi, 'dim', 'Triad');
                addChordVariant(rootMidi, 'dim7', 'Fully Dim');
                addChordVariant(rootMidi, 'min7b5', 'Half Dim');
                addChordVariant(rootMidi, 'power', 'Power');
            } else {
                addChordVariant(rootMidi, chord.type, 'Triad');
            }

            addDyads(rootMidi);
        });

        return pool;
    }

    /**
     * Build a bottom-row set of scale tones for non-musician mode
     */
    buildNonMusicianNoteRow() {
        const root = this.elements.rootNote.value;
        const scale = this.elements.scaleMode.value;
        const scaleNotes = getScaleNotes(root, scale, this.nonMusicianOctave, this.nonMusicianOctave, 12, 120);

        const row = [];
        const fallbackNotes = scaleNotes.length ? scaleNotes : [60, 64, 67, 69, 72, 76, 79, 84];
        for (let i = 0; i < 8; i++) {
            row.push(fallbackNotes[i % fallbackNotes.length]);
        }

        return row;
    }

    /**
     * Shuffle helper
     */
    shuffleArray(items) {
        const array = [...items];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate or refresh the non-musician grid contents
     */
    generateNonMusicianGrid({ respectLocks = false, reshuffle = false } = {}) {
        const startSlot = this.gridStartSlot;
        const previousGrid = new Map(this.nonMusicianGrid);

        if (!respectLocks) {
            this.lockedNonMusicianSlots.clear();
        }

        const noteRow = this.buildNonMusicianNoteRow();
        const chordPool = reshuffle
            ? this.shuffleArray(this.buildNonMusicianChordPool())
            : this.buildNonMusicianChordPool();

        if (!chordPool.length) return;

        const newGrid = new Map();

        // Bottom row: scale tones with octave selection
        for (let col = 0; col < 8; col++) {
            const slotId = startSlot + col;
            const note = noteRow[col % noteRow.length];
            newGrid.set(slotId, {
                slotId,
                type: 'note',
                label: this.getNoteName(note),
                description: `Scale note • ${this.getScaleLabel()} @${this.nonMusicianOctave}`,
                notes: [note]
            });
        }

        // Top 3 rows: chords, dyads, and voicings
        const shuffled = this.shuffleArray(chordPool);
        let poolIndex = 0;

        for (let padIndex = 8; padIndex < 32; padIndex++) {
            const slotId = startSlot + padIndex;

            if (respectLocks && this.lockedNonMusicianSlots.has(slotId) && previousGrid.has(slotId)) {
                newGrid.set(slotId, previousGrid.get(slotId));
                continue;
            }

            if (poolIndex >= shuffled.length) {
                poolIndex = 0;
            }

            const entry = { ...shuffled[poolIndex], slotId };
            newGrid.set(slotId, entry);
            poolIndex++;
        }

        this.nonMusicianGrid = newGrid;
    }

    /**
     * Accessors for non-musician mode state
     */
    getNonMusicianEntry(slotId) {
        if (this.nonMusicianGrid.size === 0) {
            this.generateNonMusicianGrid();
        }
        return this.nonMusicianGrid.get(slotId);
    }

    isNonMusicianSlotLocked(slotId) {
        return this.lockedNonMusicianSlots.has(slotId);
    }

    toggleNonMusicianLock(slotId) {
        if (this.lockedNonMusicianSlots.has(slotId)) {
            this.lockedNonMusicianSlots.delete(slotId);
            return false;
        }

        this.lockedNonMusicianSlots.add(slotId);
        return true;
    }

    /**
     * Update the active display for musician mode
     */
    updateMusicianDisplay(midiNote) {
        const noteName = this.getNoteName(midiNote);
        const scaleLabel = this.getScaleLabel();

        this.elements.activeGestureInfo.innerHTML = `
            <span class="gesture-type">NOTE</span>
            <span class="gesture-notes">${noteName} • Quantized to ${scaleLabel}</span>
        `;
    }

    /**
     * Update the active display for non-musician mode
     */
    updateNonMusicianDisplay(entry) {
        if (!entry) {
            this.updateActiveGestureDisplay(null);
            return;
        }

        const type = entry.type === 'chord' ? 'CHORD' : 'NOTE';
        const detail = entry.description || `${entry.notes?.length || 0}-note voicing`;

        this.elements.activeGestureInfo.innerHTML = `
            <span class="gesture-type">${type}</span>
            <span class="gesture-notes">${entry.label} • ${detail}</span>
        `;
    }
    
    /**
     * Toggle grid visibility
     */
    toggleGridVisibility() {
        this.isGridVisible = !this.isGridVisible;
        
        this.elements.padGridContainer.classList.toggle('hidden', !this.isGridVisible);
        this.elements.toggleGrid.innerHTML = this.isGridVisible 
            ? '<span class="btn-icon">▦</span> HIDE GRID'
            : '<span class="btn-icon">▦</span> SHOW GRID';
    }
    
    /**
     * Build the visual pad grid (showing 32-pad window into keyboard)
     */
    buildPadGrid() {
        if (!this.palette) return;

        if (this.actionMode === 'nonMusician' && this.nonMusicianGrid.size === 0) {
            this.generateNonMusicianGrid();
        }

        console.log('[GestaltApp] Building pad grid...');
        
        this.elements.padGrid.innerHTML = '';

        // Show 32 pads starting from slot 48 (C3)
        const startSlot = this.gridStartSlot;
        
        // Create 32 pads (4 rows x 8 columns)
        for (let row = 3; row >= 0; row--) {
            for (let col = 0; col < 8; col++) {
                const padIndex = row * 8 + col;
                const slotId = startSlot + padIndex;
                const gesture = this.palette.getGesture(slotId);
                const config = this.palette.getSlotConfig(slotId);
                const nonMusicianEntry = this.actionMode === 'nonMusician'
                    ? this.getNonMusicianEntry(slotId)
                    : null;
                const isLocked = this.actionMode === 'nonMusician'
                    ? (nonMusicianEntry?.type === 'chord' && this.isNonMusicianSlotLocked(slotId))
                    : this.palette.isSlotLocked(slotId);

                const pad = document.createElement('div');
                pad.className = 'pad';
                pad.dataset.index = padIndex;
                pad.dataset.slot = slotId;

                pad.classList.toggle('locked', Boolean(isLocked));

                const padHeader = document.createElement('div');
                padHeader.className = 'pad-header';

                const typeLabel = document.createElement('span');
                typeLabel.className = 'pad-type';
                if (this.actionMode === 'musician') {
                    const quantizedNote = this.quantizeSlot(slotId);
                    typeLabel.textContent = this.getNoteName(quantizedNote);
                } else if (this.actionMode === 'nonMusician') {
                    typeLabel.textContent = nonMusicianEntry?.label || '—';
                } else {
                    typeLabel.textContent = gesture && config ? gesture.typeId : 'EMPTY';
                }

                const lockBtn = document.createElement('button');
                lockBtn.className = 'pad-lock-btn';
                lockBtn.type = 'button';
                const lockable = this.actionMode === 'nonMusician'
                    ? nonMusicianEntry?.type === 'chord'
                    : true;

                lockBtn.disabled = !lockable;
                lockBtn.classList.toggle('disabled', !lockable);
                lockBtn.textContent = isLocked ? '🔒' : '🔓';
                lockBtn.title = this.actionMode === 'nonMusician'
                    ? (lockable ? (isLocked ? 'Unlock chord' : 'Lock chord') : 'Locking disabled for scale notes')
                    : (isLocked ? 'Unlock motif' : 'Lock motif');

                lockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    if (this.actionMode === 'nonMusician') {
                        if (!lockable) return;
                        const nowLocked = this.toggleNonMusicianLock(slotId);
                        pad.classList.toggle('locked', nowLocked);
                        lockBtn.textContent = nowLocked ? '🔒' : '🔓';
                        lockBtn.title = nowLocked ? 'Unlock chord' : 'Lock chord';
                        return;
                    }

                    const nowLocked = this.palette.toggleSlotLock(slotId);
                    pad.classList.toggle('locked', nowLocked);
                    lockBtn.textContent = nowLocked ? '🔒' : '🔓';
                    lockBtn.title = nowLocked ? 'Unlock motif' : 'Lock motif';
                });

                padHeader.appendChild(typeLabel);
                padHeader.appendChild(lockBtn);

                const chordLabel = document.createElement('span');
                chordLabel.className = 'pad-chord';
                if (this.actionMode === 'musician') {
                    const quantizedNote = this.quantizeSlot(slotId);
                    chordLabel.textContent = `Quantized • ${this.getScaleLabel()}`;
                } else if (this.actionMode === 'nonMusician') {
                    chordLabel.textContent = nonMusicianEntry?.description || '—';
                } else {
                    chordLabel.textContent = gesture && config ? (gesture.display || '—') : '—';
                }

                pad.appendChild(padHeader);
                pad.appendChild(chordLabel);
                
                // Mouse/touch events
                pad.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.handlePadOn(slotId, 1);
                });
                
                pad.addEventListener('mouseup', () => {
                    this.handlePadOff(slotId);
                });
                
                pad.addEventListener('mouseleave', () => {
                    if (pad.classList.contains('active')) {
                        this.handlePadOff(slotId);
                    }
                });
                
                pad.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.handlePadOn(slotId, 1);
                });
                
                pad.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.handlePadOff(slotId);
                });
                
                this.elements.padGrid.appendChild(pad);
            }
        }
        
        console.log('[GestaltApp] Pad grid built');
    }
    
    /**
     * Handle pad on (press) - now handles MIDI note directly as slot
     */
    handlePadOn(slotId, velocity) {
        console.log(`[GestaltApp] handlePadOn(slot ${slotId}, ${velocity})`);

        const resolvedSlot = this.normalizeSlotId(slotId);

        if (!this.isInitialized) {
            console.log('[GestaltApp] Not initialized, initializing first...');
            this.init().then(() => this.handlePadOn(resolvedSlot, velocity));
            return;
        }

        if (this.actionMode === 'musician') {
            if (!this.engine) return;

            const quantizedNote = this.quantizeSlot(resolvedSlot);
            this.activeNotesBySlot.set(resolvedSlot, quantizedNote);
            this.engine.noteOn(quantizedNote, velocity || 1);

            this.updateActivePad(resolvedSlot, true);
            this.updateMusicianDisplay(quantizedNote);
            return;
        }

        if (this.actionMode === 'nonMusician') {
            if (!this.engine) return;

            const entry = this.getNonMusicianEntry(resolvedSlot);
            if (!entry?.notes?.length) return;

            const notes = Array.isArray(entry.notes) ? entry.notes : [entry.notes];
            notes.forEach(note => this.engine.noteOn(note, velocity || 1));

            this.activeNotesBySlot.set(resolvedSlot, notes);
            this.updateActivePad(resolvedSlot, true);
            this.updateNonMusicianDisplay(entry);
            return;
        }

        if (!this.player) {
            console.error('[GestaltApp] No player!');
            return;
        }
        
        // Trigger gesture for slot as a one-shot (no looping)
        const result = this.player.triggerSlot(resolvedSlot, velocity, { forceOneShot: true });

        if (!result?.gesture) {
            console.error(`[GestaltApp] No gesture returned for slot ${resolvedSlot}`);
            return;
        }

        // Update UI
        this.updateActivePad(resolvedSlot, true);
        this.updateActiveGestureDisplay(result.gesture, result.isLooping);
        
        // Flash MIDI indicator
        if (this.midiHandler?.hasRecentActivity(200)) {
            this.elements.midiStatus.classList.add('active');
            setTimeout(() => {
                this.elements.midiStatus.classList.remove('active');
            }, 100);
        }
    }
    
    /**
     * Handle pad off (release)
     */
    handlePadOff(slotId) {
        const resolvedSlot = this.normalizeSlotId(slotId);

        if (this.actionMode === 'musician') {
            const note = this.activeNotesBySlot.get(resolvedSlot);
            if (note !== undefined && this.engine) {
                this.engine.noteOff(note);
            }

            this.activeNotesBySlot.delete(resolvedSlot);
            this.updateActivePad(resolvedSlot, false);

            if (this.activeNotesBySlot.size === 0) {
                this.updateActiveGestureDisplay(null);
            }
            return;
        }

        if (this.actionMode === 'nonMusician') {
            const notes = this.activeNotesBySlot.get(resolvedSlot);
            if (Array.isArray(notes) && this.engine) {
                notes.forEach(note => this.engine.noteOff(note));
            }

            this.activeNotesBySlot.delete(resolvedSlot);
            this.updateActivePad(resolvedSlot, false);

            if (this.activeNotesBySlot.size === 0) {
                this.updateActiveGestureDisplay(null);
            }
            return;
        }

        if (!this.player) return;

        this.player.releaseSlot(resolvedSlot);
        this.updateActivePad(resolvedSlot, false);

        // Clear gesture display if no pads active
        if (this.player.getActiveGestureCount() === 0) {
            this.updateActiveGestureDisplay(null);
        }
    }
    
    /**
     * Handle knob change (for future: could adjust palette parameters)
     */
    handleKnobChange(knobIndex, delta, accumulator) {
        console.log(`[GestaltApp] Knob ${knobIndex}: delta=${delta}`);
        
        // For now, just highlight the knob
        this.highlightKnob(knobIndex);
        
        // Could implement: adjust density, complexity, tension for a region
    }
    
    /**
     * Update knob labels (show style distribution info)
     */
    updateKnobLabels() {
        if (!this.palette) return;
        
        const stats = this.palette.getStats();
        const styles = Object.keys(stats.styleDistribution).slice(0, 8);
        
        for (let i = 0; i < 8; i++) {
            if (this.elements.knobLabels[i] && styles[i]) {
                const styleName = styles[i].substring(0, 6).toUpperCase();
                this.elements.knobLabels[i].textContent = styleName;
            }
        }
    }
    
    /**
     * Highlight a knob indicator
     */
    highlightKnob(knobIndex) {
        this.elements.knobIndicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === knobIndex);
        });
        
        setTimeout(() => {
            this.elements.knobIndicators[knobIndex]?.classList.remove('active');
        }, 300);
    }
    
    /**
     * Update active pad visual state
     */
    updateActivePad(slotId, active) {
        const pads = this.elements.padGrid.querySelectorAll('.pad');
        
        pads.forEach(pad => {
            if (parseInt(pad.dataset.slot) === slotId) {
                pad.classList.toggle('active', active);
            }
        });
    }
    
    /**
     * Update active gesture display
     */
    updateActiveGestureDisplay(gesture, isLoopingOverride = null) {
        if (!gesture) {
            this.elements.activeGestureInfo.innerHTML = `
                <span class="gesture-type">—</span>
                <span class="gesture-notes">Ready</span>
            `;
            return;
        }

        const eventCount = gesture.events.length;
        const shouldLoop = isLoopingOverride === null
            ? Boolean(gesture.loopLengthBeats)
            : isLoopingOverride;
        const loopStatus = shouldLoop ? `${gesture.loopLengthBeats}bar loop` : 'one-shot';

        this.elements.activeGestureInfo.innerHTML = `
            <span class="gesture-type">${gesture.typeId}</span>
            <span class="gesture-notes">${gesture.display} • ${eventCount} events • ${loopStatus}</span>
        `;
    }
    
    /**
     * Update MIDI connection status
     */
    updateMIDIStatus(connected, devices) {
        this.elements.midiStatus.classList.toggle('connected', connected);
        
        const text = connected 
            ? `MIDI: ${devices[0]?.name || 'Connected'}`
            : 'MIDI: waiting...';
        
        this.elements.midiStatus.querySelector('.midi-text').textContent = text;
    }
    
    /**
     * Toggle recording
     */
    toggleRecording() {
        if (!this.recorder) return;
        
        if (this.recorder.isRecording) {
            // Stop recording
            this.lastRecordingBlob = this.recorder.stop();
            
            this.elements.recordBtn.classList.remove('recording');
            this.elements.recordBtn.querySelector('.record-text').textContent = 'REC';
            this.elements.downloadBtn.classList.remove('hidden');
        } else {
            // Start recording
            this.recorder.start();
            
            this.elements.recordBtn.classList.add('recording');
            this.elements.recordBtn.querySelector('.record-text').textContent = 'STOP';
            this.elements.downloadBtn.classList.add('hidden');
            
            // Update time display
            this.recorder.onTimeUpdate = (time) => {
                this.elements.recordTime.textContent = WAVRecorder.formatTime(time);
            };
        }
    }
}

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[COLORS] DOM ready, creating app with keyboard gesture system...');
    
    const app = new GestaltApp();
    app.cacheElements();
    app.setupEventListeners();
    
    // Initialize on first interaction
    const initOnInteraction = () => {
        console.log('[COLORS] First interaction, initializing...');
        app.init();
        document.removeEventListener('click', initOnInteraction);
        document.removeEventListener('keydown', initOnInteraction);
        document.removeEventListener('touchstart', initOnInteraction);
    };
    
    document.addEventListener('click', initOnInteraction);
    document.addEventListener('keydown', initOnInteraction);
    document.addEventListener('touchstart', initOnInteraction);
});

// GESTALT — Main Application Controller
// Ties together all modules and handles UI

import { PolyphonicEngine } from './polyphonic-engine.js';
import { GestureGrid, GesturePlayer, GESTURE_TYPES } from './gesture-system.js';
import { MimeophonDelay } from './mimeophon-delay.js';
import { MIDIHandler, KeyboardHandler } from './midi-handler.js';
import { WAVRecorder } from './recorder.js';

class GestaltApp {
    constructor() {
        this.audioContext = null;
        this.engine = null;
        this.delay = null;
        this.grid = null;
        this.player = null;
        this.midiHandler = null;
        this.keyboardHandler = null;
        this.recorder = null;
        this.masterGain = null;
        
        this.isInitialized = false;
        this.isGridVisible = false;
        this.lastRecordingBlob = null;
        
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
            
            // Tempo & Strum
            tempo: document.getElementById('tempo'),
            tempoValue: document.getElementById('tempoValue'),
            strumSpeed: document.getElementById('strumSpeed'),
            strumSpeedValue: document.getElementById('strumSpeedValue'),
            strumVariance: document.getElementById('strumVariance'),
            strumVarianceValue: document.getElementById('strumVarianceValue'),
            
            // Actions
            regenerateGestures: document.getElementById('regenerateGestures'),
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
        
        console.log('[GestaltApp] Initializing...');
        
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
        
        // Create gesture system
        this.grid = new GestureGrid();
        this.player = new GesturePlayer(this.engine);
        this.player.setGrid(this.grid);
        
        // Generate initial grid
        console.log('[GestaltApp] Generating initial grid...');
        this.grid.regenerate();
        
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
            if (this.grid) {
                this.grid.setTempo(value);
            }
        });
        
        // Strum parameters
        this.elements.strumSpeed.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.strumSpeedValue.textContent = `${value}ms`;
            if (this.grid) {
                this.grid.strumSpeed = value;
            }
        });
        
        this.elements.strumVariance.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.elements.strumVarianceValue.textContent = `${value}%`;
            if (this.grid) {
                this.grid.strumVariance = value / 100;
            }
        });
        
        // Regenerate grid
        this.elements.regenerateGestures.addEventListener('click', () => {
            console.log('[GestaltApp] Regenerate button clicked');
            if (this.grid) {
                // Randomize column types for variety
                this.grid.randomizeColumnTypes();
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
                WAVRecorder.downloadBlob(this.lastRecordingBlob, `gestalt-${timestamp}.wav`);
            }
        });
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
        if (!this.grid) return;
        
        const root = this.elements.rootNote.value;
        const scale = this.elements.scaleMode.value;
        
        console.log(`[GestaltApp] Updating harmony: ${root} ${scale}`);
        
        this.grid.setHarmony(root, scale);
        this.buildPadGrid();
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
     * Build the visual pad grid
     */
    buildPadGrid() {
        if (!this.grid) return;
        
        console.log('[GestaltApp] Building pad grid...');
        
        this.elements.padGrid.innerHTML = '';
        
        // Create 32 pads (4 rows x 8 columns)
        // Note: Row 0 is bottom, Row 3 is top (for Move layout)
        for (let row = 3; row >= 0; row--) {
            for (let col = 0; col < 8; col++) {
                const padIndex = row * 8 + col;
                const gesture = this.grid.getPad(padIndex);
                
                const pad = document.createElement('div');
                pad.className = 'pad';
                pad.dataset.index = padIndex;
                
                if (gesture) {
                    pad.innerHTML = `
                        <span class="pad-type">${gesture.typeName}</span>
                        <span class="pad-chord">${gesture.display || ''}</span>
                    `;
                } else {
                    pad.innerHTML = `
                        <span class="pad-type">EMPTY</span>
                        <span class="pad-chord">—</span>
                    `;
                }
                
                // Mouse/touch events for grid interaction
                pad.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    console.log(`[UI] Pad ${padIndex} mousedown`);
                    this.handlePadOn(padIndex, 1);
                });
                
                pad.addEventListener('mouseup', () => {
                    console.log(`[UI] Pad ${padIndex} mouseup`);
                    this.handlePadOff(padIndex);
                });
                
                pad.addEventListener('mouseleave', () => {
                    if (pad.classList.contains('active')) {
                        this.handlePadOff(padIndex);
                    }
                });
                
                // Touch support
                pad.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    console.log(`[UI] Pad ${padIndex} touchstart`);
                    this.handlePadOn(padIndex, 1);
                });
                
                pad.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.handlePadOff(padIndex);
                });
                
                this.elements.padGrid.appendChild(pad);
            }
        }
        
        console.log('[GestaltApp] Pad grid built');
    }
    
    /**
     * Handle pad on (press)
     */
    handlePadOn(padIndex, velocity) {
        console.log(`[GestaltApp] handlePadOn(${padIndex}, ${velocity})`);
        
        if (!this.isInitialized) {
            console.log('[GestaltApp] Not initialized, initializing first...');
            this.init().then(() => this.handlePadOn(padIndex, velocity));
            return;
        }
        
        if (!this.player) {
            console.error('[GestaltApp] No player!');
            return;
        }
        
        // Trigger gesture
        const gesture = this.player.triggerPad(padIndex, velocity);
        
        if (!gesture) {
            console.error(`[GestaltApp] No gesture returned for pad ${padIndex}`);
            return;
        }
        
        // Update UI
        this.updateActivePad(padIndex, true);
        this.updateActiveGestureDisplay(gesture);
        
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
    handlePadOff(padIndex) {
        if (!this.player) return;
        
        this.player.releasePad(padIndex);
        this.updateActivePad(padIndex, false);
        
        // Clear gesture display if no pads active
        if (this.player.activeGestures.size === 0) {
            this.updateActiveGestureDisplay(null);
        }
    }
    
    /**
     * Handle knob change (continuous encoder)
     */
    handleKnobChange(knobIndex, delta, accumulator) {
        if (!this.grid) return;
        
        // Get current type for this column
        const currentType = this.grid.columnTypes[knobIndex];
        
        // Calculate new type based on delta direction
        let newType;
        if (delta > 0) {
            newType = (currentType + 1) % GESTURE_TYPES.length;
        } else {
            newType = (currentType - 1 + GESTURE_TYPES.length) % GESTURE_TYPES.length;
        }
        
        console.log(`[GestaltApp] Knob ${knobIndex}: ${GESTURE_TYPES[currentType].name} -> ${GESTURE_TYPES[newType].name}`);
        
        // Update column type
        this.grid.setColumnType(knobIndex, newType);
        
        // Update UI
        this.updateKnobLabels();
        this.buildPadGrid();
        
        // Highlight active knob
        this.highlightKnob(knobIndex);
    }
    
    /**
     * Update knob labels
     */
    updateKnobLabels() {
        if (!this.grid) return;
        
        console.log('[GestaltApp] Updating knob labels...');
        
        for (let i = 0; i < 8; i++) {
            const typeName = this.grid.getColumnTypeName(i);
            if (this.elements.knobLabels[i]) {
                this.elements.knobLabels[i].textContent = typeName;
            }
            console.log(`[GestaltApp] Column ${i}: ${typeName}`);
        }
    }
    
    /**
     * Highlight a knob indicator
     */
    highlightKnob(knobIndex) {
        this.elements.knobIndicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === knobIndex);
        });
        
        // Remove highlight after delay
        setTimeout(() => {
            this.elements.knobIndicators[knobIndex]?.classList.remove('active');
        }, 300);
    }
    
    /**
     * Update active pad visual state
     */
    updateActivePad(padIndex, active) {
        const pads = this.elements.padGrid.querySelectorAll('.pad');
        
        // Find the correct pad (accounting for reversed row order in display)
        const row = Math.floor(padIndex / 8);
        const col = padIndex % 8;
        const displayIndex = (3 - row) * 8 + col;
        
        if (pads[displayIndex]) {
            pads[displayIndex].classList.toggle('active', active);
        }
    }
    
    /**
     * Update active gesture display
     */
    updateActiveGestureDisplay(gesture) {
        if (!gesture) {
            this.elements.activeGestureInfo.innerHTML = `
                <span class="gesture-type">—</span>
                <span class="gesture-notes">Ready</span>
            `;
            return;
        }
        
        this.elements.activeGestureInfo.innerHTML = `
            <span class="gesture-type">${gesture.typeName}</span>
            <span class="gesture-notes">${gesture.display}</span>
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
    console.log('[GESTALT] DOM ready, creating app...');
    
    const app = new GestaltApp();
    app.cacheElements();
    app.setupEventListeners();
    
    // Initialize on first interaction (for autoplay policy)
    const initOnInteraction = () => {
        console.log('[GESTALT] First interaction, initializing...');
        app.init();
        document.removeEventListener('click', initOnInteraction);
        document.removeEventListener('keydown', initOnInteraction);
        document.removeEventListener('touchstart', initOnInteraction);
    };
    
    document.addEventListener('click', initOnInteraction);
    document.addEventListener('keydown', initOnInteraction);
    document.addEventListener('touchstart', initOnInteraction);
});

// EXAMPLE STYLE TEMPLATE
// Copy this file and modify to create your own gesture generator

import { StyleGenerator } from '../style-generator.js';
import { Gesture, GestureEvent, SeededRandom } from '../gesture-core.js';

/**
 * Example: Ambient Texture Generator
 * Inspired by Brian Eno / Harold Budd
 * 
 * Characteristics:
 * - Very long, overlapping notes
 * - Sparse events
 * - Drifting register
 * - Pedal tones and drones
 */
export class AmbientTextureGenerator extends StyleGenerator {
    constructor() {
        super('ambientTexture', 'Ambient Texture');
    }
    
    /**
     * Main generation method
     * @param {SlotConfig} slotConfig - Configuration for this slot
     * @param {HarmonicContext} harmonicContext - Current harmony (root, scale, chords)
     * @param {PerformanceContext} performanceContext - Global state (tempo, intensity)
     * @returns {Gesture} Generated gesture
     */
    generate(slotConfig, harmonicContext, performanceContext) {
        // Create seeded random number generator for consistent results
        const rng = new SeededRandom(slotConfig.seed);
        const events = [];
        
        // 1. Determine register based on slot position and registerShift
        const baseOctave = 4 + slotConfig.registerShift;
        const registerCenter = 60 + (baseOctave - 4) * 12;
        
        // 2. Get scale notes in our register (helper from base class)
        const scaleNotes = this.getScaleNotesInRegister(
            harmonicContext,
            registerCenter,
            2  // Range in octaves
        );
        
        if (scaleNotes.length === 0) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // 3. Use density to determine how many events
        // Low density = very sparse (1-2 notes)
        // High density = less sparse (3-5 notes)
        const eventCount = Math.floor(1 + slotConfig.density * 4);
        
        // 4. Use complexity to determine register drift
        // Low = stay in center
        // High = drift across full range
        const driftAmount = slotConfig.complexity;
        
        // 5. Generate sparse, long events
        let currentTime = 0;
        let currentRegisterIndex = Math.floor(scaleNotes.length / 2);
        
        for (let i = 0; i < eventCount; i++) {
            // Pick note with register drift
            const driftRange = Math.floor(scaleNotes.length * driftAmount);
            const drift = rng.int(-driftRange, driftRange);
            currentRegisterIndex = Math.max(
                0,
                Math.min(
                    scaleNotes.length - 1,
                    currentRegisterIndex + drift
                )
            );
            
            const note = scaleNotes[currentRegisterIndex];
            
            // Very long durations (ambient characteristic)
            const duration = rng.range(4, 8) * (1 + slotConfig.complexity);
            
            // Soft velocities with variation
            const velocity = 0.4 + rng.next() * 0.3;
            
            events.push(new GestureEvent({
                time: currentTime,
                note: note,
                velocity: velocity,
                duration: duration,
                tag: null
            }));
            
            // Large gaps between events (sparse)
            const gap = rng.range(2, 6);
            currentTime += gap;
        }
        
        // 6. Add pedal tone if tension is low (more ambient)
        if (slotConfig.tension < 0.4) {
            this.addPedalTone(events, scaleNotes[0], currentTime, rng);
        }
        
        // 7. Apply minimal microtiming (ambient should feel "breathed")
        events.forEach(e => {
            e.time = this.applyMicrotiming(
                e.time,
                slotConfig.rhythmLoose * 0.3,  // Very subtle
                rng
            );
        });
        
        // 8. Return the complete gesture
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: events,
            loopLengthBeats: null,  // One-shot (could be a long loop)
            display: `Ambient ${eventCount}n`
        });
    }
    
    /**
     * Helper: Add a sustained pedal tone
     */
    addPedalTone(events, pedalNote, duration, rng) {
        events.push(new GestureEvent({
            time: 0,
            note: pedalNote - 12,  // Octave below
            velocity: 0.3 + rng.next() * 0.1,
            duration: duration,
            tag: 'pedal'
        }));
    }
    
    /**
     * Helper: Create empty gesture as fallback
     */
    createEmptyGesture(slotConfig) {
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: [],
            display: 'Empty'
        });
    }
}

/**
 * USAGE EXAMPLE
 * 
 * 1. Save this file as: js/styles/ambient-texture.js
 * 
 * 2. Import and register in keyboard-palette.js:
 * 
 *    import { AmbientTextureGenerator } from './styles/ambient-texture.js';
 *    styleRegistry.register(new AmbientTextureGenerator());
 * 
 * 3. Add to distribution weights:
 * 
 *    this.styleDistribution = {
 *        'lyricalMinimal': 0.25,
 *        'aliceCascade': 0.2,
 *        'tintinnabuli': 0.15,
 *        'fracturedLead': 0.15,
 *        'ambientTexture': 0.25  // Your new style!
 *    };
 * 
 * 4. Regenerate palette and enjoy!
 */

/**
 * AVAILABLE HELPER METHODS (from StyleGenerator base class):
 * 
 * - this.getScaleNotesInRegister(harmonicContext, centerNote, rangeOctaves)
 *   → Returns array of MIDI notes in scale within register range
 * 
 * - this.quantizeNote(note, harmonicContext)
 *   → Quantizes a MIDI note to nearest note in current scale
 * 
 * - this.applyMicrotiming(time, amount, rng)
 *   → Adds subtle timing variation to event time
 * 
 * - this.getNoteName(note)
 *   → Converts MIDI note to name string (e.g., "C4")
 * 
 * - this.buildChord(rootNote, intervals)
 *   → Builds chord from intervals array
 * 
 * - this.getQuartalChord(rootNote, noteCount)
 *   → Builds quartal harmony (stacked 4ths)
 * 
 * - this.getQuintalChord(rootNote, noteCount)
 *   → Builds quintal harmony (stacked 5ths)
 */

/**
 * TIPS FOR CREATING GREAT GENERATORS:
 * 
 * 1. Use the seed for consistency
 *    - Same slot should produce same gesture
 *    - Use SeededRandom for all randomness
 * 
 * 2. Respect the parameters
 *    - density: controls note count
 *    - complexity: controls pattern intricacy
 *    - tension: controls dissonance
 *    - rhythmLoose: controls microtiming
 * 
 * 3. Stay in scale
 *    - Use getScaleNotesInRegister()
 *    - Or use quantizeNote() to correct out-of-scale notes
 * 
 * 4. Consider the role
 *    - 'bass': lower register, rhythmic
 *    - 'chords': harmonic support
 *    - 'lead': melodic, higher register
 *    - 'texture': atmospheric
 *    - 'percussion': rhythmic accents
 * 
 * 5. Use event tags meaningfully
 *    - 'pedal': sustained bass
 *    - 'grace': quick ornament
 *    - 'accent': emphasized
 *    - 'ghost': quiet
 *    - 'cluster': dense harmony
 * 
 * 6. Think about timing
 *    - One-shot vs. looping (loopLengthBeats)
 *    - Event times in beats from start
 *    - Durations in beats
 * 
 * 7. Be inspired by real music
 *    - Study the artist/style you're modeling
 *    - What makes it unique?
 *    - How can you capture that algorithmically?
 */

// Fractured Lead Style — Aphex Twin / Oni Ayhun / Autechre
// Short motif seeds with mutations, irregular rhythms, stutters, octave jumps

import { StyleGenerator } from '../style-generator.js';
import { Gesture, GestureEvent, SeededRandom } from '../gesture-core.js';

export class FracturedLeadGenerator extends StyleGenerator {
    constructor() {
        super('fracturedLead', 'Fractured Lead');
    }
    
    generate(slotConfig, harmonicContext, performanceContext) {
        const rng = new SeededRandom(slotConfig.seed);
        const events = [];
        
        // Get scale notes
        const baseOctave = 5 + slotConfig.registerShift; // Leads tend to be higher
        const registerCenter = 60 + (baseOctave - 4) * 12;
        const scaleNotes = this.getScaleNotesInRegister(harmonicContext, registerCenter, 2);
        
        if (scaleNotes.length === 0) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // Generate core motif (3-7 notes)
        const motifLength = 3 + Math.floor(slotConfig.complexity * 4);
        const motif = this.generateMotif(scaleNotes, motifLength, rng, slotConfig);
        
        // Determine how many times to repeat/mutate the motif
        const repetitions = 2 + Math.floor(slotConfig.density * 3); // 2-5 times
        
        let currentTime = 0;
        
        for (let rep = 0; rep < repetitions; rep++) {
            const mutationAmount = rep * slotConfig.motifVariation;
            const mutatedMotif = this.mutateMotif(motif, mutationAmount, scaleNotes, rng, slotConfig);
            
            // Add mutated motif to events
            for (const event of mutatedMotif) {
                events.push(new GestureEvent({
                    time: currentTime + event.time,
                    note: event.note,
                    velocity: event.velocity,
                    duration: event.duration,
                    tag: event.tag
                }));
            }
            
            // Update time for next repetition
            const motifDuration = Math.max(...mutatedMotif.map(e => e.time + e.duration));
            currentTime += motifDuration;
            
            // Add irregular gaps between repetitions
            if (rep < repetitions - 1) {
                currentTime += rng.range(0.1, 0.5);
            }
        }
        
        // Apply microtiming for off-grid feel
        events.forEach(e => {
            e.time = this.applyMicrotiming(e.time, slotConfig.rhythmLoose, rng);
        });
        
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: events,
            loopLengthBeats: null, // One-shot, could loop if needed
            display: `Fractured ${motifLength}n`
        });
    }
    
    /**
     * Generate initial motif
     */
    generateMotif(scaleNotes, length, rng, config) {
        const motif = [];
        const startIndex = Math.floor(scaleNotes.length / 2);
        
        let currentIndex = startIndex;
        let currentTime = 0;
        
        // Irregular rhythm patterns (triplets, 5s, 7s)
        const rhythmPatterns = [
            [0.333, 0.333, 0.334],           // Triplets
            [0.25, 0.25, 0.5],               // Syncopated
            [0.2, 0.2, 0.2, 0.2, 0.2],       // Quintuplets
            [0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.15], // Septuplets
            [0.125, 0.375, 0.5],             // Swing
            [0.5, 0.25, 0.25]                // Standard
        ];
        
        const rhythm = rng.choice(rhythmPatterns);
        
        for (let i = 0; i < length; i++) {
            const note = scaleNotes[currentIndex];
            const duration = rhythm[i % rhythm.length];
            
            // Velocity variation
            let velocity = 0.7 + rng.next() * 0.3;
            
            // Ghost notes (occasionally)
            const isGhost = rng.next() < 0.15;
            if (isGhost) {
                velocity *= 0.4;
            }
            
            motif.push(new GestureEvent({
                time: currentTime,
                note: note,
                velocity: velocity,
                duration: duration * 0.7, // Staccato
                tag: isGhost ? 'ghost' : null
            }));
            
            currentTime += duration;
            
            // Movement pattern - mostly small steps with occasional leaps
            if (rng.next() < 0.7) {
                // Small step
                currentIndex += rng.choice([-1, 1, -2, 2]);
            } else {
                // Leap
                currentIndex += rng.choice([-5, -4, -3, 3, 4, 5]);
            }
            
            // Keep in range
            currentIndex = Math.max(0, Math.min(scaleNotes.length - 1, currentIndex));
        }
        
        return motif;
    }
    
    /**
     * Mutate motif for variation
     */
    mutateMotif(motif, mutationAmount, scaleNotes, rng, config) {
        const mutated = [];
        
        for (const event of motif) {
            let note = event.note;
            let velocity = event.velocity;
            let duration = event.duration;
            let time = event.time;
            let tag = event.tag;
            
            // Note mutation
            if (rng.next() < mutationAmount) {
                // Transpose within scale
                const noteIndex = scaleNotes.indexOf(note);
                if (noteIndex !== -1) {
                    const shift = rng.choice([-2, -1, 1, 2]);
                    const newIndex = Math.max(0, Math.min(scaleNotes.length - 1, noteIndex + shift));
                    note = scaleNotes[newIndex];
                }
                
                // Octave jump
                if (rng.next() < mutationAmount * 0.5) {
                    note += rng.choice([-12, 12]);
                    // Quantize back to scale
                    note = this.quantizeNote(note, config);
                }
            }
            
            // Rhythm mutation
            if (rng.next() < mutationAmount * 0.5) {
                duration *= rng.range(0.7, 1.3);
            }
            
            // Velocity mutation
            if (rng.next() < mutationAmount * 0.3) {
                velocity *= rng.range(0.8, 1.2);
                velocity = Math.max(0.1, Math.min(1, velocity));
            }
            
            // Add stutter (rapid repeat)
            if (rng.next() < mutationAmount * 0.3) {
                const stutterCount = rng.int(2, 4);
                const stutterDur = duration / stutterCount;
                
                for (let s = 0; s < stutterCount; s++) {
                    mutated.push(new GestureEvent({
                        time: time + s * stutterDur,
                        note: note,
                        velocity: velocity * (1 - s * 0.2),
                        duration: stutterDur * 0.8,
                        tag: 'stutter'
                    }));
                }
                continue; // Skip normal event
            }
            
            // Chromatic approach tone (if high tension)
            if (config.tension > 0.7 && rng.next() < 0.2) {
                // Add chromatic grace note before main note
                mutated.push(new GestureEvent({
                    time: time - 0.05,
                    note: note + rng.choice([-1, 1]),
                    velocity: velocity * 0.6,
                    duration: 0.05,
                    tag: 'grace'
                }));
            }
            
            mutated.push(new GestureEvent({
                time: time,
                note: note,
                velocity: velocity,
                duration: duration,
                tag: tag
            }));
        }
        
        return mutated;
    }
    
    quantizeNote(note, config) {
        // Simple quantization - would ideally use harmony.js
        return Math.round(note);
    }
    
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

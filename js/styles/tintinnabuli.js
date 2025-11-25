// Arvo Pärt Style — Tintinnabuli
// Two-voice counterpoint: melodic voice + tintinnabuli voice (closest chord tone)

import { StyleGenerator } from './style-generator.js';
import { Gesture, GestureEvent, SeededRandom } from './gesture-core.js';

export class TintinnabuliGenerator extends StyleGenerator {
    constructor() {
        super('tintinnabuli', 'Arvo Pärt Tintinnabuli');
    }
    
    generate(slotConfig, harmonicContext, performanceContext) {
        const rng = new SeededRandom(slotConfig.seed);
        const events = [];
        
        // Get tonic triad for tintinnabuli voice
        const tonicTriad = this.getTonicTriad(harmonicContext);
        
        if (tonicTriad.length < 3) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // Get scale notes for melodic voice
        const baseOctave = 4 + slotConfig.registerShift;
        const registerCenter = 60 + (baseOctave - 4) * 12;
        const scaleNotes = this.getScaleNotesInRegister(harmonicContext, registerCenter, 1.5);
        
        if (scaleNotes.length === 0) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // Generate melodic voice (stepwise motion)
        const phraseLength = Math.floor(4 + slotConfig.density * 8); // 4-12 notes
        const melodicVoice = this.generateMelodicVoice(
            scaleNotes, 
            phraseLength, 
            rng, 
            slotConfig
        );
        
        // Generate tintinnabuli voice (follows melodic voice with chord tones)
        const tintinnabuliVoice = this.generateTintinnabuliVoice(
            melodicVoice,
            tonicTriad,
            slotConfig.complexity > 0.5 ? 'above' : 'below',
            harmonicContext
        );
        
        // Combine voices
        events.push(...melodicVoice);
        events.push(...tintinnabuliVoice);
        
        // Apply minimal microtiming (Pärt is very precise)
        events.forEach(e => {
            e.time = this.applyMicrotiming(e.time, slotConfig.rhythmLoose * 0.3, rng);
        });
        
        // Calculate loop length (usually 4 or 8 beats)
        const totalDuration = Math.max(...events.map(e => e.time + e.duration));
        const loopLength = Math.ceil(totalDuration / 4) * 4;
        
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: events,
            loopLengthBeats: loopLength,
            display: `Tintinnabuli ${loopLength}bar`
        });
    }
    
    /**
     * Get tonic triad from harmonic context
     */
    getTonicTriad(harmonicContext) {
        const scaleNotes = harmonicContext.scaleNotes;
        if (scaleNotes.length < 3) return [];
        
        // Get first, third, and fifth scale degrees
        const root = scaleNotes[0];
        const third = scaleNotes[2]; // Scale degree 3
        const fifth = scaleNotes[4]; // Scale degree 5
        
        // Build triad across multiple octaves
        const triad = [];
        for (let octave = -1; octave <= 2; octave++) {
            triad.push(root + octave * 12);
            triad.push(third + octave * 12);
            triad.push(fifth + octave * 12);
        }
        
        return triad.sort((a, b) => a - b);
    }
    
    /**
     * Generate melodic voice with stepwise motion
     */
    generateMelodicVoice(scaleNotes, phraseLength, rng, config) {
        const events = [];
        const startIndex = Math.floor(scaleNotes.length / 2);
        
        let currentIndex = startIndex;
        let currentTime = 0;
        
        // Note durations (simple rhythms)
        const durations = [1.0, 1.0, 0.5, 0.5, 2.0, 0.75, 0.25];
        
        for (let i = 0; i < phraseLength; i++) {
            const note = scaleNotes[currentIndex];
            const duration = rng.choice(durations);
            
            events.push(new GestureEvent({
                time: currentTime,
                note: note,
                velocity: 0.65 + rng.next() * 0.15,
                duration: duration * 0.9 // Slight gap between notes
            }));
            
            currentTime += duration;
            
            // Move stepwise (mostly)
            const stepSize = rng.next() < 0.7 ? 1 : 2; // Mostly steps, some skips
            const direction = rng.next() < 0.5 ? 1 : -1;
            currentIndex += direction * stepSize;
            
            // Keep in range
            currentIndex = Math.max(0, Math.min(scaleNotes.length - 1, currentIndex));
            
            // Occasional return to center
            if (rng.next() < 0.2) {
                currentIndex = startIndex;
            }
        }
        
        return events;
    }
    
    /**
     * Generate tintinnabuli voice (closest chord tone to each melodic note)
     */
    generateTintinnabuliVoice(melodicVoice, tonicTriad, position, harmonicContext) {
        const events = [];
        
        for (const melodicEvent of melodicVoice) {
            const melodicNote = melodicEvent.note;
            
            // Find closest chord tone
            let closestNote = tonicTriad[0];
            let minDistance = Math.abs(melodicNote - closestNote);
            
            for (const triadNote of tonicTriad) {
                const distance = Math.abs(melodicNote - triadNote);
                
                if (distance < minDistance && distance > 0) {
                    // Apply position rule (above or below)
                    const isAbove = triadNote > melodicNote;
                    
                    if ((position === 'above' && isAbove) || (position === 'below' && !isAbove)) {
                        closestNote = triadNote;
                        minDistance = distance;
                    }
                }
            }
            
            // Create tintinnabuli event
            events.push(new GestureEvent({
                time: melodicEvent.time,
                note: closestNote,
                velocity: melodicEvent.velocity * 0.7, // Softer than melody
                duration: melodicEvent.duration,
                tag: 'tintinnabuli'
            }));
        }
        
        return events;
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

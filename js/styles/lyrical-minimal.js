// Lyrical Minimal Style — Satie / Sakamoto / Frahm
// Simple repeating cells, limited notes, elegant and tonal

import { StyleGenerator } from '../style-generator.js';
import { Gesture, GestureEvent, SeededRandom } from '../gesture-core.js';

export class LyricalMinimalGenerator extends StyleGenerator {
    constructor() {
        super('lyricalMinimal', 'Lyrical Minimal');
    }
    
    generate(slotConfig, harmonicContext, performanceContext) {
        const rng = new SeededRandom(slotConfig.seed);
        const events = [];
        
        // Get scale notes in comfortable register
        const baseOctave = 4 + slotConfig.registerShift;
        const registerCenter = 60 + (baseOctave - 4) * 12;
        const scaleNotes = this.getScaleNotesInRegister(harmonicContext, registerCenter, 1.5);
        
        if (scaleNotes.length === 0) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // Choose cell type
        const cellTypes = ['simple', 'arpeggio', 'melody', 'dyad'];
        const cellType = rng.choice(cellTypes);
        
        // Generate based on type
        switch (cellType) {
            case 'simple':
                this.generateSimpleCell(events, scaleNotes, rng, slotConfig);
                break;
            case 'arpeggio':
                this.generateArpeggioCell(events, scaleNotes, rng, slotConfig);
                break;
            case 'melody':
                this.generateMelodyCell(events, scaleNotes, rng, slotConfig);
                break;
            case 'dyad':
                this.generateDyadCell(events, scaleNotes, rng, slotConfig);
                break;
        }
        
        // Add subtle asymmetry (occasionally)
        if (slotConfig.complexity > 0.5 && rng.next() < 0.3) {
            this.addAsymmetry(events, rng);
        }
        
        // Minimal microtiming (very slight)
        events.forEach(e => {
            e.time = this.applyMicrotiming(e.time, slotConfig.rhythmLoose * 0.5, rng);
        });
        
        // Calculate loop length (usually 2 or 4 beats)
        const totalDuration = Math.max(...events.map(e => e.time + e.duration));
        const loopLength = totalDuration <= 2.5 ? 2 : 4;
        
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: events,
            loopLengthBeats: loopLength,
            display: `Minimal ${cellType}`
        });
    }
    
    /**
     * Simple repeating note pattern
     */
    generateSimpleCell(events, scaleNotes, rng, config) {
        // Pick 2-3 notes
        const noteCount = config.density < 0.5 ? 2 : 3;
        const centerIndex = Math.floor(scaleNotes.length / 2);
        const notes = [];
        
        for (let i = 0; i < noteCount; i++) {
            const offset = i - Math.floor(noteCount / 2);
            const index = Math.max(0, Math.min(scaleNotes.length - 1, centerIndex + offset * 2));
            notes.push(scaleNotes[index]);
        }
        
        // Simple rhythm
        const patterns = [
            [0, 1, 2, 3],           // Quarter notes
            [0, 1, 2],              // Dotted half pattern
            [0, 0.5, 1, 1.5, 2],    // Eighth notes
            [0, 1.5, 3]             // Long-short-long
        ];
        
        const pattern = rng.choice(patterns);
        const noteIndex = 0;
        
        for (const time of pattern) {
            const note = notes[Math.floor((time / 4) * notes.length) % notes.length];
            
            events.push(new GestureEvent({
                time: time,
                note: note,
                velocity: 0.65 + rng.next() * 0.15,
                duration: 0.8
            }));
        }
    }
    
    /**
     * Gentle arpeggio
     */
    generateArpeggioCell(events, scaleNotes, rng, config) {
        // Pick 3-4 notes for arpeggio
        const noteCount = 3 + Math.floor(config.density);
        const centerIndex = Math.floor(scaleNotes.length / 2);
        const notes = [];
        
        for (let i = 0; i < noteCount; i++) {
            const index = Math.max(0, Math.min(scaleNotes.length - 1, centerIndex + i * 2));
            notes.push(scaleNotes[index]);
        }
        
        // Arpeggio pattern
        const timePerNote = 4 / notes.length;
        
        for (let i = 0; i < notes.length; i++) {
            events.push(new GestureEvent({
                time: i * timePerNote,
                note: notes[i],
                velocity: 0.6 + i * 0.05, // Slight crescendo
                duration: timePerNote * 1.2 // Overlap slightly
            }));
        }
        
        // Return down (if complexity allows)
        if (config.complexity > 0.5 && notes.length > 2) {
            for (let i = notes.length - 2; i > 0; i--) {
                const time = notes.length * timePerNote + (notes.length - 1 - i) * timePerNote;
                events.push(new GestureEvent({
                    time: time,
                    note: notes[i],
                    velocity: 0.55,
                    duration: timePerNote * 1.2
                }));
            }
        }
    }
    
    /**
     * Simple melodic phrase
     */
    generateMelodyCell(events, scaleNotes, rng, config) {
        // Pick 4-6 notes
        const noteCount = 4 + Math.floor(config.density * 2);
        const startIndex = Math.floor(scaleNotes.length * 0.4);
        
        let currentIndex = startIndex;
        let currentTime = 0;
        
        for (let i = 0; i < noteCount; i++) {
            const note = scaleNotes[currentIndex];
            const duration = i === noteCount - 1 ? 1.5 : rng.choice([0.5, 0.75, 1.0]);
            
            events.push(new GestureEvent({
                time: currentTime,
                note: note,
                velocity: 0.65 + rng.next() * 0.2,
                duration: duration * 0.9
            }));
            
            currentTime += duration;
            
            // Mostly stepwise motion
            const step = rng.choice([-1, 0, 1, 1]); // Bias toward ascending
            currentIndex = Math.max(0, Math.min(scaleNotes.length - 1, currentIndex + step));
        }
    }
    
    /**
     * Two-note dyad (interval)
     */
    generateDyadCell(events, scaleNotes, rng, config) {
        const centerIndex = Math.floor(scaleNotes.length / 2);
        
        // Pick two notes (3rd, 4th, or 5th apart)
        const intervalSteps = rng.choice([2, 3, 4]); // Scale steps
        const note1 = scaleNotes[centerIndex];
        const note2 = scaleNotes[Math.min(scaleNotes.length - 1, centerIndex + intervalSteps)];
        
        // Simple rhythm with both notes
        const times = [0, 1, 2, 3];
        
        for (const time of times) {
            // Alternate or play together
            const together = config.complexity > 0.6;
            
            if (together) {
                // Play both notes
                events.push(new GestureEvent({
                    time: time,
                    note: note1,
                    velocity: 0.6 + rng.next() * 0.15,
                    duration: 0.9
                }));
                events.push(new GestureEvent({
                    time: time,
                    note: note2,
                    velocity: 0.55 + rng.next() * 0.15,
                    duration: 0.9
                }));
            } else {
                // Alternate
                const note = time % 2 === 0 ? note1 : note2;
                events.push(new GestureEvent({
                    time: time,
                    note: note,
                    velocity: 0.6 + rng.next() * 0.2,
                    duration: 0.9
                }));
            }
        }
    }
    
    /**
     * Add subtle asymmetry (Satie-like)
     */
    addAsymmetry(events, rng) {
        if (events.length < 2) return;
        
        // Slightly shift one event's timing
        const targetIndex = rng.int(0, events.length - 1);
        const shift = rng.range(-0.1, 0.1);
        events[targetIndex].time = Math.max(0, events[targetIndex].time + shift);
        
        // Or add a grace note
        if (rng.next() < 0.5 && events.length > 0) {
            const mainEvent = events[0];
            events.push(new GestureEvent({
                time: Math.max(0, mainEvent.time - 0.08),
                note: mainEvent.note + rng.choice([-2, 2]),
                velocity: mainEvent.velocity * 0.5,
                duration: 0.08,
                tag: 'grace'
            }));
        }
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

// Alice Coltrane Style — Cascading Harp/Piano Runs
// Multi-bar flowing cascades with quartal/quintal voicings and modal runs

import { StyleGenerator } from './style-generator.js';
import { Gesture, GestureEvent, SeededRandom } from './gesture-core.js';

export class AliceCascadeGenerator extends StyleGenerator {
    constructor() {
        super('aliceCascade', 'Alice Coltrane Cascade');
    }
    
    generate(slotConfig, harmonicContext, performanceContext) {
        const rng = new SeededRandom(slotConfig.seed);
        const events = [];
        
        // Determine register based on slotId and registerShift
        const baseOctave = 4 + slotConfig.registerShift;
        const registerCenter = 60 + (baseOctave - 4) * 12;
        
        // Get scale notes in extended range
        const scaleNotes = this.getScaleNotesInRegister(
            harmonicContext, 
            registerCenter, 
            2 + slotConfig.complexity
        );
        
        if (scaleNotes.length === 0) {
            return this.createEmptyGesture(slotConfig);
        }
        
        // Density determines total length and note count
        const totalBeats = 2 + slotConfig.density * 6; // 2-8 beats
        const noteCount = Math.floor(8 + slotConfig.density * 24); // 8-32 notes
        
        // Choose cascade type
        const cascadeType = rng.choice(['ascending', 'descending', 'wave', 'scattered']);
        
        switch (cascadeType) {
            case 'ascending':
                this.generateAscendingCascade(events, scaleNotes, noteCount, totalBeats, rng, slotConfig);
                break;
            case 'descending':
                this.generateDescendingCascade(events, scaleNotes, noteCount, totalBeats, rng, slotConfig);
                break;
            case 'wave':
                this.generateWaveCascade(events, scaleNotes, noteCount, totalBeats, rng, slotConfig);
                break;
            case 'scattered':
                this.generateScatteredCascade(events, scaleNotes, noteCount, totalBeats, rng, slotConfig);
                break;
        }
        
        // Add pedal tone if complexity is high
        if (slotConfig.complexity > 0.6) {
            this.addPedalTone(events, scaleNotes[0], totalBeats, rng);
        }
        
        // Add quartal/quintal chord if tension is moderate
        if (slotConfig.tension > 0.4 && slotConfig.tension < 0.8) {
            this.addQuartalChord(events, scaleNotes, totalBeats, rng, slotConfig);
        }
        
        // Apply microtiming
        events.forEach(e => {
            e.time = this.applyMicrotiming(e.time, slotConfig.rhythmLoose, rng);
        });
        
        return new Gesture({
            typeId: this.styleId,
            slotId: slotConfig.slotId,
            role: slotConfig.role,
            events: events,
            loopLengthBeats: null, // One-shot
            display: `Alice ${cascadeType}`
        });
    }
    
    generateAscendingCascade(events, scaleNotes, noteCount, totalBeats, rng, config) {
        const startIndex = Math.floor(scaleNotes.length * 0.2);
        const timePerNote = totalBeats / noteCount;
        
        for (let i = 0; i < noteCount; i++) {
            const index = Math.min(
                startIndex + Math.floor(i * (scaleNotes.length - startIndex) / noteCount),
                scaleNotes.length - 1
            );
            
            events.push(new GestureEvent({
                time: i * timePerNote,
                note: scaleNotes[index],
                velocity: 0.6 + rng.next() * 0.3,
                duration: timePerNote * (0.8 + rng.next() * 0.4)
            }));
        }
    }
    
    generateDescendingCascade(events, scaleNotes, noteCount, totalBeats, rng, config) {
        const startIndex = Math.floor(scaleNotes.length * 0.8);
        const timePerNote = totalBeats / noteCount;
        
        for (let i = 0; i < noteCount; i++) {
            const index = Math.max(
                startIndex - Math.floor(i * startIndex / noteCount),
                0
            );
            
            events.push(new GestureEvent({
                time: i * timePerNote,
                note: scaleNotes[index],
                velocity: 0.6 + rng.next() * 0.3,
                duration: timePerNote * (0.8 + rng.next() * 0.4)
            }));
        }
    }
    
    generateWaveCascade(events, scaleNotes, noteCount, totalBeats, rng, config) {
        const timePerNote = totalBeats / noteCount;
        const waveFreq = 0.5 + config.complexity * 1.5;
        
        for (let i = 0; i < noteCount; i++) {
            const phase = (i / noteCount) * Math.PI * 2 * waveFreq;
            const wavePos = (Math.sin(phase) + 1) / 2; // 0-1
            const index = Math.floor(wavePos * (scaleNotes.length - 1));
            
            events.push(new GestureEvent({
                time: i * timePerNote,
                note: scaleNotes[index],
                velocity: 0.6 + rng.next() * 0.3,
                duration: timePerNote * (0.7 + rng.next() * 0.5)
            }));
        }
    }
    
    generateScatteredCascade(events, scaleNotes, noteCount, totalBeats, rng, config) {
        // Create irregular timing pattern
        const times = [];
        let currentTime = 0;
        
        for (let i = 0; i < noteCount; i++) {
            times.push(currentTime);
            currentTime += rng.range(0.05, 0.3);
        }
        
        // Normalize to fit totalBeats
        const scaleFactor = totalBeats / currentTime;
        times.forEach((t, i) => times[i] = t * scaleFactor);
        
        // Create scattered notes across register
        for (let i = 0; i < noteCount; i++) {
            const index = rng.int(0, scaleNotes.length - 1);
            
            events.push(new GestureEvent({
                time: times[i],
                note: scaleNotes[index],
                velocity: 0.5 + rng.next() * 0.4,
                duration: 0.3 + rng.next() * 0.5
            }));
        }
    }
    
    addPedalTone(events, pedalNote, duration, rng) {
        // Sustained bass note
        events.push(new GestureEvent({
            time: 0,
            note: pedalNote - 12, // One octave below
            velocity: 0.4 + rng.next() * 0.2,
            duration: duration,
            tag: 'pedal'
        }));
    }
    
    addQuartalChord(events, scaleNotes, duration, rng, config) {
        // Build quartal voicing from scale notes
        if (scaleNotes.length < 3) return;
        
        const rootIndex = Math.floor(scaleNotes.length * 0.3);
        const root = scaleNotes[rootIndex];
        
        // Get notes roughly 4 and 8 semitones above (approximating quartal)
        const second = this.quantizeNote(root + 5, config);
        const third = this.quantizeNote(root + 10, config);
        
        const chordNotes = [root, second, third];
        const startTime = duration * 0.2;
        
        chordNotes.forEach((note, i) => {
            events.push(new GestureEvent({
                time: startTime + i * 0.05,
                note: note,
                velocity: 0.5 + rng.next() * 0.2,
                duration: duration * 0.6
            }));
        });
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

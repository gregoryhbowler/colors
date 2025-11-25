// COLORS — Event-Based Gesture Player
// Schedules and plays GestureEvent sequences with precise timing

import { midiToFreq } from './harmony.js';

/**
 * Playback state for an active gesture
 */
class GesturePlaybackState {
    constructor(gesture, slotId, velocity, startTime, { forceOneShot = false } = {}) {
        this.gesture = gesture;
        this.slotId = slotId;
        this.velocity = velocity;
        this.startTime = startTime;
        this.isLooping = !forceOneShot && gesture.loopLengthBeats !== null;
        this.loopCount = 0;
        this.scheduledNotes = []; // { time, note, velocity, duration }
        this.activeNotes = new Set(); // Currently sounding notes
        this.timeoutIds = []; // setTimeout IDs for cleanup
        this.intervalId = null; // For looping gestures
    }
    
    cleanup() {
        // Clear all timeouts
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        
        // Clear interval
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

/**
 * Event-Based Gesture Player
 * Handles playback of event-based gestures with precise timing
 */
export class EventGesturePlayer {
    constructor(engine, palette) {
        this.engine = engine;
        this.palette = palette;
        
        // Active gestures by slot ID
        this.activeGestures = new Map();
        
        // Performance context access
        this.performanceContext = palette ? palette.performanceContext : null;
    }
    
    /**
     * Set palette reference
     */
    setPalette(palette) {
        this.palette = palette;
        this.performanceContext = palette.performanceContext;
    }
    
    /**
     * Trigger a gesture for a slot
     */
    triggerSlot(slotId, velocity = 1, { forceOneShot = false } = {}) {
        if (!this.palette) {
            console.error('[EventGesturePlayer] No palette set');
            return null;
        }
        
        // Get gesture from palette
        const gesture = this.palette.getGesture(slotId);
        
        if (!gesture || gesture.events.length === 0) {
            console.warn(`[EventGesturePlayer] No gesture for slot ${slotId}`);
            return null;
        }
        
        console.log(`[EventGesturePlayer] Trigger slot ${slotId}: ${gesture.typeId} - ${gesture.display}`);
        
        // Stop any existing playback for this slot
        this.releaseSlot(slotId);
        
        // Create playback state
        const startTime = performance.now();
        const state = new GesturePlaybackState(gesture, slotId, velocity, startTime, { forceOneShot });

        this.activeGestures.set(slotId, state);

        // Schedule all events
        this.scheduleGesture(state);

        return { gesture, isLooping: state.isLooping };
    }
    
    /**
     * Schedule all events in a gesture
     */
    scheduleGesture(state) {
        const { gesture, velocity, startTime } = state;
        const msPerBeat = this.getMsPerBeat();
        
        console.log(`[EventGesturePlayer] Scheduling ${gesture.events.length} events for slot ${state.slotId}`);
        
        // Schedule each event
        for (const event of gesture.events) {
            const delayMs = event.time * msPerBeat;
            const durationMs = event.duration * msPerBeat;
            
            // Schedule note on
            const timeoutId = setTimeout(() => {
                this.playEvent(state, event, velocity);
            }, delayMs);
            
            state.timeoutIds.push(timeoutId);
            
            // Schedule note off (if duration is specified)
            if (durationMs > 0) {
                const offTimeoutId = setTimeout(() => {
                    this.stopEvent(state, event);
                }, delayMs + durationMs);
                
                state.timeoutIds.push(offTimeoutId);
            }
        }
        
        // If looping, schedule loop restart
        if (state.isLooping && gesture.loopLengthBeats) {
            const loopDurationMs = gesture.loopLengthBeats * msPerBeat;
            
            state.intervalId = setInterval(() => {
                state.loopCount++;
                console.log(`[EventGesturePlayer] Loop ${state.loopCount} for slot ${state.slotId}`);
                
                // Re-schedule all events
                for (const event of gesture.events) {
                    const delayMs = event.time * msPerBeat;
                    const durationMs = event.duration * msPerBeat;
                    
                    const timeoutId = setTimeout(() => {
                        this.playEvent(state, event, velocity);
                    }, delayMs);
                    
                    state.timeoutIds.push(timeoutId);
                    
                    if (durationMs > 0) {
                        const offTimeoutId = setTimeout(() => {
                            this.stopEvent(state, event);
                        }, delayMs + durationMs);
                        
                        state.timeoutIds.push(offTimeoutId);
                    }
                }
            }, loopDurationMs);
        }
    }
    
    /**
     * Play a single event
     */
    playEvent(state, event, globalVelocity) {
        // Check if this slot is still active
        if (!this.activeGestures.has(state.slotId)) {
            return;
        }
        
        const note = event.note;
        const velocity = event.velocity * globalVelocity;
        
        // Apply velocity based on tag
        let finalVelocity = velocity;
        switch (event.tag) {
            case 'ghost':
                finalVelocity *= 0.4;
                break;
            case 'grace':
                finalVelocity *= 0.6;
                break;
            case 'accent':
                finalVelocity *= 1.2;
                break;
            case 'pedal':
                finalVelocity *= 0.7;
                break;
        }
        
        finalVelocity = Math.max(0.1, Math.min(1, finalVelocity));
        
        console.log(`[EventGesturePlayer] Event: note=${note}, vel=${finalVelocity.toFixed(2)}, tag=${event.tag || 'none'}`);
        
        // Trigger note in engine
        this.engine.noteOn(note, finalVelocity);
        state.activeNotes.add(note);
    }
    
    /**
     * Stop a single event
     */
    stopEvent(state, event) {
        // Check if this slot is still active
        if (!this.activeGestures.has(state.slotId)) {
            return;
        }
        
        const note = event.note;
        
        // Release note if it's still active
        if (state.activeNotes.has(note)) {
            this.engine.noteOff(note);
            state.activeNotes.delete(note);
        }
    }
    
    /**
     * Release a slot (stop gesture playback)
     */
    releaseSlot(slotId) {
        const state = this.activeGestures.get(slotId);
        if (!state) return;
        
        console.log(`[EventGesturePlayer] Release slot ${slotId}`);
        
        // Stop all active notes
        for (const note of state.activeNotes) {
            this.engine.noteOff(note);
        }
        state.activeNotes.clear();
        
        // Cleanup timers
        state.cleanup();
        
        // Remove from active
        this.activeGestures.delete(slotId);
    }
    
    /**
     * Release all slots
     */
    releaseAll() {
        console.log('[EventGesturePlayer] Release all');
        
        for (const slotId of this.activeGestures.keys()) {
            this.releaseSlot(slotId);
        }
        
        // Ensure all notes off
        this.engine.allNotesOff();
    }
    
    /**
     * Get milliseconds per beat from performance context
     */
    getMsPerBeat() {
        if (this.performanceContext) {
            return this.performanceContext.getMsPerBeat();
        }
        return 500; // Default 120 BPM
    }
    
    /**
     * Get active gesture count
     */
    getActiveGestureCount() {
        return this.activeGestures.size;
    }
    
    /**
     * Check if slot is active
     */
    isSlotActive(slotId) {
        return this.activeGestures.has(slotId);
    }
    
    /**
     * Get currently active slots
     */
    getActiveSlots() {
        return Array.from(this.activeGestures.keys());
    }
}

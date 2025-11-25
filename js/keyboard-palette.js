// COLORS — Keyboard Gesture Palette
// Maps entire keyboard range to gesture slots with intelligent distribution

import { SlotConfig, HarmonicContext, PerformanceContext, SeededRandom } from './gesture-core.js';
import { styleRegistry } from './style-generator.js';
import { getScaleNotes, getDiatonicChords } from './harmony.js';

// Import all styles
import { AliceCascadeGenerator } from './styles/alice-cascade.js';
import { TintinnabuliGenerator } from './styles/tintinnabuli.js';
import { FracturedLeadGenerator } from './styles/fractured-lead.js';
import { LyricalMinimalGenerator } from './styles/lyrical-minimal.js';

// Register all style generators
styleRegistry.register(new AliceCascadeGenerator());
styleRegistry.register(new TintinnabuliGenerator());
styleRegistry.register(new FracturedLeadGenerator());
styleRegistry.register(new LyricalMinimalGenerator());

/**
 * Keyboard Gesture Palette
 * Manages gestures across entire keyboard range
 */
export class KeyboardGesturePalette {
    constructor({
        minSlot = 36,  // MIDI C2
        maxSlot = 96,  // MIDI C7
        root = 'C',
        scale = 'major',
        tempo = 120
    } = {}) {
        this.minSlot = minSlot;
        this.maxSlot = maxSlot;
        this.root = root;
        this.scale = scale;
        this.tempo = tempo;
        
        // Slot configurations (one per MIDI note in range)
        this.slotConfigs = new Map();

        // Generated gestures (cached)
        this.gestures = new Map();

        // Locked slots that should not be regenerated
        this.lockedSlots = new Set();
        
        // Contexts
        this.harmonicContext = null;
        this.performanceContext = new PerformanceContext({ tempo });
        
        // Distribution settings
        this.styleDistribution = {
            'lyricalMinimal': 0.3,    // Most common - safe choice
            'aliceCascade': 0.2,      // Modal cascades
            'tintinnabuli': 0.2,      // Sacred minimalism
            'fracturedLead': 0.15,    // Glitchy leads
            'ambientTexture': 0.1,    // Sparse textures (when implemented)
            'bocTexture': 0.05        // BoC-style (when implemented)
        };
        
        // Initialize
        this.initializeSlots();
        this.updateHarmonicContext();
        this.regenerateAll();
    }

    /**
     * Clamp helper
     */
    clamp(value, min = 0, max = 1) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Initialize all slot configurations
     */
    initializeSlots() {
        console.log(`[KeyboardPalette] Initializing slots ${this.minSlot}-${this.maxSlot}`);

        const totalSlots = this.maxSlot - this.minSlot + 1;
        const rng = new SeededRandom(12345); // Master seed for consistent layout

        for (let slotId = this.minSlot; slotId <= this.maxSlot; slotId++) {
            const slotConfig = this.createSlotConfig(slotId, rng, totalSlots);
            this.slotConfigs.set(slotId, slotConfig);
        }

        console.log(`[KeyboardPalette] Initialized ${this.slotConfigs.size} slots`);
    }

    /**
     * Create a single slot configuration using the current distribution
     */
    createSlotConfig(slotId, rng, totalSlots) {
        // Determine characteristics based on position
        const position = (slotId - this.minSlot) / totalSlots; // 0-1

        // Register tends to matter
        // Low notes -> bass, texture, pedals
        // Mid notes -> chords, harmonic content
        // High notes -> leads, melodic content

        let role;
        let styleId;
        let registerShift;

        if (position < 0.25) {
            // Lower register
            role = rng.choice(['bass', 'texture', 'chords']);
            styleId = rng.choice(['tintinnabuli', 'lyricalMinimal', 'aliceCascade']);
            registerShift = -1;
        } else if (position < 0.5) {
            // Lower-mid register
            role = rng.choice(['chords', 'texture']);
            styleId = this.weightedChoice(this.styleDistribution, rng);
            registerShift = 0;
        } else if (position < 0.75) {
            // Upper-mid register
            role = rng.choice(['chords', 'lead']);
            styleId = this.weightedChoice(this.styleDistribution, rng);
            registerShift = 0;
        } else {
            // Upper register
            role = rng.choice(['lead', 'texture']);
            styleId = rng.choice(['fracturedLead', 'lyricalMinimal', 'aliceCascade']);
            registerShift = 1;
        }

        return new SlotConfig({
            slotId: slotId,
            styleId: styleId,
            role: role,
            density: rng.range(0.3, 0.8),
            complexity: rng.range(0.3, 0.7),
            tension: rng.range(0.2, 0.6),
            registerShift: registerShift,
            rhythmLoose: rng.range(0.1, 0.4),
            motifVariation: rng.range(0.2, 0.5),
            seed: rng.next() * 1000000
        });
    }
    
    /**
     * Weighted random choice
     */
    weightedChoice(weights, rng) {
        const styles = Object.keys(weights);
        const values = Object.values(weights);
        
        // Filter to only available styles
        const available = styles.filter(s => styleRegistry.has(s));
        
        if (available.length === 0) {
            return 'lyricalMinimal'; // Fallback
        }
        
        const total = available.reduce((sum, s) => sum + weights[s], 0);
        let random = rng.next() * total;
        
        for (const style of available) {
            random -= weights[style];
            if (random <= 0) return style;
        }
        
        return available[0];
    }
    
    /**
     * Update harmonic context
     */
    updateHarmonicContext() {
        const scaleNotes = getScaleNotes(this.root, this.scale, 2, 6);
        const diatonicChords = getDiatonicChords(this.root, this.scale, 4);
        
        this.harmonicContext = new HarmonicContext({
            root: this.root,
            scale: this.scale,
            scaleNotes: scaleNotes,
            diatonicChords: diatonicChords,
            currentChord: diatonicChords[0],
            progression: []
        });
        
        console.log(`[KeyboardPalette] Updated harmony: ${this.root} ${this.scale}`);
    }
    
    /**
     * Set harmony (root + scale)
     */
    setHarmony(root, scale) {
        if (this.root === root && this.scale === scale) return;

        this.root = root;
        this.scale = scale;
        this.updateHarmonicContext();
        this.regenerateAll({ respectLocks: true });
    }
    
    /**
     * Set tempo
     */
    setTempo(tempo) {
        this.tempo = tempo;
        this.performanceContext.tempo = tempo;
    }
    
    /**
     * Regenerate all gestures
     */
    regenerateAll({ respectLocks = false } = {}) {
        console.log('[KeyboardPalette] Regenerating all gestures...');

        if (!respectLocks) {
            this.gestures.clear();
        }

        let generated = 0;

        for (const [slotId, config] of this.slotConfigs) {
            if (respectLocks && this.lockedSlots.has(slotId) && this.gestures.has(slotId)) {
                continue;
            }

            const gesture = styleRegistry.generate(
                config,
                this.harmonicContext,
                this.performanceContext
            );
            
            this.gestures.set(slotId, gesture);
            generated++;
        }
        
        console.log(`[KeyboardPalette] Generated ${generated} gestures`);
    }
    
    /**
     * Regenerate a single slot
     */
    regenerateSlot(slotId) {
        const config = this.slotConfigs.get(slotId);
        if (!config) return null;

        if (this.lockedSlots.has(slotId) && this.gestures.has(slotId)) {
            return this.gestures.get(slotId);
        }

        const gesture = styleRegistry.generate(
            config,
            this.harmonicContext,
            this.performanceContext
        );
        
        this.gestures.set(slotId, gesture);
        return gesture;
    }
    
    /**
     * Get gesture for a slot
     */
    getGesture(slotId) {
        return this.gestures.get(slotId);
    }

    /**
     * Get slot config
     */
    getSlotConfig(slotId) {
        return this.slotConfigs.get(slotId);
    }

    /**
     * Lock state helpers
     */
    isSlotLocked(slotId) {
        return this.lockedSlots.has(slotId);
    }

    toggleSlotLock(slotId) {
        if (this.lockedSlots.has(slotId)) {
            this.lockedSlots.delete(slotId);
            return false;
        }

        this.lockedSlots.add(slotId);
        return true;
    }

    /**
     * Regenerate only unlocked slots
     */
    regenerateUnlockedSlots() {
        for (const [slotId] of this.slotConfigs) {
            if (this.lockedSlots.has(slotId)) continue;
            this.regenerateSlot(slotId);
        }
    }
    
    /**
     * Update slot config and regenerate
     */
    updateSlotConfig(slotId, updates) {
        const config = this.slotConfigs.get(slotId);
        if (!config) return;
        
        Object.assign(config, updates);
        this.regenerateSlot(slotId);
    }
    
    /**
     * Randomize style distribution
     */
    randomizeDistribution() {
        const availableStyles = styleRegistry.getAllStyleIds();
        const rng = new SeededRandom(Date.now());
        
        // Reset distribution
        this.styleDistribution = {};
        
        // Assign random weights
        let total = 0;
        for (const style of availableStyles) {
            const weight = rng.range(0.1, 0.4);
            this.styleDistribution[style] = weight;
            total += weight;
        }
        
        // Normalize
        for (const style of availableStyles) {
            this.styleDistribution[style] /= total;
        }

        const totalSlots = this.maxSlot - this.minSlot + 1;

        for (const [slotId] of this.slotConfigs) {
            if (this.lockedSlots.has(slotId)) continue;

            const slotConfig = this.createSlotConfig(slotId, rng, totalSlots);
            this.slotConfigs.set(slotId, slotConfig);
            this.regenerateSlot(slotId);
        }
    }

    /**
     * Evolve unlocked slots based on locked references
     */
    evolveUnlockedSlots() {
        const lockedConfigs = Array.from(this.lockedSlots)
            .map(slotId => this.slotConfigs.get(slotId))
            .filter(Boolean);

        if (lockedConfigs.length === 0) {
            console.log('[KeyboardPalette] No locked slots to evolve from; regenerating unlocked');
            this.regenerateUnlockedSlots();
            return;
        }

        const rng = new SeededRandom(Date.now());

        for (const [slotId, config] of this.slotConfigs) {
            if (this.lockedSlots.has(slotId)) continue;

            const reference = this.pickReferenceConfig(slotId, lockedConfigs, rng);
            const evolvedConfig = this.createEvolvedConfig(config, reference, rng);

            this.slotConfigs.set(slotId, evolvedConfig);
            this.regenerateSlot(slotId);
        }
    }

    pickReferenceConfig(slotId, references, rng) {
        const sorted = [...references].sort((a, b) => Math.abs(a.slotId - slotId) - Math.abs(b.slotId - slotId));
        const candidates = sorted.slice(0, Math.max(1, Math.min(3, sorted.length)));
        return rng.choice(candidates);
    }

    createEvolvedConfig(baseConfig, referenceConfig, rng) {
        if (!referenceConfig) return baseConfig;

        const blend = (base, target, strength = 0.5) => {
            return this.clamp(base + ((target - base) * strength) + ((rng.next() - 0.5) * 0.15));
        };

        const jitter = (value, amount = 0.1) => {
            return this.clamp(value + ((rng.next() - 0.5) * amount));
        };

        return new SlotConfig({
            ...baseConfig,
            slotId: baseConfig.slotId,
            styleId: referenceConfig.styleId,
            density: blend(baseConfig.density, referenceConfig.density, 0.6),
            complexity: blend(baseConfig.complexity, referenceConfig.complexity, 0.6),
            tension: blend(baseConfig.tension, referenceConfig.tension, 0.4),
            registerShift: baseConfig.registerShift,
            rhythmLoose: jitter(referenceConfig.rhythmLoose, 0.1),
            motifVariation: jitter(referenceConfig.motifVariation, 0.2),
            seed: rng.next() * 1000000
        });
    }
    
    /**
     * Get gesture for MIDI note (accounting for pad octave offset)
     */
    getGestureForMIDI(midiNote) {
        // Direct mapping - MIDI note IS the slot ID
        return this.getGesture(midiNote);
    }
    
    /**
     * Get all gestures in range
     */
    getGesturesInRange(minSlot, maxSlot) {
        const gestures = [];
        for (let slotId = minSlot; slotId <= maxSlot; slotId++) {
            const gesture = this.gestures.get(slotId);
            if (gesture) {
                gestures.push({ slotId, gesture });
            }
        }
        return gestures;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const styleCount = {};
        const roleCount = {};
        
        for (const config of this.slotConfigs.values()) {
            styleCount[config.styleId] = (styleCount[config.styleId] || 0) + 1;
            roleCount[config.role] = (roleCount[config.role] || 0) + 1;
        }
        
        return {
            totalSlots: this.slotConfigs.size,
            styleDistribution: styleCount,
            roleDistribution: roleCount,
            availableStyles: styleRegistry.getAllStyleIds()
        };
    }
}

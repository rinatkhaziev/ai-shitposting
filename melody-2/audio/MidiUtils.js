/**
 * MidiUtils - Utility class for MIDI file creation
 */
class MidiUtils {
    // Add static constants at the top of the class
    static TICKS_PER_QUARTER = 480; // Standard MIDI resolution

    /**
     * Convert note name to MIDI note number
     * @param {string} noteName - Note name (e.g., "C4", "F#5")
     * @return {number} MIDI note number
     */
    static noteToMidi(noteName) {
        if (noteName === "Pause") return -1; // Special case for pauses
        
        const notes = { "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, 
                        "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11 };
                        
        // Parse note and octave
        const match = noteName.match(/^([A-G]#?)(\d)$/);
        if (!match) return -1;
        
        const note = match[1];
        const octave = parseInt(match[2]);
        
        // Calculate MIDI note number
        return notes[note] + (octave + 1) * 12;
    }
    
    /**
     * Converts a melody array to MIDI file data
     * @param {Array} melody - Array of note objects with note, duration
     * @param {number} bpm - Beats per minute
     * @return {Uint8Array} MIDI file data
     */
    static melodyToMidi(melody, bpm = 120) {
        // MIDI file constants
        const FORMAT_TYPE = 0;      // Single track format
        const TRACK_COUNT = 1;      // One track
        const DEFAULT_VELOCITY = 80; // Medium velocity for notes
        
        // Calculate microseconds per quarter note from BPM
        const microsecondsPerQuarter = Math.round(60000000 / bpm);
        
        // Create header chunk
        const headerChunk = [
            0x4D, 0x54, 0x68, 0x64,  // MThd
            0x00, 0x00, 0x00, 0x06,  // Chunk length (always 6 for header)
            0x00, FORMAT_TYPE,       // Format type (0)
            0x00, TRACK_COUNT,       // Number of tracks (1)
            (this.TICKS_PER_QUARTER >> 8) & 0xFF, this.TICKS_PER_QUARTER & 0xFF  // Time division (ticks per quarter note)
        ];
        
        // Start building track events
        const trackEvents = [];
        
        // Add tempo meta event
        trackEvents.push({
            deltaTime: 0,
            eventData: [
                0xFF, 0x51, 0x03,  // Tempo meta event
                (microsecondsPerQuarter >> 16) & 0xFF,
                (microsecondsPerQuarter >> 8) & 0xFF,
                microsecondsPerQuarter & 0xFF
            ]
        });
        
        // Add instrument program change (GM Acoustic Grand Piano)
        trackEvents.push({
            deltaTime: 0,
            eventData: [0xC0, 0x00]  // Program change to instrument 0 (piano)
        });
        
        // Process each note in the melody
        let currentTick = 0;
        let allEvents = [];
        
        melody.forEach(noteObj => {
            // Convert duration from seconds to ticks
            const durationInTicks = Math.round(noteObj.duration * (bpm / 60) * this.TICKS_PER_QUARTER);
            
            if (noteObj.note !== "Pause") {
                // Convert note name to MIDI note number
                const midiNote = this.noteToMidi(noteObj.note);
                if (midiNote >= 0) {  // Skip invalid notes
                    // Add note-on event
                    allEvents.push({
                        tick: currentTick,
                        eventData: [0x90, midiNote, DEFAULT_VELOCITY]  // Note on, channel 0
                    });
                    
                    // Add note-off event
                    allEvents.push({
                        tick: currentTick + durationInTicks,
                        eventData: [0x80, midiNote, 0x00]  // Note off, channel 0
                    });
                }
            }
            
            // Move time forward
            currentTick += durationInTicks;
        });
        
        // Sort all events by tick
        allEvents.sort((a, b) => a.tick - b.tick);
        
        // Convert absolute ticks to delta times
        let lastTick = 0;
        allEvents.forEach(event => {
            const deltaTime = event.tick - lastTick;
            event.deltaTime = deltaTime;
            lastTick = event.tick;
            
            // Add to track events
            trackEvents.push({
                deltaTime: event.deltaTime,
                eventData: event.eventData
            });
        });
        
        // Add end of track meta event
        trackEvents.push({
            deltaTime: 0,
            eventData: [0xFF, 0x2F, 0x00]  // End of track
        });
        
        // Convert track events to bytes
        const trackData = [];
        trackEvents.forEach(event => {
            const deltaTimeBytes = this.encodeVariableLengthQuantity(event.deltaTime);
            trackData.push(...deltaTimeBytes, ...event.eventData);
        });
        
        // Create track chunk header
        const trackChunkHeader = [
            0x4D, 0x54, 0x72, 0x6B,  // MTrk
            (trackData.length >> 24) & 0xFF,
            (trackData.length >> 16) & 0xFF,
            (trackData.length >> 8) & 0xFF,
            trackData.length & 0xFF
        ];
        
        // Combine everything into a single array
        const midiData = new Uint8Array([
            ...headerChunk,
            ...trackChunkHeader,
            ...trackData
        ]);
        
        return midiData;
    }
    
    /**
     * Encode a number as MIDI variable-length quantity
     * @param {number} value - The number to encode
     * @return {Array} Variable-length quantity bytes
     */
    static encodeVariableLengthQuantity(value) {
        if (value < 0) value = 0;
        
        const buffer = [];
        let v = value;
        
        // Extract 7-bit chunks until value is 0
        do {
            let b = v & 0x7F;
            v >>= 7;
            if (buffer.length > 0) b |= 0x80; // Set continuation bit
            buffer.unshift(b);
        } while (v > 0);
        
        return buffer;
    }
}

export { MidiUtils };

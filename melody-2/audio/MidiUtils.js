/**
 * MidiUtils - Utility class for MIDI file creation
 */
class MidiUtils {

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
        // Constants for MIDI file format
        const HEADER_CHUNK_ID = [0x4D, 0x54, 0x68, 0x64];  // "MThd"
        const HEADER_CHUNK_SIZE = [0x00, 0x00, 0x00, 0x06]; // Header size (6 bytes)
        const FORMAT_TYPE = [0x00, 0x00]; // Format 0 (single track)
        const NUMBER_OF_TRACKS = [0x00, 0x01]; // One track
        const TIME_DIVISION = [0x01, 0xE0]; // 480 ticks per quarter note
        
        const TRACK_CHUNK_ID = [0x4D, 0x54, 0x72, 0x6B]; // "MTrk"
        // Track chunk size (placeholder, will be filled later)
        const TRACK_CHUNK_SIZE = [0x00, 0x00, 0x00, 0x00];
        
        // Calculate tempo in microseconds per quarter note
        const tempoMicroseconds = Math.round(60000000 / bpm);
        const setTempo = [
            0x00, // Delta time
            0xFF, // Meta event
            0x51, // Tempo
            0x03, // Length
            // Tempo value (3 bytes)
            (tempoMicroseconds >> 16) & 0xFF,
            (tempoMicroseconds >> 8) & 0xFF,
            tempoMicroseconds & 0xFF
        ];
        
        // Set up MIDI channel and instrument
        const setInstrument = [
            0x00, // Delta time
            0xC0, // Program change
            0x00  // Instrument (0 = Acoustic Grand Piano)
        ];
        
        // End of track marker
        const endOfTrack = [0x00, 0xFF, 0x2F, 0x00];
        
        // Build track events
        let trackEvents = [];
        trackEvents = trackEvents.concat(setTempo, setInstrument);
        
        let currentTime = 0; // Current time in ticks
        const TICKS_PER_QUARTER = 480;
        
        melody.forEach(note => {
            const midiNote = this.noteToMidi(note.note);
            
            // Skip invalid notes
            if (midiNote === -1 && note.note !== "Pause") return;
            
            // Calculate note duration in ticks
            // Quarter note = 480 ticks at the defined BPM
            const durationInBeats = note.duration / (60 / bpm);
            const durationInTicks = Math.round(durationInBeats * TICKS_PER_QUARTER);
            
            // For valid notes, add Note On and Note Off events
            if (midiNote !== -1) {
                // Note On event
                const noteOnEvent = [
                    0x00, // Delta time (will be encoded)
                    0x90, // Note On, channel 0
                    midiNote, // Note number
                    0x64 // Velocity (100 - medium loud)
                ];
                
                // Note Off event
                const noteOffEvent = [
                    0x00, // Delta time (will be encoded)
                    0x80, // Note Off, channel 0
                    midiNote, // Note number
                    0x00 // Velocity (0)
                ];
                
                // Set delta time for Note On (could be after a pause)
                noteOnEvent[0] = this.encodeVariableLengthQuantity(currentTime);
                trackEvents = trackEvents.concat(noteOnEvent);
                
                // Set next time point
                currentTime = durationInTicks;
                
                // Set delta time for Note Off (time since Note On)
                noteOffEvent[0] = this.encodeVariableLengthQuantity(currentTime);
                trackEvents = trackEvents.concat(noteOffEvent);
                
                // Reset current time since we've used it
                currentTime = 0;
            } else {
                // For pauses, just accumulate time
                currentTime += durationInTicks;
            }
        });
        
        // Add end of track marker
        trackEvents = trackEvents.concat(endOfTrack);
        
        // Calculate track chunk size
        const trackLength = trackEvents.length;
        TRACK_CHUNK_SIZE[3] = trackLength & 0xFF;
        TRACK_CHUNK_SIZE[2] = (trackLength >> 8) & 0xFF;
        TRACK_CHUNK_SIZE[1] = (trackLength >> 16) & 0xFF;
        TRACK_CHUNK_SIZE[0] = (trackLength >> 24) & 0xFF;
        
        // Combine all chunks
        const midiData = HEADER_CHUNK_ID.concat(
            HEADER_CHUNK_SIZE,
            FORMAT_TYPE,
            NUMBER_OF_TRACKS,
            TIME_DIVISION,
            TRACK_CHUNK_ID,
            TRACK_CHUNK_SIZE,
            trackEvents
        );
        
        return new Uint8Array(midiData);
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

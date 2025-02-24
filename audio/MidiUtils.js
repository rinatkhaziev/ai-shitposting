class MidiUtils {
    static noteToMidiNumber(noteName) {
        if (noteName === "Pause") return -1;
        
        const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = parseInt(noteName.slice(-1));
        const note = noteName.slice(0, -1);
        const noteIndex = noteStrings.indexOf(note);
        return noteIndex + 12 * (octave + 1);
    }

    static melodyToMidi(melody, bpm) {
        // MIDI format: https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf
        let trackLength = melody.reduce((sum, note) => sum + note.duration, 0);
        
        // MIDI header
        const header = [
            0x4D, 0x54, 0x68, 0x64, // MThd
            0x00, 0x00, 0x00, 0x06, // Header length
            0x00, 0x00, // Format type 0
            0x00, 0x01, // One track
            0x00, 0x60  // 96 ticks per quarter note
        ];

        // Track header
        const trackHeader = [
            0x4D, 0x54, 0x72, 0x6B // MTrk
        ];

        // Set tempo (convert BPM to microseconds per quarter note)
        const tempo = Math.round(60000000 / bpm);
        const tempoEvent = [
            0x00, // Delta time
            0xFF, 0x51, 0x03, // Tempo meta event
            (tempo >> 16) & 0xFF,
            (tempo >> 8) & 0xFF,
            tempo & 0xFF
        ];

        // Convert notes to MIDI events
        let events = [];
        let time = 0;
        
        melody.forEach(note => {
            const midiNote = this.noteToMidiNumber(note.note);
            if (midiNote >= 0) {
                // Note on
                events.push({
                    deltaTime: Math.round(time * 96), // Convert to MIDI ticks
                    event: [0x90, midiNote, 0x64] // Note on, note number, velocity
                });
                
                // Note off
                events.push({
                    deltaTime: Math.round((time + note.duration) * 96),
                    event: [0x80, midiNote, 0x00] // Note off, note number, velocity
                });
            }
            time += note.duration;
        });

        // Sort events by time and convert to delta times
        events.sort((a, b) => a.deltaTime - b.deltaTime);
        let lastTime = 0;
        events = events.map(evt => {
            const delta = evt.deltaTime - lastTime;
            lastTime = evt.deltaTime;
            return { deltaTime: delta, event: evt.event };
        });

        // Convert events to bytes
        const trackData = events.flatMap(evt => {
            return [...this.variableLengthQuantity(evt.deltaTime), ...evt.event];
        });

        // End of track event
        const endOfTrack = [0x00, 0xFF, 0x2F, 0x00];

        // Calculate track length
        trackLength = trackData.length + tempoEvent.length + endOfTrack.length;

        // Combine all parts
        const midi = [
            ...header,
            ...trackHeader,
            (trackLength >> 24) & 0xFF,
            (trackLength >> 16) & 0xFF,
            (trackLength >> 8) & 0xFF,
            trackLength & 0xFF,
            ...tempoEvent,
            ...trackData,
            ...endOfTrack
        ];

        return new Uint8Array(midi);
    }

    static variableLengthQuantity(value) {
        if (value === 0) return [0];
        
        const bytes = [];
        while (value > 0) {
            bytes.unshift(value & 0x7F);
            value = value >> 7;
        }
        
        // Set continuation bits
        for (let i = 0; i < bytes.length - 1; i++) {
            bytes[i] |= 0x80;
        }
        
        return bytes;
    }
}

export { MidiUtils };

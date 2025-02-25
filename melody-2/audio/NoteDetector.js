class NoteDetector {
    constructor(options = {}) {
        this.noteBuffer = [];
        this.bufferSize = options.bufferSize || 5;
        this.minDuration = options.minDuration || 0.1; // minimum note duration in seconds
        this.lastNote = null;
        this.lastNoteTime = null;
        this.frequencyBuffer = [];
        
        // Note transition thresholds
        this.minNoteConfidence = 0.7; // 70% of buffer must be same note
        this.vibratoCents = 50; // maximum cents deviation for vibrato detection
    }

    // Convert frequency to MIDI note number
    static frequencyToMIDI(frequency) {
        return Math.round(12 * Math.log2(frequency / 440) + 69);
    }

    // Convert MIDI note to frequency
    static midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // Calculate cents deviation from perfect pitch
    static getCentsDeviation(frequency, midiNote) {
        const perfectFreq = this.midiToFrequency(midiNote);
        return 1200 * Math.log2(frequency / perfectFreq);
    }

    // Add a new frequency reading to the buffer
    addFrequency(frequency, timestamp) {
        this.frequencyBuffer.push({ frequency, timestamp });
        if (this.frequencyBuffer.length > this.bufferSize) {
            this.frequencyBuffer.shift();
        }
        return this.detectNote();
    }

    // Main note detection logic
    detectNote() {
        if (this.frequencyBuffer.length < 2) return null;

        // Convert frequencies to MIDI notes
        const midiNotes = this.frequencyBuffer.map(f => ({
            midi: NoteDetector.frequencyToMIDI(f.frequency),
            timestamp: f.timestamp
        }));

        // Count occurrences of each note in buffer
        const noteCounts = midiNotes.reduce((acc, n) => {
            acc[n.midi] = (acc[n.midi] || 0) + 1;
            return acc;
        }, {});

        // Find the most common note
        const dominantNote = Object.entries(noteCounts)
            .reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0])[0];

        // Check if the note is stable enough
        const confidence = noteCounts[dominantNote] / this.bufferSize;
        if (confidence < this.minNoteConfidence) {
            return null;
        }

        // Check for vibrato by analyzing frequency variation
        const avgFreq = this.frequencyBuffer.reduce((sum, f) => sum + f.frequency, 0) / this.bufferSize;
        const maxDeviation = Math.max(...this.frequencyBuffer.map(f => 
            Math.abs(NoteDetector.getCentsDeviation(f.frequency, dominantNote))
        ));

        // If we detect vibrato, keep the previous note
        if (this.lastNote && maxDeviation <= this.vibratoCents) {
            return {
                midi: this.lastNote.midi,
                frequency: avgFreq,
                timestamp: this.frequencyBuffer[this.frequencyBuffer.length - 1].timestamp
            };
        }

        // Return new note
        return {
            midi: parseInt(dominantNote),
            frequency: avgFreq,
            timestamp: this.frequencyBuffer[this.frequencyBuffer.length - 1].timestamp
        };
    }

    reset() {
        this.noteBuffer = [];
        this.frequencyBuffer = [];
        this.lastNote = null;
        this.lastNoteTime = null;
    }
}

export { NoteDetector };

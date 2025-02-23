class FrequencyAnalyzer {
    constructor(options = {}) {
        this.smoothingBufferSize = options.smoothingBufferSize || 8;
        this.freqBuffer = [];
        this.noiseFloor = options.noiseFloor || -60; // dB
        // Update frequency limits for E2-C6 vocal range
        this.minFrequency = 82.4;   // E2
        this.maxFrequency = 1046.5; // C6
        this.minAmplitude = options.minAmplitude || 0.01;
        this.lastValidFrequency = null;
    }
    
    analyzePitch(audioData, sampleRate) {
        const frequencies = this.getFrequencies(audioData, sampleRate);
        const dominantFreq = this.findDominantFrequency(frequencies, sampleRate);
        
        if (!this.isAboveNoiseFloor(audioData) || 
            dominantFreq < this.minFrequency ||
            dominantFreq > this.maxFrequency) {
            return null;
        }
        
        return this.smoothFrequency(dominantFreq);
    }
    
    getFrequencies(audioData, sampleRate) {
        const fft = new Float32Array(audioData.length);
        // Implement FFT analysis here
        return fft;
    }
    
    findDominantFrequency(frequencies, sampleRate) {
        let maxAmp = 0;
        let maxIndex = 0;
        
        // Convert frequency limits to FFT bin indices
        const minBin = Math.floor(this.minFrequency * frequencies.length / sampleRate);
        const maxBin = Math.ceil(this.maxFrequency * frequencies.length / sampleRate);
        
        // Only look at frequencies within vocal range
        for (let i = minBin; i < Math.min(maxBin, frequencies.length / 2); i++) {
            const amp = Math.abs(frequencies[i]);
            if (amp > maxAmp) {
                maxAmp = amp;
                maxIndex = i;
            }
        }

        const frequency = (maxIndex * sampleRate) / frequencies.length;
        
        // Double-check frequency is within vocal range
        if (frequency < this.minFrequency || frequency > this.maxFrequency) {
            return null;
        }
        
        return frequency;
    }
    
    smoothFrequency(frequency) {
        // Remove outliers (more than 20% different from last valid frequency)
        if (this.lastValidFrequency !== null) {
            const maxDiff = this.lastValidFrequency * 0.2;
            if (Math.abs(frequency - this.lastValidFrequency) > maxDiff) {
                return this.lastValidFrequency;
            }
        }

        this.freqBuffer.push(frequency);
        if (this.freqBuffer.length > this.smoothingBufferSize) {
            this.freqBuffer.shift();
        }

        // Use median filtering to reject outliers
        const sorted = [...this.freqBuffer].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        this.lastValidFrequency = median;
        return median;
    }
    
    isAboveNoiseFloor(audioData) {
        const rms = Math.sqrt(
            audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length
        );
        
        // Check both RMS amplitude and dB threshold
        if (rms < this.minAmplitude) return false;
        
        const db = 20 * Math.log10(rms);
        return db > this.noiseFloor;
    }
}

export { FrequencyAnalyzer };

class FrequencyAnalyzer {
    constructor(options = {}) {
        this.smoothingBufferSize = options.smoothingBufferSize || 8;
        this.freqBuffer = [];
        this.noiseFloor = options.noiseFloor || -70; // Lowered from -60 to be more sensitive
        // Update frequency limits for E2-C6 vocal range
        this.minFrequency = 82.4;   // E2
        this.maxFrequency = 1046.5; // C6
        this.minAmplitude = options.minAmplitude || 0.005; // Lowered from 0.01
        this.lastValidFrequency = null;
    }
    
    analyzePitch(audioData, sampleRate, frequencyData = null) {
        if (!this.isAboveNoiseFloor(audioData)) {
            this.lastValidFrequency = null; // Reset on silence
            return null;
        }

        let dominantFreq;
        if (frequencyData) {
            dominantFreq = this.findDominantFrequency(frequencyData, sampleRate);
        } else {
            const frequencies = this.getFrequencies(audioData, sampleRate);
            dominantFreq = this.findDominantFrequency(frequencies, sampleRate);
        }

        if (dominantFreq === null) {
            return this.lastValidFrequency; // Return last valid frequency instead of null
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
            const amp = frequencies[i];
            if (amp > maxAmp) {
                maxAmp = amp;
                maxIndex = i;
            }
        }

        // Require minimum amplitude for valid detection
        if (maxAmp < this.minAmplitude) {
            return null;
        }

        const frequency = (maxIndex * sampleRate) / (frequencies.length * 2);
        
        // Double-check frequency is within vocal range
        if (frequency < this.minFrequency || frequency > this.maxFrequency) {
            return null;
        }
        
        return frequency;
    }
    
    smoothFrequency(frequency) {
        // Relaxed outlier detection (30% instead of 20%)
        if (this.lastValidFrequency !== null) {
            const maxDiff = this.lastValidFrequency * 0.3;
            if (Math.abs(frequency - this.lastValidFrequency) > maxDiff) {
                return this.lastValidFrequency;
            }
        }

        this.freqBuffer.push(frequency);
        if (this.freqBuffer.length > this.smoothingBufferSize) {
            this.freqBuffer.shift();
        }

        // Use weighted average instead of median
        const sum = this.freqBuffer.reduce((acc, val) => acc + val, 0);
        const avg = sum / this.freqBuffer.length;
        
        this.lastValidFrequency = avg;
        return avg;
    }
    
    isAboveNoiseFloor(audioData) {
        const rms = Math.sqrt(
            audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length
        );
        
        // Only use RMS amplitude check if it's very quiet
        if (rms < this.minAmplitude / 2) return false;
        
        const db = 20 * Math.log10(rms);
        return db > this.noiseFloor || rms > this.minAmplitude;
    }
}

export { FrequencyAnalyzer };

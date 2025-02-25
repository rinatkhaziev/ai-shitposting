class FrequencyAnalyzer {
    constructor(options = {}) {
        // Analysis configuration
        this.minFrequency = options.minFrequency || 82.4;  // E2 (~82.4 Hz)
        this.maxFrequency = options.maxFrequency || 1047;  // C6 (~1047 Hz)
        this.noiseFloor = options.noiseFloor || -70;       // dB threshold for silence
        this.peakThreshold = options.peakThreshold || 0.75; // Relative threshold for peak detection
        
        // Smoothing configuration
        this.smoothingFactor = options.smoothingFactor || 0.6; // Balance between stability and responsiveness
        this.previousFrequencies = [];
        this.bufferSize = options.bufferSize || 5; // Size of smoothing buffer
        
        // Internal state
        this.lastValidFrequency = null;
        
        // Frequency calibration factor - critical for accurate detection
        this.calibrationFactor = options.calibrationFactor || 1; // Slight adjustment to match true frequencies
    }
    
    analyzePitch(audioData, sampleRate, frequencyData = null) {
        // Check if audio is above noise floor
        if (!this.isAboveNoiseFloor(audioData)) {
            return null;
        }

        // Get frequency spectrum data
        const frequencies = this.getFrequencies(audioData, sampleRate, frequencyData);
        
        // Find dominant frequency
        let frequency = this.findDominantFrequency(frequencies, sampleRate);
        
        // Apply frequency constraints
        if (frequency !== null && (frequency < this.minFrequency || frequency > this.maxFrequency)) {
            frequency = null;
        }
        
        // Apply smoothing to reduce jitter
        if (frequency !== null) {
            frequency = this.smoothFrequency(frequency);
            this.lastValidFrequency = frequency;
        }
        
        return frequency;
    }
    
    getFrequencies(audioData, sampleRate, frequencyData = null) {
        // If frequency data is already provided (from an analyser node), use it
        if (frequencyData && frequencyData.length) {
            return frequencyData;
        }
        
        // Apply windowing to reduce spectral leakage
        const windowedData = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            // Apply Hann window
            const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (audioData.length - 1)));
            windowedData[i] = audioData[i] * windowValue;
        }
        
        // For time domain methods, compute autocorrelation
        const minPeriod = Math.floor(sampleRate / this.maxFrequency);
        const maxPeriod = Math.ceil(sampleRate / this.minFrequency);
        const correlations = new Float32Array(maxPeriod);
        
        // Compute normalized autocorrelation
        let sumSquares = 0;
        for (let i = 0; i < windowedData.length; i++) {
            sumSquares += windowedData[i] * windowedData[i];
        }
        
        for (let lag = minPeriod; lag < maxPeriod; lag++) {
            let sum = 0;
            for (let i = 0; i < windowedData.length - lag; i++) {
                sum += windowedData[i] * windowedData[i + lag];
            }
            // Normalize (crucial for accurate peak detection)
            correlations[lag] = sum / sumSquares;
        }
        
        return correlations;
    }
    
    findDominantFrequency(frequencies, sampleRate) {
        if (frequencies.length > 1000) {
            // This is probably FFT data
            return this.findFrequencyFromFFT(frequencies, sampleRate);
        } else {
            // This is probably autocorrelation data
            return this.findFrequencyFromAutocorrelation(frequencies, sampleRate);
        }
    }
    
    findFrequencyFromFFT(frequencies, sampleRate) {
        const nyquist = sampleRate / 2;
        const binSize = nyquist / (frequencies.length - 1);
        
        // Find the range of bins that correspond to our frequency range
        const minBin = Math.max(2, Math.floor(this.minFrequency / binSize));
        const maxBin = Math.min(frequencies.length - 1, Math.ceil(this.maxFrequency / binSize));
        
        let maxVal = -Infinity;
        let maxIndex = -1;
        
        // Simple peak finding in the relevant range
        for (let i = minBin; i <= maxBin; i++) {
            if (frequencies[i] > maxVal) {
                maxVal = frequencies[i];
                maxIndex = i;
            }
        }
        
        if (maxIndex !== -1) {
            // Quadratic interpolation for better precision
            // Only if we're not at the edges of our spectrum
            if (maxIndex > 0 && maxIndex < frequencies.length - 1) {
                const y1 = frequencies[maxIndex - 1];
                const y2 = frequencies[maxIndex];
                const y3 = frequencies[maxIndex + 1];
                
                // Only apply interpolation if we have a clear peak
                if (y2 > y1 && y2 > y3) {
                    // Quadratic interpolation formula
                    const refinedBin = maxIndex + 0.5 * (y1 - y3) / (y1 - 2*y2 + y3);
                    return refinedBin * binSize * this.calibrationFactor;
                }
            }
            
            // Return direct bin-to-frequency conversion
            return maxIndex * binSize * this.calibrationFactor;
        }
        
        return null;
    }
    
    findFrequencyFromAutocorrelation(correlations, sampleRate) {
        // Skip the first few bins to avoid false peaks from the zero lag
        const skipBins = Math.min(30, correlations.length / 8);
        
        // Find the maximum peak in the correlation
        let maxCorrelation = -Infinity;
        let maxLag = -1;
        
        for (let lag = skipBins; lag < correlations.length; lag++) {
            // Check if this is a local maximum
            if (lag > skipBins && lag < correlations.length - 1) {
                if (correlations[lag] > correlations[lag - 1] && 
                    correlations[lag] >= correlations[lag + 1] && 
                    correlations[lag] > maxCorrelation) {
                    
                    maxCorrelation = correlations[lag];
                    maxLag = lag;
                }
            }
        }
        
        // Verify we found a meaningful peak
        if (maxLag <= 0 || maxCorrelation < 0.2) {
            return null;
        }
        
        // Refine the peak location by interpolation
        // Using parabolic interpolation for sub-sample accuracy
        const y1 = correlations[maxLag - 1];
        const y2 = correlations[maxLag];
        const y3 = correlations[maxLag + 1];
        
        // Refined lag calculation with parabolic interpolation
        const refinedLag = maxLag + 0.5 * (y1 - y3) / (y1 - 2*y2 + y3);
        
        // Convert lag to frequency (Hz)
        return sampleRate / refinedLag * this.calibrationFactor;
    }
    
    smoothFrequency(frequency) {
        // Add current frequency to history buffer
        this.previousFrequencies.push(frequency);
        
        // Keep buffer at desired size
        while (this.previousFrequencies.length > this.bufferSize) {
            this.previousFrequencies.shift();
        }
        
        // Simple median filter to remove outliers
        if (this.previousFrequencies.length >= 3) {
            const sortedFreqs = [...this.previousFrequencies].sort((a, b) => a - b);
            const median = sortedFreqs[Math.floor(sortedFreqs.length / 2)];
            
            // Only use median if current frequency is a significant outlier
            // Using 8% threshold for more reliable results
            if (Math.abs(frequency / median - 1) > 0.08) {
                frequency = median;
            }
        }
        
        // Apply exponential smoothing using smoothingFactor
        if (this.lastValidFrequency !== null) {
            frequency = this.lastValidFrequency * this.smoothingFactor + 
                        frequency * (1 - this.smoothingFactor);
        }
        
        return frequency;
    }
    
    isAboveNoiseFloor(audioData) {
        // Calculate RMS (Root Mean Square) amplitude
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);
        
        // Convert to decibels (avoid log of zero)
        const db = 20 * Math.log10(Math.max(rms, 1e-10));
        
        // Compare with noise floor threshold
        return db > this.noiseFloor;
    }
}

export { FrequencyAnalyzer };

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
        
        // New properties for improved detection
        this.harmonicWeighting = options.harmonicWeighting || 0.8; // Weight for harmonic detection (0-1)
        this.maxOctaveJump = options.maxOctaveJump || 2; // Maximum allowed octave jump
        this.contextWeight = options.contextWeight || 0.3; // Weight for context in decision making
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
        
        // Find all significant peaks in the spectrum
        const peaks = this.findSpectralPeaks(frequencies, minBin, maxBin, binSize);
        
        // If no peaks found, return null
        if (peaks.length === 0) return null;
        
        // Analyze harmonic relationships between peaks
        const fundamentalCandidate = this.analyzeFundamentalFrequency(peaks, binSize, frequencies);
        
        // Apply context-aware filtering
        return this.applyContextFilter(fundamentalCandidate);
    }
    
    findFrequencyFromAutocorrelation(correlations, sampleRate) {
        // Skip the first few bins to avoid false peaks from the zero lag
        const skipBins = Math.min(30, correlations.length / 8);
        
        // Find multiple peaks in the correlation
        const peaks = [];
        for (let lag = skipBins; lag < correlations.length - 1; lag++) {
            // Check if this is a local maximum
            if (lag > skipBins && 
                correlations[lag] > correlations[lag - 1] && 
                correlations[lag] >= correlations[lag + 1] && 
                correlations[lag] > 0.2) { // Minimum correlation threshold
                
                // Refine peak with parabolic interpolation
                const y1 = correlations[lag - 1];
                const y2 = correlations[lag];
                const y3 = correlations[lag + 1];
                
                // Refined lag calculation with parabolic interpolation
                const refinedLag = lag + 0.5 * (y1 - y3) / (y1 - 2*y2 + y3);
                
                peaks.push({
                    lag: refinedLag,
                    frequency: sampleRate / refinedLag,
                    strength: correlations[lag]
                });
            }
        }
        
        // If no peaks found, return null
        if (peaks.length === 0) return null;
        
        // Sort peaks by strength
        peaks.sort((a, b) => b.strength - a.strength);
        
        // Check for subharmonics (common issue in autocorrelation)
        // The true fundamental might not be the strongest peak
        const candidates = [];
        
        // Add the strongest peak as a candidate
        candidates.push({
            frequency: peaks[0].frequency * this.calibrationFactor,
            score: peaks[0].strength
        });
        
        // Check if there are peaks at integer multiples (potential true fundamentals)
        for (let i = 1; i < Math.min(peaks.length, 5); i++) {
            const ratio = peaks[0].lag / peaks[i].lag;
            const nearestInteger = Math.round(ratio);
            
            // If it's close to an integer ratio and within our frequency range
            if (Math.abs(ratio - nearestInteger) < 0.05 && 
                nearestInteger > 1 && nearestInteger <= 4) {
                
                const candidateFreq = peaks[i].frequency * this.calibrationFactor;
                if (candidateFreq >= this.minFrequency && candidateFreq <= this.maxFrequency) {
                    candidates.push({
                        frequency: candidateFreq,
                        score: peaks[i].strength * (1 + 0.1 * nearestInteger) // Boost score for potential fundamentals
                    });
                }
            }
        }
        
        // Sort candidates by score
        candidates.sort((a, b) => b.score - a.score);
        
        // Apply context filtering to the best candidate
        return this.applyContextFilter(candidates[0].frequency);
    }
    
    smoothFrequency(frequency) {
        // Add current frequency to history buffer
        this.previousFrequencies.push(frequency);
        
        // Keep buffer at desired size
        while (this.previousFrequencies.length > this.bufferSize) {
            this.previousFrequencies.shift();
        }
        
        // Enhanced outlier detection using median absolute deviation
        if (this.previousFrequencies.length >= 3) {
            const sortedFreqs = [...this.previousFrequencies].sort((a, b) => a - b);
            const median = sortedFreqs[Math.floor(sortedFreqs.length / 2)];
            
            // Calculate median absolute deviation
            const deviations = sortedFreqs.map(f => Math.abs(f - median));
            deviations.sort((a, b) => a - b);
            const mad = deviations[Math.floor(deviations.length / 2)];
            
            // Use a more robust outlier detection threshold based on MAD
            // 3 is a common threshold for outlier detection
            const threshold = 3 * mad / 0.6745; // Normalized MAD (0.6745 is a constant for normal distribution)
            
            if (Math.abs(frequency - median) > threshold) {
                frequency = median;
            }
        }
        
        // Apply adaptive exponential smoothing
        // Use less smoothing when frequency is stable, more when it's changing rapidly
        if (this.lastValidFrequency !== null) {
            const changeRatio = Math.abs(frequency / this.lastValidFrequency - 1);
            
            // Adapt smoothing factor based on stability
            const adaptiveFactor = changeRatio < 0.01 ? 
                Math.min(this.smoothingFactor + 0.1, 0.9) : // More smoothing when stable
                Math.max(this.smoothingFactor - 0.1, 0.3);  // Less smoothing when changing
            
            frequency = this.lastValidFrequency * adaptiveFactor + 
                        frequency * (1 - adaptiveFactor);
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
    
    findSpectralPeaks(frequencies, minBin, maxBin, binSize) {
        const peaks = [];
        const peakThreshold = Math.max(...frequencies.slice(minBin, maxBin + 1)) * this.peakThreshold;
        
        // Find all peaks above threshold
        for (let i = minBin + 1; i < maxBin; i++) {
            if (frequencies[i] > peakThreshold && 
                frequencies[i] > frequencies[i-1] && 
                frequencies[i] >= frequencies[i+1]) {
                
                // Refine peak position with quadratic interpolation
                let refinedBin = i;
                if (i > 0 && i < frequencies.length - 1) {
                    const y1 = frequencies[i - 1];
                    const y2 = frequencies[i];
                    const y3 = frequencies[i + 1];
                    
                    if (y2 > y1 && y2 > y3) {
                        refinedBin = i + 0.5 * (y1 - y3) / (y1 - 2*y2 + y3);
                    }
                }
                
                peaks.push({
                    bin: refinedBin,
                    frequency: refinedBin * binSize,
                    magnitude: frequencies[i]
                });
            }
        }
        
        // Sort peaks by magnitude (strongest first)
        return peaks.sort((a, b) => b.magnitude - a.magnitude);
    }
    
    analyzeFundamentalFrequency(peaks, binSize, frequencies) {
        if (peaks.length === 0) return null;
        
        // If only one peak, it's our best guess
        if (peaks.length === 1) {
            return peaks[0].frequency * this.calibrationFactor;
        }
        
        // Score each peak as a potential fundamental frequency
        const candidates = peaks.map(peak => {
            const fundamentalFreq = peak.frequency;
            let harmonicScore = 0;
            let expectedHarmonics = 0;
            
            // Check for presence of harmonics (2f, 3f, 4f, etc.)
            for (let harmonic = 2; harmonic <= 5; harmonic++) {
                const harmonicFreq = fundamentalFreq * harmonic;
                if (harmonicFreq < this.maxFrequency) {
                    expectedHarmonics++;
                    
                    // Find closest peak to expected harmonic
                    const harmonicBin = harmonicFreq / binSize;
                    const closestPeak = peaks.find(p => 
                        Math.abs(p.bin - harmonicBin) < 0.05 * harmonic // Allow wider tolerance for higher harmonics
                    );
                    
                    if (closestPeak) {
                        // Add to score based on how close it is to expected harmonic
                        const deviation = Math.abs(closestPeak.frequency / fundamentalFreq - harmonic);
                        harmonicScore += (1 - Math.min(deviation, 0.1) * 10) * (1 / harmonic); // Weight lower harmonics more
                    }
                }
            }
            
            // Normalize score based on expected harmonics
            const normalizedScore = expectedHarmonics > 0 ? harmonicScore / expectedHarmonics : 0;
            
            // Final score combines peak magnitude and harmonic pattern
            const finalScore = (1 - this.harmonicWeighting) * (peak.magnitude / peaks[0].magnitude) + 
                              this.harmonicWeighting * normalizedScore;
            
            return {
                frequency: fundamentalFreq * this.calibrationFactor,
                score: finalScore
            };
        });
        
        // Return the frequency with the highest score
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].frequency;
    }
    
    applyContextFilter(frequency) {
        if (frequency === null) return null;
        
        // If this is the first valid frequency, just return it
        if (this.lastValidFrequency === null) return frequency;
        
        // Check for octave jumps
        const ratio = frequency / this.lastValidFrequency;
        const octaveJump = Math.abs(Math.log2(ratio));
        
        // If jump is too large, be skeptical of the new frequency
        if (octaveJump > this.maxOctaveJump) {
            // Check if it's a harmonic or subharmonic of the last frequency
            const harmonicRatio = ratio > 1 ? ratio : 1/ratio;
            const nearestInteger = Math.round(harmonicRatio);
            
            // If it's close to an integer ratio, it might be a harmonic/subharmonic
            if (Math.abs(harmonicRatio - nearestInteger) < 0.05 && nearestInteger <= 4) {
                // It's likely a harmonic/subharmonic - decide which one to keep
                // For now, prefer the original frequency for stability
                return this.lastValidFrequency;
            }
            
            // Otherwise, it's likely an error - blend with previous value
            return this.lastValidFrequency * (1 - this.contextWeight) + frequency * this.contextWeight;
        }
        
        return frequency;
    }
}

export { FrequencyAnalyzer };

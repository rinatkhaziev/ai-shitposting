# Melody Hummer

A web application that allows users to record melodies by humming or playing an instrument, then download them as MIDI or JSON files. The app features real-time pitch detection, note visualization, and melody quantization.

## Features

- Real-time pitch detection and note recognition
- Visual feedback for pitch accuracy
- Waveform visualization
- BPM control for melody quantization
- Export to MIDI and JSON formats
- Local storage for saved melodies
- Support for vocal range E2-C6 (~82.4 Hz to ~1047 Hz)

## How It Works

### Core Components

1. **FrequencyAnalyzer** (`audio/FrequencyAnalyzer.js`)
   - Handles raw audio processing
   - Performs FFT analysis
   - Implements noise floor detection
   - Provides fundamental frequency detection

2. **NoteDetector** (`audio/NoteDetector.js`)
   - Converts frequencies to musical notes
   - Implements note smoothing and stability
   - Handles vibrato detection
   - Manages note transitions

3. **Main Application** (`app.js`)
   - Coordinates audio input and processing
   - Manages UI updates
   - Handles melody recording and storage
   - Implements melody visualization and export

### Technical Details

#### Pitch Detection Process

1. Audio input is captured using Web Audio API
2. Raw audio data is analyzed in both time and frequency domains
3. Fundamental frequency is extracted using FFT analysis
4. Frequency is converted to musical note with cent deviation
5. Notes are smoothed and filtered for stability

#### Note Detection Features

- **Vibrato Detection**: Allows for natural pitch variation within ±50 cents
- **Hysteresis**: Prevents rapid note changes due to pitch instability
- **Minimum Duration**: Notes shorter than 100ms are filtered out
- **Noise Floor**: Ignores input below -70dB

#### Melody Recording

- Notes are recorded with precise timing information
- Pauses are detected and included in the melody
- Leading and trailing silences are automatically trimmed
- Melodies are quantized to musical grid (configurable resolution)

## Usage

1. Open `melody-second-gen.html` in a web browser
2. Allow microphone access when prompted
3. Set desired BPM (default: 120)
4. Click "Start Recording" and sing or play your melody
5. Click "Stop Recording" when finished
6. View recorded melody in the grid view
7. Download as MIDI or JSON file
8. Optionally clear stored melodies using the "Clear Stored Melodies" button

## Implementation Notes

- Uses modern Web Audio API features
- Implements efficient FFT-based frequency analysis
- Stores melodies in browser's localStorage
- Quantizes notes to musical grid for MIDI export
- Provides visual feedback for pitch accuracy

## Requirements

- Modern web browser with Web Audio API support
- Microphone access
- JavaScript enabled

## Technical Limitations

- Minimum detectable frequency: 82.4 Hz (E2)
- Maximum detectable frequency: 1047 Hz (C6)
- Minimum note duration: 100ms
- Pitch detection latency: ~50ms
- Browser support: Chrome, Firefox, Safari (latest versions)

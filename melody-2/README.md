# WHAT

This is the second attempt, a from-scratch rewrite. I will amend this section as I progress on this mystery journey.

I can't decide whether it should be a journal or not, but let me tell you a short story in the mean time.

I started with o3-mini. And in my experience its code is hot garbage, something that you'd probably see from a junior-to-medium engineer or from an engineer who may know their shit but don't care about anything as long as it "works". The problem is it didn't work entirely. I've gotten myself in loops where I'd ask to generate the code behaving in a specific way, then point out the bugs, receive different code which would still be not working.

Mid-project I switched to Sonnet 3.5 - it did a bunch of refactoring, abstractions, UI cleanup, implemented somewhat working MIDI functionality, but fundamentally it had frequency detection issues which I was debugging and fighting for proper code. We made (me and Sonnet, that is) slow progress.

While I was doing that, Anthropic dropped 3.7. I've been using it for an hour (at the moment of writing of this readme), and we have finally resolved the issues around frequency detection and now I got consistent results. There's still a slight mismatch between emitted reference frequency and detected frequency, e.g. A3 at 440 Hz would be detected at 439 Hz, but it's much closer than previous discrepancies resulting in half-tone mismatches. It's likely this is the most complex part of the implementation, but it's done.

The other complex part is actually recording accurate melody by accounting for things like vibrato or inconsistencies in rhythm. It kinda-sorta used to work in o3-mini/Sonnet version, but barely (midi files were playable but the timing went out of the window), but Sonnet 3.7 refactor (I asked to fix the frequency detection but it also gave me UI facelift and helpfully broken midi stuff) totally broke that. Whatever. We'll get there. Eventually.

# Setup Instructions

Since this version uses JS modules it requires a server, quick and dirty (also generated via prompt)

```sh
docker run -d --name my-nginx -p 8000:80 -v "$(pwd)":/usr/share/nginx/html:ro nginx
```

Then visit http://localhost:8000/melody-2/melody-second-gen.html


The below readme is generated in Sonnet 3.5, and re-generated in Sonnet 3.7. Will be periodically updated.

=============

# Melody Hummer

A web application that allows users to record melodies by humming or playing an instrument, then download them as MIDI or JSON files. The app features real-time pitch detection, note visualization, and melody storage.

## Features

- Real-time pitch detection and note recognition
- Visual feedback for pitch accuracy with deviation bar
- Waveform visualization of audio input
- BPM control for melody quantization
- Export melodies to MIDI and JSON formats
- Local storage for saving melodies
- Support for vocal range E2-C6 (~82.4 Hz to ~1047 Hz)
- Pause detection between notes

## Architecture

### Core Components

1. **FrequencyAnalyzer** (`audio/FrequencyAnalyzer.js`)
   - Analyses raw audio data to detect fundamental frequency
   - Implements both time-domain (autocorrelation) and frequency-domain (FFT) methods
   - Features noise floor detection and signal filtering
   - Applies smoothing to reduce jitter in frequency detection

2. **NoteDetector** (`audio/NoteDetector.js`)
   - Converts detected frequencies to musical notes
   - Buffers notes to ensure stability in detection
   - Handles vibrato detection with configurable tolerance
   - Tracks note transitions with timing information

3. **Main Application** (`app.js`)
   - Manages audio input via Web Audio API
   - Coordinates the pitch detection pipeline
   - Updates the UI with real-time feedback
   - Handles recording, storage, and playback of melodies

## Technical Details

### Pitch Detection Process

1. Audio is captured from the microphone using the Web Audio API
2. The signal is processed through both time-domain and frequency-domain analysis
3. The fundamental frequency is extracted with advanced peak detection algorithms
4. Frequencies are converted to musical notes with cent deviation calculation
5. Notes are buffered and smoothed for stable detection

### Advanced Features

- **Calibration Factor**: Fine-tuning of frequency detection for better accuracy
- **Adaptive Noise Floor**: Automatically adjusts to ambient noise levels
- **Vibrato Detection**: Distinguishes between note changes and vibrato (±50 cents)
- **Smoothing**: Uses both median filtering and exponential smoothing
- **Quantization**: Aligns notes to a musical grid based on BPM

### Melody Recording

- Each note is recorded with precise timing and frequency information
- Pauses between notes are detected and recorded
- Notes shorter than a minimum duration are filtered out
- Leading and trailing silences are automatically trimmed

## Usage

1. Open the application in a web browser
2. Allow microphone access when prompted
3. Set your desired BPM (affects quantization)
4. Click "Start Recording" and sing or play your melody
5. Watch the real-time feedback as you perform
6. Click "Stop Recording" when finished
7. View your recorded melody in the grid visualization
8. Download as MIDI or JSON as needed
9. Previous melodies are stored locally and can be accessed anytime

## Browser Support

- Chrome (recommended for best performance)
- Firefox
- Safari (latest versions)
- Edge (Chromium-based)

## Technical Requirements

- Modern web browser with Web Audio API support
- Microphone access
- JavaScript enabled
- LocalStorage support for melody saving

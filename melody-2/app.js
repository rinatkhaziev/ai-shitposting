import { MidiUtils } from './audio/MidiUtils.js';
import { FrequencyAnalyzer } from './audio/FrequencyAnalyzer.js';
import { NoteDetector } from './audio/NoteDetector.js';

const VOCAL_RANGE = {
    MIN_NOTE: 'E2',  // ~82.4 Hz
    MAX_NOTE: 'C6',  // ~1047 Hz
    MIN_MIDI: 40,    // E2
    MAX_MIDI: 84     // C6
};

const TOLERANCE_DEFAULT = 35; // Reduced from 50 to be more strict with vocal pitch
let recording = false;
let audioContext, analyser, mediaStreamSource;
let tolerance = TOLERANCE_DEFAULT;
let BPM = 120; // Default BPM

// Add this at the very top (after any global constants)
let quantizationSetting = 16; // configurable: 4 = quarter, 8 = eighth, 16 = 16th note

// Melody tracking variables
let melody = [];
let lastDetectedNote = null;
let lastNoteStartTime = null;

// Add these new timing variables
let recordingStartTime = null;

// UI Elements: updated to match new current note box structure
const recordButton = document.getElementById('recordButton');
const currentNoteEl = document.getElementById('noteDisplay');
const deviationMarkerEl = document.getElementById('deviationMarker');
const melodyListEl = document.querySelector('#melodyList ul');

// New UI element and global variables for waveform display
const waveformDisplay = document.getElementById('waveformDisplay');
let waveformCanvas, waveformCtx;

// Add BPM control event listener
const bpmInput = document.getElementById('bpmInput');
if(bpmInput) {
    bpmInput.addEventListener('change', () => {
        BPM = Number(bpmInput.value) || 120;
    });
}

const frequencyAnalyzer = new FrequencyAnalyzer();

// Initialize waveform canvas
function initWaveform() {
    // Create and insert canvas into waveformDisplay container
    waveformCanvas = document.createElement('canvas');
    waveformCanvas.width = waveformDisplay.clientWidth - 20; // internal pixel resolution
    waveformCanvas.height = 100; // fixed height for waveform display
    // Removed inline styles; add CSS class instead:
    waveformCanvas.classList.add("waveform-canvas");
    
    waveformDisplay.innerHTML = ""; // clear placeholder text
    waveformDisplay.appendChild(waveformCanvas);
    waveformCtx = waveformCanvas.getContext("2d");
}

// Draw waveform using the audio buffer data
function drawWaveform(buffer) {
    if (!waveformCtx) return;
    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    waveformCtx.beginPath();
    let sliceWidth = waveformCanvas.width / buffer.length;
    let x = 0;
    for (let i = 0; i < buffer.length; i++) {
        // Normalize buffer value from [-1, 1] to [0, 1]
        let v = (buffer[i] + 1) / 2;
        let y = v * waveformCanvas.height;
        if (i === 0) {
            waveformCtx.moveTo(x, y);
        } else {
            waveformCtx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    waveformCtx.strokeStyle = "#4CAF50";
    waveformCtx.lineWidth = 2;
    waveformCtx.stroke();
}

// Initialize Audio and Pitch Detection
async function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;  // Reduced from 4096 for faster processing
    analyser.smoothingTimeConstant = 0.8;  // Add smoothing
    mediaStreamSource.connect(analyser);
    initWaveform();
    lastNoteStartTime = performance.now();
    processAudio();
}

// New global variable to track pause start time
let pauseStartTime = null;

// Add these timing-related constants near the top
const TICKS_PER_QUARTER = 480; // Standard MIDI resolution
const QUANTIZE_GRID = 16; // 16th note grid
const TICKS_PER_GRID = TICKS_PER_QUARTER / (QUANTIZE_GRID / 4);

// Add beat tracking variables
let beatStartTime = null;
let currentBeat = 0;

// New helper: Process a valid pitch detection.
function processDetectedPitch(pitch, now) {
    const noteInfo = frequencyToNoteInfo(pitch);
    
    if (!noteInfo) {
        processNoPitch(now);
        return;
    }

    // Update display
    currentNoteEl.textContent = `${noteInfo.note} (${pitch.toFixed(1)} Hz)`;
    updateDeviationBar(noteInfo.deviation);

    if (Math.abs(noteInfo.deviation) <= tolerance) {
        processValidPitch(noteInfo, now);
    } else {
        // If deviation is too high, treat as no valid pitch
        processNoPitch(now);
    }
}

// Updated helper: Process when no pitch is detected.
function processNoPitch(now) {
    if (lastEventTime && !pauseStartTime) {
        if (lastDetectedNote !== null) {
            const rawDuration = (now - lastNoteStartTime) / 1000;
            if (rawDuration >= noteDetector.minDuration) {
                const beatDuration = 60 / BPM;
                const startBeat = (lastNoteStartTime - beatStartTime) / 1000 / beatDuration;
                const endBeat = (now - beatStartTime) / 1000 / beatDuration;
                
                const quantizedStart = Math.round(startBeat * QUANTIZE_GRID / 4) * (4 / QUANTIZE_GRID);
                const quantizedEnd = Math.round(endBeat * QUANTIZE_GRID / 4) * (4 / QUANTIZE_GRID);
                
                melody.push({
                    note: lastDetectedNote,
                    rawDuration: rawDuration,
                    duration: (quantizedEnd - quantizedStart) * beatDuration,
                    quantizedStart: quantizedStart,
                    quantizedEnd: quantizedEnd,
                    timestamp: (lastNoteStartTime - recordingStartTime) / 1000,
                    frequency: lastDetectedFrequency
                });
            }
        }
        pauseStartTime = now;
        lastDetectedNote = null;
        lastDetectedFrequency = null;
    }
    
    currentNoteEl.textContent = "No pitch detected";
    updateDeviationBar(0);
}

// Updated helper: Process when a valid pitch is detected.
function processValidPitch(noteInfo, now) {
    if (!recordingStartTime) {
        recordingStartTime = now;
        beatStartTime = now;
    }

    const detectedNote = noteDetector.addFrequency(noteInfo.frequency, now);
    if (!detectedNote) return;

    // Calculate beat position
    const elapsedTime = (now - beatStartTime) / 1000; // seconds
    const beatDuration = 60 / BPM; // seconds per beat
    const currentBeatPosition = elapsedTime / beatDuration;
    
    // Quantize to grid
    const gridPosition = Math.round(currentBeatPosition * QUANTIZE_GRID / 4) * (4 / QUANTIZE_GRID);

    if (lastDetectedNote === null || lastDetectedNote !== noteInfo.note) {
        if (lastDetectedNote !== null) {
            // End previous note
            const rawDuration = (now - lastNoteStartTime) / 1000;
            if (rawDuration >= noteDetector.minDuration) {
                const startBeat = (lastNoteStartTime - beatStartTime) / 1000 / beatDuration;
                const quantizedStart = Math.round(startBeat * QUANTIZE_GRID / 4) * (4 / QUANTIZE_GRID);
                const quantizedDuration = gridPosition - quantizedStart;
                
                melody.push({
                    note: lastDetectedNote,
                    rawDuration: rawDuration,
                    duration: quantizedDuration * beatDuration, // Convert back to seconds
                    quantizedStart: quantizedStart,
                    quantizedEnd: gridPosition,
                    timestamp: (lastNoteStartTime - recordingStartTime) / 1000,
                    frequency: lastDetectedFrequency
                });
            }
        }
        
        lastDetectedNote = noteInfo.note;
        lastDetectedFrequency = noteInfo.frequency;
        lastNoteStartTime = now;
        pauseStartTime = null;
    }

    lastEventTime = now;
}

// Modified processAudio for better audio handling
function processAudio() {
    const now = performance.now();
    
    // Get audio data
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    
    // Visualize waveform
    drawWaveform(buffer);

    // Get frequency data for FFT
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);
    
    // Normalize frequency data (convert from dB to linear scale)
    for (let i = 0; i < frequencyData.length; i++) {
        frequencyData[i] = Math.pow(10, frequencyData[i] / 20);
    }

    // Use FrequencyAnalyzer with both time and frequency domain data
    const pitch = frequencyAnalyzer.analyzePitch(buffer, audioContext.sampleRate, frequencyData);

    // Process the detected pitch
    if (pitch !== null && !isNaN(pitch) && pitch > 0) {
        processDetectedPitch(pitch, now);
    } else {
        processNoPitch(now);
    }

    if (recording) {
        requestAnimationFrame(processAudio);
    }
}

// Updated buildGridView: use floor for quantized start and ceil for quantized end.
function buildGridView(events, bpm) {
    const gridContainer = document.createElement('div');
    gridContainer.className = "grid-container";
    const baseWidth = 40; // pixels per quarter beat
    const quarterBeatDuration = 60 / bpm;
    const quantStep = quarterBeatDuration * (4 / quantizationSetting);
    let currentTime = 0;
    events.forEach(event => {
        let eventStart = currentTime;
        let eventEnd = currentTime + event.duration;
        let qStart = Math.floor(eventStart / quantStep) * quantStep;
        let qEnd = Math.ceil(eventEnd / quantStep) * quantStep;
        const effectiveDuration = qEnd - qStart;
        const boxWidth = (effectiveDuration / quarterBeatDuration) * baseWidth;
        let box = document.createElement('div');
        box.className = "note-box";
        if (event.note === "Pause") {
            box.classList.add("pause");
        }
        box.style.width = `${boxWidth}px`;
        box.textContent = event.note === "Pause" 
            ? `Pause (${effectiveDuration.toFixed(2)}s)`
            : `${event.note} (${effectiveDuration.toFixed(2)}s, ${event.frequency?.toFixed(1)} Hz)`;
        gridContainer.appendChild(box);
        currentTime = eventEnd;
    });
    return gridContainer;
}

// Modified updateActiveNotes: update currentActiveEvents and refresh grid.
function updateActiveNotes(note) {

}

// New function to update the deviation bar visualization
function updateDeviationBar(deviation) {
    // Clear container and add CSS class
    deviationMarkerEl.innerHTML = "";
    deviationMarkerEl.classList.add("deviation-container");

    // Create center line element with CSS class
    const centerLine = document.createElement('div');
    centerLine.classList.add("center-line");
    deviationMarkerEl.appendChild(centerLine);

    // Create deviation marker element with CSS class, but update left dynamically
    const marker = document.createElement('div');
    marker.classList.add("deviation-marker");
    const maxDisplacement = 50;
    let displacement = (Math.max(Math.min(deviation, tolerance), -tolerance) / tolerance) * maxDisplacement;
    marker.style.left = `calc(50% + ${displacement}px)`;
    deviationMarkerEl.appendChild(marker);
}

recordButton.addEventListener('click', () => {
    recording = !recording;
    recordButton.textContent = recording ? "Stop Recording" : "Start Recording";
    if (recording) {
        melody = [];
        lastDetectedNote = null;
        lastDetectedFrequency = null; // Add this line
        lastNoteStartTime = null;
        recordingStartTime = null;
        pauseStartTime = null;
        lastEventTime = null;
        frequencyHistory = [];
        initAudio();
    } else {
        const now = performance.now();
        if (lastDetectedNote !== null) {
            const noteDuration = (now - lastNoteStartTime) / 1000;
            melody.push({
                note: lastDetectedNote,
                duration: noteDuration,
                timestamp: (lastNoteStartTime - recordingStartTime) / 1000,
                frequency: lastDetectedFrequency // Add this line
            });
        } else if (pauseStartTime !== null) {
            const pauseDuration = (now - pauseStartTime) / 1000;
            if (pauseDuration >= 0.1) {
                melody.push({
                    note: "Pause",
                    duration: pauseDuration,
                    timestamp: (pauseStartTime - recordingStartTime) / 1000
                });
            }
        }
        // Sort melody events by timestamp
        melody.sort((a, b) => a.timestamp - b.timestamp);
        saveMelody(melody);
    }
});

// Storage handling

// New helper function to compute total duration of the melody
function getTotalDuration(melody) {
    return melody.reduce((sum, n) => sum + n.duration, 0);
}

// New helper function to trim leading and trailing pauses from the melody
function trimMelody(melodyArray) {
    let trimmed = melodyArray.slice();
    while(trimmed.length && trimmed[0].note === "Pause") {
        trimmed.shift();
    }
    while(trimmed.length && trimmed[trimmed.length - 1].note === "Pause") {
        trimmed.pop();
    }
    return trimmed;
}

// Modified saveMelody to trim pauses before saving and adjust total duration accordingly
function saveMelody(melodyData) {
    const trimmedMelody = trimMelody(melodyData);
    let stored = JSON.parse(localStorage.getItem('melodies')) || [];
    const melodyObj = {
        bpm: BPM,
        totalDuration: getTotalDuration(trimmedMelody),
        notes: trimmedMelody,
        savedAt: new Date().toISOString() // timestamp for when melody is saved
    };
    stored.push(melodyObj);
    localStorage.setItem('melodies', JSON.stringify(stored));
    updateMelodyList();
}

// Updated updateMelodyList to display melodies in reverse chronological order along with formatted timestamps
function updateMelodyList() {
    let stored = JSON.parse(localStorage.getItem('melodies')) || [];
    stored.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)); // reverse chronological order
    melodyListEl.innerHTML = "";
    stored.forEach((mel, index) => {
        let li = document.createElement('li');
        let header = document.createElement('div');
        const savedDate = new Date(mel.savedAt);
        header.textContent = `Melody ${index + 1} | BPM: ${mel.bpm} | Duration: ${mel.totalDuration?.toFixed(2)}s | Saved on: ${savedDate.toLocaleString()}`;
        li.appendChild(header);
        li.appendChild(buildGridView(mel.notes, mel.bpm));
        
        // Add buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        
        // JSON download button
        let jsonBtn = document.createElement('button');
        jsonBtn.textContent = "Download JSON";
        jsonBtn.style.marginRight = "10px";
        jsonBtn.addEventListener('click', () => downloadJSON(mel, index));
        
        // MIDI download button
        let midiBtn = document.createElement('button');
        midiBtn.textContent = "Download MIDI";
        midiBtn.addEventListener('click', () => downloadMIDI(mel, index));
        
        buttonContainer.appendChild(jsonBtn);
        buttonContainer.appendChild(midiBtn);
        li.appendChild(buttonContainer);
        
        melodyListEl.appendChild(li);
    });
}

// Split download functionality into separate functions
function downloadJSON(melody, index) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(melody, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `melody_${index + 1}.json`);
    a.click();
}

function downloadMIDI(melody, index) {
    const midiData = MidiUtils.melodyToMidi(melody.notes, melody.bpm);
    const blob = new Blob([midiData], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `melody_${index + 1}.mid`;
    a.click();
    URL.revokeObjectURL(url);
}

// Add "Clear Stored Melodies" button functionality
const clearMelodiesBtn = document.getElementById('clearMelodiesBtn');
if (clearMelodiesBtn) {
    clearMelodiesBtn.addEventListener('click', () => {
        localStorage.removeItem('melodies');
        updateMelodyList();
    });
}

// Call updateMelodyList on page load
document.addEventListener('DOMContentLoaded', () => {
    updateMelodyList();
});

// Maps frequency to note name and computes deviation in cents
function frequencyToNoteInfo(frequency) {
    const midiNote = NoteDetector.frequencyToMIDI(frequency);
    const deviation = NoteDetector.getCentsDeviation(frequency, midiNote);
    
    // Check if the note is within vocal range
    if (midiNote < VOCAL_RANGE.MIN_MIDI || midiNote > VOCAL_RANGE.MAX_MIDI) {
        return null;
    }

    // Convert MIDI note to note name
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    
    return {
        note: `${noteName}${octave}`,
        midi: midiNote,
        frequency,
        deviation
    };
}

// Add near the top with other state variables
let lastDetectedFrequency = null;
const noteDetector = new NoteDetector({
    bufferSize: 5,
    minDuration: 0.1
});

let lastEventTime = null;
let frequencyHistory = [];

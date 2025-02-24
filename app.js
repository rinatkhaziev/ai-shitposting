import { MidiUtils } from './audio/MidiUtils.js';
import { FrequencyAnalyzer } from './audio/FrequencyAnalyzer.js';
const VOCAL_RANGE = {
    MIN_NOTE: 'E2',  // ~82.4 Hz
    MAX_NOTE: 'C6',  // ~1047 Hz
    MIN_MIDI: 40,    // E2
    MAX_MIDI: 84     // C6
};


const TOLERANCE_DEFAULT = 35; // Reduced from 50 to be more strict with vocal pitch
const MIN_CANDIDATE_COUNT = 5; // Increased from 4 for more stability with voice
const HYSTERESIS = 15; // Increased from 10 for better handling of vocal vibrato
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

// UI Elements: updated to match new current note box structure
const recordButton = document.getElementById('recordButton');
const currentNoteEl = document.getElementById('noteDisplay');
const deviationMarkerEl = document.getElementById('deviationMarker');
const melodyListEl = document.querySelector('#melodyList ul');

// New UI element and global variables for waveform display
const waveformDisplay = document.getElementById('waveformDisplay');
let waveformCanvas, waveformCtx;

// New global variable and UI element for active notes display
let activeNotes = [];
const activeNotesEl = document.getElementById('activeNotes');

// New global variables for debouncing note detection
let candidateNote = null;
let candidateStartTime = 0;
const DEBOUNCE_TIME = 50; // in milliseconds

// New global variable for debouncing note detection flag
let candidateCount = 0;  // NEW counter for stable candidate note

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

// New helper: fetch audio buffer data.
function getAudioBuffer() {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    return buffer;
}

// NEW: Helper to normalize event duration to nearest 32nd note and clamp between 16th and 1 beat.
function normalizeDuration(duration) {
    const beatDuration = 60 / BPM;
    const quantStep = beatDuration / 8; // 32nd note step
    let normalized = Math.round(duration / quantStep) * quantStep;
    const minDuration = beatDuration / 4; // 16th note
    const maxDuration = beatDuration;      // whole beat
    if (normalized < minDuration) normalized = minDuration;
    if (normalized > maxDuration) normalized = maxDuration;
    return normalized;
}

// NEW: Helper to detect dominant tone using frequency bin analysis.
function detectDominantTone() {
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    let maxVal = -Infinity, maxIndex = -1;
    for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxVal) {
            maxVal = frequencyData[i];
            maxIndex = i;
        }
    }
    // Calculate frequency from bin index.
    const nyquist = audioContext.sampleRate / 2;
    return maxIndex * nyquist / frequencyData.length;
}

// NEW: Global variable to throttle processing (32nd note period).
let lastProcessTime = 0;

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
    // If an active note exists, finalize it.
    if (lastDetectedNote !== null) {
        let duration = (now - lastNoteStartTime) / 1000;
        duration = normalizeDuration(duration);
        melody.push({ note: lastDetectedNote, duration });
        lastDetectedNote = null;
    }
    candidateNote = null;
    candidateStartTime = 0;
    candidateCount = 0;
    // Start pause timer if not set.
    if (melody.length > 0 && pauseStartTime === null) {
        pauseStartTime = now;
    }
    currentNoteEl.textContent = "Pause";
    deviationMarkerEl.innerHTML = "";
    updateActiveNotes("Pause");
}

// Updated helper: Process when a valid pitch is detected.
function processValidPitch(noteInfo, now) {
    const newNote = noteInfo.note;
    
    if (candidateNote === null) {
        candidateNote = newNote;
        candidateStartTime = now;
        candidateCount = 1;
        return;
    }

    // Add hysteresis to note changes
    if (candidateNote !== newNote) {
        // Get ideal frequencies for both notes
        const currentNoteInfo = frequencyToNoteInfo(noteInfo.idealFreq);
        const candidateNoteInfo = frequencyToNoteInfo(
            440 * Math.pow(2, (noteToMidiNumber(candidateNote) - 69) / 12)
        );
        
        // Add null checks before accessing deviation
        if (!currentNoteInfo || !candidateNoteInfo) {
            // One of the notes is outside vocal range, keep the current note
            candidateCount++;
            return;
        }
        
        // Only change notes if deviation exceeds hysteresis
        const deviation = Math.abs(currentNoteInfo.deviation - candidateNoteInfo.deviation);
        if (deviation <= HYSTERESIS) {
            candidateCount++; // Still counting as the same note
            return;
        }
        
        // Reset counter for new note
        candidateNote = newNote;
        candidateStartTime = now;
        candidateCount = 1;
        return;
    }

    // Increase count for stable note
    candidateCount++;

    // Only register note after MIN_CANDIDATE_COUNT stable detections
    if (candidateCount >= MIN_CANDIDATE_COUNT) {
        let duration = (now - candidateStartTime) / 1000;
        duration = normalizeDuration(duration);
        
        if (lastDetectedNote !== candidateNote) {
            if (lastDetectedNote !== null) {
                melody.push({ note: lastDetectedNote, duration });
            }
            lastDetectedNote = candidateNote;
            lastNoteStartTime = now;
            updateActiveNotes(candidateNote);
        }
        
        currentNoteEl.textContent = candidateNote;
        updateDeviationBar(noteInfo.deviation);
    }
}

// Add helper function to convert note name to MIDI number
function noteToMidiNumber(noteName) {
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = parseInt(noteName.slice(-1));
    const note = noteName.slice(0, -1);
    const noteIndex = noteStrings.indexOf(note);
    return noteIndex + 12 * (octave + 1) + 12;
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

// New global variable for currently active events.
let currentActiveEvents = [];

// New global variable for tracking the start time of the current active note.
let activeNoteStartTime = null;

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
        box.textContent = `${event.note} (${effectiveDuration.toFixed(2)}s)`;
        gridContainer.appendChild(box);
        currentTime = eventEnd;
    });
    return gridContainer;
}

// Modified updateActiveNotes: update currentActiveEvents and refresh grid.
function updateActiveNotes(note) {
    const now = performance.now();
    if (currentActiveEvents.length > 0 && currentActiveEvents[currentActiveEvents.length - 1].note === note) {
        // Update duration of the currently active note.
        currentActiveEvents[currentActiveEvents.length - 1].duration = (now - activeNoteStartTime) / 1000;
    } else {
        // Start a new note event.
        activeNoteStartTime = now;
        currentActiveEvents.push({ note, duration: 0 });
    }
    activeNotesEl.innerHTML = "";
    activeNotesEl.appendChild(buildGridView(currentActiveEvents, BPM));
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
	if(recording) {
		// Reset melody state when starting
		melody = [];
		lastDetectedNote = null;
		lastNoteStartTime = performance.now();
		initAudio();
	} else {
		// Finalize last note duration
		let now = performance.now();
		if(lastDetectedNote !== null) {
			let duration = (now - lastNoteStartTime) / 1000;
			melody.push({ note: lastDetectedNote, duration });
		}
		// Stop audio stream (if needed, additional cleanup can be done here)
		// Save melody to storage
		saveMelody(melody);
	}
});

// Download melody functionality
function downloadMelody() {
	let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(melody, null, 2));
	let a = document.createElement('a');
	a.setAttribute("href", dataStr);
	a.setAttribute("download", "melody.json");
	a.click();
}

// Storage handling

// New helper function to compute total duration of the melody
function getTotalDuration(melody) {
    return melody.reduce((sum, n) => sum + n.duration, 0);
}

// New global variable for quantization setting (default: 16th note)
// let quantizationSetting = 16; // configurable: e.g., 4 = quarter, 8 = eighth, 16 = 16th note

// Modified function: quantizes a value using the step based on BPM and quantizationSetting.
function quantizeTime(value) {
    const quantStep = (60 / BPM) * (4 / quantizationSetting);
    return Math.round(value / quantStep) * quantStep;
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

// New function to convert duration in seconds to musical note time label based on BPM
function noteDurationLabel(duration) {
    // Duration of one beat in seconds
    const beatDuration = 60 / BPM;
    // Convert duration to number of beats
    const beats = duration / beatDuration;
    const noteTypes = [
        { name: "Whole", beats: 4 },
        { name: "Half", beats: 2 },
        { name: "Quarter", beats: 1 },
        { name: "Eighth", beats: 0.5 },
        { name: "Sixteenth", beats: 0.25 }
    ];
    // Determine the closest note type
    let closest = noteTypes[0];
    let minDiff = Math.abs(beats - closest.beats);
    for (let i = 1; i < noteTypes.length; i++) {
        const diff = Math.abs(beats - noteTypes[i].beats);
        if (diff < minDiff) {
            closest = noteTypes[i];
            minDiff = diff;
        }
    }
    return closest.name;
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

// Pitch detection using auto-correlation
function autoCorrelate(buffer, sampleRate) {
	let SIZE = buffer.length;
	let rms = 0;
	for (let i = 0; i < SIZE; i++) {
		let val = buffer[i];
		rms += val * val;
	}
	rms = Math.sqrt(rms / SIZE);
	if (rms < 0.01)  // too little signal
		return -1;

	let r1 = 0, r2 = SIZE - 1;
	for (let i = 0; i < SIZE; i++) {
		if (Math.abs(buffer[i]) < 0.2) {
			r1 = i;
			break;
		}
	}
	for (let i = SIZE - 1; i > 0; i--) {
		if (Math.abs(buffer[i]) < 0.2) {
			r2 = i;
			break;
		}
	}

	buffer = buffer.slice(r1, r2);
	SIZE = buffer.length;

	let c = new Array(SIZE).fill(0);
	for (let lag = 0; lag < SIZE; lag++) {
		for (let i = 0; i < SIZE - lag; i++) {
			c[lag] += buffer[i] * buffer[i + lag];
		}
	}

	let d = 0;
	while (c[d] > c[d+1])
		d++;
	let maxval = -1, maxpos = -1;
	for (let i = d; i < SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	let T0 = maxpos;
	if (T0 === 0)
		return -1;
	return sampleRate / T0;
}

// Maps frequency to note name and computes deviation in cents
function frequencyToNoteInfo(frequency) {
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    noteNum = Math.round(noteNum) + 69;
    
    // Return null if note is outside vocal range
    if (noteNum < VOCAL_RANGE.MIN_MIDI || noteNum > VOCAL_RANGE.MAX_MIDI) {
        return null;
    }
    
    let noteIndex = noteNum % 12;
    let octave = Math.floor(noteNum / 12) - 1;
    let note = noteStrings[noteIndex] + octave;
    
    // Calculate ideal frequency for this MIDI note
    let idealFreq = 440 * Math.pow(2, (noteNum - 69) / 12);
    let deviation = 1200 * (Math.log(frequency/idealFreq) / Math.log(2));
    
    return { note, idealFreq, deviation };
}

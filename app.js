const TOLERANCE_DEFAULT = 50; // in cents
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
const DEBOUNCE_TIME = 200; // in milliseconds

// New global variable for debouncing note detection flag
let candidatePushed = false;

// Add BPM control event listener
const bpmInput = document.getElementById('bpmInput');
if(bpmInput) {
    bpmInput.addEventListener('change', () => {
        BPM = Number(bpmInput.value) || 120;
    });
}

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
	analyser.fftSize = 2048;
	mediaStreamSource.connect(analyser);
    initWaveform(); // initialize waveform display
	lastNoteStartTime = performance.now();
	processAudio();
}

// New global variable to track pause start time
let pauseStartTime = null;

function processAudio() {
    let now = performance.now();
    let buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    
    // Draw the waveform using the current audio buffer
    drawWaveform(buffer);
    
    let pitch = autoCorrelate(buffer, audioContext.sampleRate);
    if (pitch !== -1) {
        // If a pause was in progress, record it before processing the note
        if (pauseStartTime !== null) {
            let pauseDuration = (now - pauseStartTime) / 1000; // in seconds
            melody.push({ note: "Pause", duration: pauseDuration });
            pauseStartTime = null;
        }
        let noteInfo = frequencyToNoteInfo(pitch);
        // Only process if deviation is within tolerance
        if (Math.abs(noteInfo.deviation) <= tolerance) {
            let newNote = noteInfo.note;
            // ...candidate note logic as before...
            if (newNote !== lastDetectedNote) {
                if (newNote !== candidateNote) {
                    candidateNote = newNote;
                    candidateStartTime = now;
                    candidatePushed = false;
                } else {
                    if (!candidatePushed && (now - candidateStartTime) >= DEBOUNCE_TIME) {
                        if (lastDetectedNote !== null) {
                            let duration = (now - lastNoteStartTime) / 1000;
                            melody.push({ note: lastDetectedNote, duration });
                        }
                        lastDetectedNote = candidateNote;
                        lastNoteStartTime = now;
                        candidatePushed = true;
                        updateActiveNotes(candidateNote);
                    }
                }
            } else {
                candidateNote = newNote;
                candidatePushed = true;
            }
            currentNoteEl.textContent = candidateNote;
            updateDeviationBar(noteInfo.deviation);
        } else {
            currentNoteEl.textContent = "No pitch within tolerance";
            deviationMarkerEl.innerHTML = "";
            candidateNote = null;
            candidateStartTime = 0;
            candidatePushed = false;
        }
    } else {
        // No pitch detected; start or continue pause
        if (pauseStartTime === null) {
            pauseStartTime = now;
        }
        currentNoteEl.textContent = "Pause";
        deviationMarkerEl.innerHTML = "";
        candidateNote = null;
        candidateStartTime = 0;
        candidatePushed = false;
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
        let downloadBtn = document.createElement('button');
        downloadBtn.textContent = "Download";
        downloadBtn.style.marginLeft = "10px";
        downloadBtn.addEventListener('click', function(){
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mel, null, 2));
            let a = document.createElement('a');
            a.setAttribute("href", dataStr);
            a.setAttribute("download", `melody_${index + 1}.json`);
            a.click();
        });
        li.appendChild(downloadBtn);
        melodyListEl.appendChild(li);
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
	let noteIndex = noteNum % 12;
	let octave = Math.floor(noteNum / 12) - 1;
	let note = noteStrings[noteIndex] + octave;
	// Calculate ideal frequency for this MIDI note
	let idealFreq = 440 * Math.pow(2, (noteNum - 69) / 12);
	// Deviation in cents: 1200*log2(current/ideal)
	let deviation = 1200 * (Math.log(frequency/idealFreq) / Math.log(2));
	return { note, idealFreq, deviation };
}

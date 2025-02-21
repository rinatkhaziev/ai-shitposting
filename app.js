const TOLERANCE_DEFAULT = 50; // in cents
let recording = false;
let audioContext, analyser, mediaStreamSource;
let tolerance = TOLERANCE_DEFAULT;
let BPM = 120; // Default BPM

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
const activeNotesEl = document.getElementById('activeNotes') || (() => {
    const el = document.createElement('div');
    el.id = 'activeNotes';
    el.style.marginTop = "20px";
    el.style.padding = "10px";
    el.style.background = "#fff";
    el.style.borderRadius = "4px";
    el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    el.textContent = "Active Notes: ";
    document.body.appendChild(el);
    return el;
})();

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
    // Set CSS to scale it within the container without overflow
    waveformCanvas.style.display = "block";
    waveformCanvas.style.width = "100%";
    waveformCanvas.style.boxSizing = "border-box";
    
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

// New function to update the active notes block
function updateActiveNotes(note) {
    activeNotes.push(note);
    activeNotesEl.textContent = "Active Notes: " + activeNotes.join(" ");
}

// New function to update the deviation bar visualization
function updateDeviationBar(deviation) {
	// Configure the container (if not already styled via CSS)
	deviationMarkerEl.style.position = 'relative';
	// deviationMarkerEl.style.width = '200px';
	// deviationMarkerEl.style.height = '20px';
	deviationMarkerEl.style.background = '#eee';
	deviationMarkerEl.innerHTML = ''; // Clear previous content

	// Add a center line which represents a perfect pitch match
	const centerLine = document.createElement('div');
	centerLine.style.position = 'absolute';
	centerLine.style.top = '0';
	centerLine.style.left = '50%';
	centerLine.style.width = '2px';
	centerLine.style.height = '100%';
	centerLine.style.background = '#aaa';
	deviationMarkerEl.appendChild(centerLine);

	// Create a marker for the detected deviation
	const marker = document.createElement('div');
	marker.style.position = 'absolute';
	marker.style.top = '0';
	marker.style.width = '4px';
	marker.style.height = '100%';
	marker.style.background = 'red';
	
	// Maximum displacement in pixels for deviation at tolerance threshold
	const maxDisplacement = 50; 
	// Calculate displacement proportional to deviation (clamped to [-tolerance, +tolerance])
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

function saveMelody(melodyData) {
    let stored = JSON.parse(localStorage.getItem('melodies')) || [];
    // Create an object that contains BPM, total melody duration and the notes array
    const melodyObj = {
        bpm: BPM,
        totalDuration: getTotalDuration(melodyData),
        notes: melodyData
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

function updateMelodyList() {
    let stored = JSON.parse(localStorage.getItem('melodies')) || [];
    // Display newest first
    stored = stored.reverse();
    melodyListEl.innerHTML = "";
    stored.forEach((mel, index) => {
        let li = document.createElement('li');
        let textSpan = document.createElement('span');
        // Ensure totalDuration exists
        const totalDuration = (mel.totalDuration !== undefined)
            ? mel.totalDuration
            : getTotalDuration(mel.notes);
        // Use noteDurationLabel to display musical time notation.
        // Display BPM and total melody duration.
        textSpan.textContent = `Melody ${index + 1} | BPM: ${mel.bpm} | Total Duration: ${totalDuration.toFixed(2)}s : ` +
            mel.notes.map(n => `${n.note} (${noteDurationLabel(n.duration)})`).join(" - ");
        li.appendChild(textSpan);
        // Create download button for this melody
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

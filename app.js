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

// Initialize Audio and Pitch Detection
async function initAudio() {
	audioContext = new (window.AudioContext || window.webkitAudioContext)();
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	mediaStreamSource = audioContext.createMediaStreamSource(stream);
	analyser = audioContext.createAnalyser();
	analyser.fftSize = 2048;
	mediaStreamSource.connect(analyser);
	lastNoteStartTime = performance.now();
	processAudio();
}

function processAudio() {
	let buffer = new Float32Array(analyser.fftSize);
	analyser.getFloatTimeDomainData(buffer);
	let pitch = autoCorrelate(buffer, audioContext.sampleRate);
	if(pitch !== -1) {
		let noteInfo = frequencyToNoteInfo(pitch);
		// Update note display: updated to use new container element
		currentNoteEl.textContent = noteInfo.note;
		// Updated: call new function to update deviation bar visualization
		updateDeviationBar(noteInfo.deviation);
		
		// Record melody when note changes
		if(lastDetectedNote !== noteInfo.note) {
			let now = performance.now();
			if(lastDetectedNote !== null) {
				let duration = (now - lastNoteStartTime) / 1000; // seconds
				melody.push({ note: lastDetectedNote, duration });
			}
			lastDetectedNote = noteInfo.note;
			lastNoteStartTime = now;
		}
	} else {
		currentNoteEl.textContent = "No pitch detected";
		deviationMarkerEl.innerHTML = ""; // Clear deviation display if no pitch
	}
	if(recording) {
		requestAnimationFrame(processAudio);
	}
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
function saveMelody(melodyData) {
	let stored = JSON.parse(localStorage.getItem('melodies')) || [];
	stored.push(melodyData);
	localStorage.setItem('melodies', JSON.stringify(stored));
	updateMelodyList();
}

function updateMelodyList() {
	let stored = JSON.parse(localStorage.getItem('melodies')) || [];
	melodyListEl.innerHTML = "";
	stored.forEach((mel, index) => {
		let li = document.createElement('li');
		li.textContent = `Melody ${index+1}: ` + mel.map(n => `${n.note}(${n.duration.toFixed(2)}s)`).join(" - ");
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

// ============================================
// Meeting Room — WebRTC Video Chat
// ============================================

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    ]
};

let localStream = null;
let peers = {};       // peerId → RTCPeerConnection
let inMeeting = false;
let camOn = true;
let micOn = true;

// --- Join Meeting ---
async function joinMeeting() {
    if (inMeeting) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
        // If camera fails, try audio only
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            camOn = false;
        } catch (err2) {
            alert("Could not access camera or microphone.");
            return;
        }
    }

    inMeeting = true;

    // Show local video
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;

    // Update local tile name
    const localName = document.querySelector("#local-tile .tile-name");
    if (localName && typeof myPlayer !== "undefined" && myPlayer) {
        localName.textContent = myPlayer.username || "You";
    }

    // Show overlay, exit pointer lock
    document.getElementById("meeting-overlay").style.display = "flex";
    document.getElementById("meeting-btn").style.display = "none";
    document.exitPointerLock();

    // Update button states
    updateToggleButtons();

    // Tell server we joined
    socket.emit("join_meeting");
}

// --- Leave Meeting ---
function leaveMeeting() {
    if (!inMeeting) return;
    inMeeting = false;

    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    // Close all peer connections
    for (const peerId in peers) {
        peers[peerId].close();
        removeVideoTile(peerId);
    }
    peers = {};

    // Hide overlay
    document.getElementById("meeting-overlay").style.display = "none";
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = null;

    // Tell server
    socket.emit("leave_meeting");

    // Reset
    camOn = true;
    micOn = true;
}

// --- Create peer connection ---
function createPeer(peerId, initiator) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers[peerId] = pc;

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // When remote stream arrives
    pc.ontrack = (event) => {
        const stream = event.streams[0];
        addVideoTile(peerId, stream);
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("webrtc_ice", { to: peerId, candidate: event.candidate });
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            removeVideoTile(peerId);
        }
    };

    // If we're the initiator, create and send offer
    if (initiator) {
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                socket.emit("webrtc_offer", { to: peerId, offer: pc.localDescription });
            });
    }

    return pc;
}

// --- Video tile management ---
function addVideoTile(peerId, stream) {
    // Remove existing tile for this peer if any
    removeVideoTile(peerId);

    const grid = document.getElementById("meeting-grid");
    const tile = document.createElement("div");
    tile.className = "meeting-tile";
    tile.id = `tile-${peerId}`;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false; // IMPORTANT: don't mute remote streams
    video.volume = 1.0;
    video.srcObject = stream;
    video.play().catch(() => {}); // force play

    // Also add a hidden audio element as backup for sound
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.srcObject = stream;
    audio.volume = 1.0;
    audio.play().catch(() => {});
    tile.appendChild(audio);

    const name = document.createElement("span");
    name.className = "tile-name";
    if (typeof otherPlayers !== "undefined" && otherPlayers[peerId]) {
        name.textContent = otherPlayers[peerId].data.username || peerId.substring(0, 8);
    } else {
        name.textContent = peerId.substring(0, 8);
    }

    tile.appendChild(video);
    tile.appendChild(name);
    grid.appendChild(tile);

    updateParticipantCount();
}

function removeVideoTile(peerId) {
    const tile = document.getElementById(`tile-${peerId}`);
    if (tile) tile.remove();
    updateParticipantCount();
}

function updateParticipantCount() {
    const count = document.querySelectorAll(".meeting-tile").length;
    const el = document.getElementById("meeting-count");
    if (el) el.textContent = `${count} participant${count !== 1 ? "s" : ""}`;
}

// --- Toggle camera/mic ---
function toggleCamera() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        camOn = !camOn;
        videoTrack.enabled = camOn;
    }
    updateToggleButtons();
}

function toggleMic() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        micOn = !micOn;
        audioTrack.enabled = micOn;
    }
    updateToggleButtons();
}

function updateToggleButtons() {
    const camBtn = document.getElementById("toggle-cam");
    const micBtn = document.getElementById("toggle-mic");
    if (camBtn) {
        camBtn.textContent = camOn ? "Camera ON" : "Camera OFF";
        camBtn.className = camOn ? "meeting-ctrl-btn on" : "meeting-ctrl-btn off";
    }
    if (micBtn) {
        micBtn.textContent = micOn ? "Mic ON" : "Mic OFF";
        micBtn.className = micOn ? "meeting-ctrl-btn on" : "meeting-ctrl-btn off";
    }
}

// --- Socket event listeners ---
socket.on("meeting_participants", (data) => {
    // We just joined — connect to all existing participants
    for (const peerId in data.participants) {
        if (peerId !== myId) {
            createPeer(peerId, true); // we initiate
        }
    }
});

socket.on("meeting_user_joined", (data) => {
    if (!inMeeting) return;
    // New user joined — they will send us an offer, we wait
    // (they are the initiator since they got the participant list)
});

socket.on("meeting_user_left", (data) => {
    const peerId = data.id;
    if (peers[peerId]) {
        peers[peerId].close();
        delete peers[peerId];
    }
    removeVideoTile(peerId);
});

socket.on("webrtc_offer", async (data) => {
    if (!inMeeting) return;
    const pc = createPeer(data.from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc_answer", { to: data.from, answer: pc.localDescription });
});

socket.on("webrtc_answer", async (data) => {
    const pc = peers[data.from];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

socket.on("webrtc_ice", async (data) => {
    const pc = peers[data.from];
    if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// --- Button event listeners (set up on load) ---
document.addEventListener("DOMContentLoaded", () => {
    const meetBtn = document.getElementById("meeting-btn");
    if (meetBtn) meetBtn.addEventListener("click", joinMeeting);

    const leaveBtn = document.getElementById("meeting-leave-btn");
    if (leaveBtn) leaveBtn.addEventListener("click", leaveMeeting);

    const camBtn = document.getElementById("toggle-cam");
    if (camBtn) camBtn.addEventListener("click", toggleCamera);

    const micBtn = document.getElementById("toggle-mic");
    if (micBtn) micBtn.addEventListener("click", toggleMic);
});


// ============================================
// PROXIMITY VOICE CHAT (outside the park)
// ============================================

const PROX_RANGE = 10;          // units — max distance to hear someone
const PROX_CHECK_INTERVAL = 500; // ms — how often to check distances
const proxPeers = {};            // peerId → {pc, audioEl, stream, gainNode}
let proxStream = null;           // local audio-only stream for proximity
let proxMicOn = true;
let proxActive = false;
let proxMicReady = false;        // true once mic permission is granted
let lastProxCheck = 0;

// Request mic permission early (called once when game starts)
async function initProximityMic() {
    if (proxMicReady) return;
    try {
        proxStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        proxMicReady = true;
        // Mute by default — unmutes when near someone
        proxStream.getAudioTracks().forEach(t => { t.enabled = true; });
        console.log("Proximity mic ready");
    } catch (err) {
        console.warn("Mic permission denied — proximity voice disabled");
    }
}

// Unlock audio on first user click (browsers block autoplay)
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Create and play a silent audio to unlock
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    // Also try to play any existing audio elements
    document.querySelectorAll("audio, video").forEach(el => {
        if (el.paused && el.srcObject) el.play().catch(() => {});
    });
    console.log("Audio unlocked");
}
document.addEventListener("click", unlockAudio, { once: false });
document.addEventListener("keydown", unlockAudio, { once: false });

// Called every frame from game.js update loop
function updateProximityVoice(myPlayer, otherPlayers) {
    if (inMeeting) return; // park meeting takes priority

    const now = Date.now();
    if (now - lastProxCheck < PROX_CHECK_INTERVAL) {
        // Still update volumes every frame for smooth falloff
        updateProxVolumes(myPlayer, otherPlayers);
        return;
    }
    lastProxCheck = now;

    // Find nearby players
    const nearbyIds = [];
    for (const id in otherPlayers) {
        const op = otherPlayers[id];
        if (!op.data) continue;
        const dx = myPlayer.x - op.data.x;
        const dz = myPlayer.z - op.data.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < PROX_RANGE) {
            nearbyIds.push(id);
        }
    }

    // Show/hide proximity voice HUD
    const hud = document.getElementById("prox-voice-hud");
    const micToggle = document.getElementById("prox-mic-toggle");
    if (nearbyIds.length > 0) {
        if (hud) hud.style.display = "flex";
        if (micToggle) micToggle.style.display = "block";
        const status = document.getElementById("prox-voice-status");
        if (status) status.textContent = `${nearbyIds.length} nearby`;

        // Start proximity voice if not active
        if (!proxActive) startProximityVoice();
    } else {
        if (hud) hud.style.display = "none";
        if (micToggle) micToggle.style.display = "none";

        // Stop if no one nearby
        if (proxActive) stopProximityVoice();
    }

    // Connect to new nearby peers
    for (const id of nearbyIds) {
        if (!proxPeers[id]) {
            createProxPeer(id, true);
        }
    }

    // Disconnect from peers that moved away
    for (const id in proxPeers) {
        if (!nearbyIds.includes(id)) {
            closeProxPeer(id);
        }
    }

    updateProxVolumes(myPlayer, otherPlayers);
}

// Smoothly adjust volume based on distance
function updateProxVolumes(myPlayer, otherPlayers) {
    for (const id in proxPeers) {
        const pp = proxPeers[id];
        if (!pp.audioEl) continue;
        const op = otherPlayers[id];
        if (!op || !op.data) continue;

        const dx = myPlayer.x - op.data.x;
        const dz = myPlayer.z - op.data.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Quadratic falloff: full volume at dist=0, zero at PROX_RANGE
        const vol = Math.max(0, 1 - dist / PROX_RANGE);
        pp.audioEl.volume = vol * vol;
    }
}

function startProximityVoice() {
    if (proxActive) return;
    if (!proxMicReady || !proxStream) return; // mic not ready yet, skip silently
    proxActive = true;
    proxMicOn = true;
    proxStream.getAudioTracks().forEach(t => { t.enabled = true; });
    updateProxMicUI();
}

function stopProximityVoice() {
    proxActive = false;
    // Don't destroy stream — just mute and close peers
    if (proxStream) {
        proxStream.getAudioTracks().forEach(t => { t.enabled = false; });
    }
    for (const id in proxPeers) {
        closeProxPeer(id);
    }
}

function createProxPeer(peerId, initiator) {
    if (proxPeers[peerId]) return; // already exists

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio track
    if (proxStream) {
        proxStream.getAudioTracks().forEach(track => {
            pc.addTrack(track, proxStream);
        });
    }

    // When remote audio arrives — play through a simple <audio> element
    pc.ontrack = (event) => {
        const stream = event.streams[0];

        const audioEl = document.createElement("audio");
        audioEl.srcObject = stream;
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.volume = 1.0;
        audioEl.id = `prox-audio-${peerId}`;
        document.body.appendChild(audioEl);

        // Force play (some browsers need this)
        audioEl.play().catch(() => {});

        if (proxPeers[peerId]) {
            proxPeers[peerId].stream = stream;
            proxPeers[peerId].audioEl = audioEl;
        }

        console.log(`Proximity audio connected with ${peerId}`);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("webrtc_ice", { to: peerId, candidate: event.candidate });
        }
    };

    proxPeers[peerId] = { pc, stream: null, audioEl: null };

    if (initiator) {
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                socket.emit("webrtc_offer", { to: peerId, offer: pc.localDescription });
            });
    }

    return pc;
}

function closeProxPeer(peerId) {
    const pp = proxPeers[peerId];
    if (pp) {
        if (pp.pc) pp.pc.close();
        if (pp.audioEl) { pp.audioEl.pause(); pp.audioEl.srcObject = null; pp.audioEl.remove(); }
        delete proxPeers[peerId];
    }
    const el = document.getElementById(`prox-audio-${peerId}`);
    if (el) { el.pause(); el.srcObject = null; el.remove(); }
}

// Toggle proximity mic
function toggleProxMic() {
    if (!proxStream) return;
    proxMicOn = !proxMicOn;
    proxStream.getAudioTracks().forEach(t => { t.enabled = proxMicOn; });
    updateProxMicUI();
}

function updateProxMicUI() {
    const icon = document.getElementById("prox-mic-icon");
    const btn = document.getElementById("prox-mic-toggle");
    if (icon) {
        icon.textContent = proxMicOn ? "MIC" : "MUTED";
        icon.className = proxMicOn ? "" : "muted";
    }
    if (btn) {
        btn.textContent = proxMicOn ? "V — Mic ON" : "V — Mic OFF";
        btn.className = proxMicOn ? "" : "muted";
    }
}

// Handle incoming WebRTC for proximity (shares signaling with meeting)
// The existing webrtc_offer handler needs to work for BOTH meeting and proximity
const _origOfferHandler = socket.listeners("webrtc_offer")[0];
socket.off("webrtc_offer");
socket.on("webrtc_offer", async (data) => {
    // If we're in a meeting, use meeting handler
    if (inMeeting) {
        const pc = createPeer(data.from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc_answer", { to: data.from, answer: pc.localDescription });
        return;
    }

    // Otherwise, handle as proximity voice
    // Auto-start proximity if someone sends us an offer (they detected us as nearby)
    if (!proxActive && proxMicReady) {
        startProximityVoice();
    }
    if (!proxMicReady) return;
    let pp = proxPeers[data.from];
    if (!pp) {
        createProxPeer(data.from, false);
        pp = proxPeers[data.from];
    }
    const pc = pp.pc;
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc_answer", { to: data.from, answer: pc.localDescription });
});

// Override answer handler for both systems
const _origAnswerHandler = socket.listeners("webrtc_answer")[0];
socket.off("webrtc_answer");
socket.on("webrtc_answer", async (data) => {
    // Check meeting peers first
    if (peers[data.from]) {
        await peers[data.from].setRemoteDescription(new RTCSessionDescription(data.answer));
        return;
    }
    // Then proximity peers
    if (proxPeers[data.from] && proxPeers[data.from].pc) {
        await proxPeers[data.from].pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

// Override ICE handler for both systems
socket.off("webrtc_ice");
socket.on("webrtc_ice", async (data) => {
    // Check meeting peers
    if (peers[data.from]) {
        if (data.candidate) await peers[data.from].addIceCandidate(new RTCIceCandidate(data.candidate));
        return;
    }
    // Proximity peers
    if (proxPeers[data.from] && proxPeers[data.from].pc) {
        if (data.candidate) await proxPeers[data.from].pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// V key toggles proximity mic (added in game.js keydown handler via this listener)
window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key.toLowerCase() === "v" && proxActive && !inMeeting) {
        toggleProxMic();
    }
});

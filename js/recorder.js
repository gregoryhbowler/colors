// WAV Recorder
// Records audio output and exports as WAV file

export class WAVRecorder {
    constructor(ctx) {
        this.ctx = ctx;
        this.isRecording = false;
        this.startTime = 0;
        this.chunks = [];
        this.mediaRecorder = null;
        this.recordingNode = null;
        this.audioData = [];
        
        // Recording settings
        this.sampleRate = ctx.sampleRate;
        this.numChannels = 2;
        
        // Callbacks
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onTimeUpdate = null;
        
        // Timer
        this.timerInterval = null;
    }
    
    /**
     * Create recording node (ScriptProcessor or AudioWorklet)
     */
    createRecordingNode() {
        // Use ScriptProcessor for broad compatibility
        // (AudioWorklet would be better but requires more setup)
        const bufferSize = 4096;
        this.recordingNode = this.ctx.createScriptProcessor(bufferSize, 2, 2);
        
        this.recordingNode.onaudioprocess = (e) => {
            if (!this.isRecording) return;
            
            // Get audio data from both channels
            const left = e.inputBuffer.getChannelData(0);
            const right = e.inputBuffer.getChannelData(1);
            
            // Store copies (the buffers get reused)
            this.audioData.push({
                left: new Float32Array(left),
                right: new Float32Array(right)
            });
        };
        
        return this.recordingNode;
    }
    
    /**
     * Connect to audio source
     */
    connectSource(sourceNode) {
        if (!this.recordingNode) {
            this.createRecordingNode();
        }
        
        sourceNode.connect(this.recordingNode);
        this.recordingNode.connect(this.ctx.destination);
    }
    
    /**
     * Start recording
     */
    start() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.startTime = performance.now();
        this.audioData = [];
        
        // Start timer
        this.timerInterval = setInterval(() => {
            if (this.onTimeUpdate) {
                const elapsed = (performance.now() - this.startTime) / 1000;
                this.onTimeUpdate(elapsed);
            }
        }, 100);
        
        if (this.onRecordingStart) {
            this.onRecordingStart();
        }
    }
    
    /**
     * Stop recording and return blob
     */
    stop() {
        if (!this.isRecording) return null;
        
        this.isRecording = false;
        
        // Stop timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Create WAV blob
        const wavBlob = this.createWAVBlob();
        
        if (this.onRecordingStop) {
            this.onRecordingStop(wavBlob);
        }
        
        return wavBlob;
    }
    
    /**
     * Create WAV blob from recorded data
     */
    createWAVBlob() {
        // Calculate total length
        let totalSamples = 0;
        for (const chunk of this.audioData) {
            totalSamples += chunk.left.length;
        }
        
        // Interleave channels
        const interleaved = new Float32Array(totalSamples * 2);
        let offset = 0;
        
        for (const chunk of this.audioData) {
            for (let i = 0; i < chunk.left.length; i++) {
                interleaved[offset++] = chunk.left[i];
                interleaved[offset++] = chunk.right[i];
            }
        }
        
        // Convert to 16-bit PCM
        const pcmData = this.floatTo16BitPCM(interleaved);
        
        // Create WAV file
        const wavBuffer = this.createWAVFile(pcmData, this.sampleRate, this.numChannels);
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    /**
     * Convert float samples to 16-bit PCM
     */
    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        
        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to -1 to 1
            let sample = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to 16-bit integer
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(i * 2, sample, true);
        }
        
        return buffer;
    }
    
    /**
     * Create WAV file with header
     */
    createWAVFile(pcmData, sampleRate, numChannels) {
        const pcmBytes = pcmData.byteLength;
        const buffer = new ArrayBuffer(44 + pcmBytes);
        const view = new DataView(buffer);
        
        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + pcmBytes, true);
        this.writeString(view, 8, 'WAVE');
        
        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Chunk size
        view.setUint16(20, 1, true); // Audio format (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
        view.setUint16(32, numChannels * 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        
        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, pcmBytes, true);
        
        // Copy PCM data
        const pcmView = new Uint8Array(pcmData);
        const destView = new Uint8Array(buffer, 44);
        destView.set(pcmView);
        
        return buffer;
    }
    
    /**
     * Write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    /**
     * Get current recording time in seconds
     */
    getRecordingTime() {
        if (!this.isRecording) return 0;
        return (performance.now() - this.startTime) / 1000;
    }
    
    /**
     * Format time as MM:SS
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Download blob as file
     */
    static downloadBlob(blob, filename = 'gestalt-recording.wav') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.stop();
        if (this.recordingNode) {
            this.recordingNode.disconnect();
            this.recordingNode = null;
        }
    }
}

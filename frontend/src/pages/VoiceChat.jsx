import { useState, useRef, useMemo } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const playbackChunksRef = useRef([]);

  const sessionId = useMemo(() => {
    let id = localStorage.getItem('mindbridge_session_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mindbridge_session_id', id);
    }
    return id;
  }, []);

  const startRecording = async () => {
    try {
      setTranscript('');
      setReply('');
      playbackChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
      const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
      const wsHost = backendUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsHost}/api/voice/stream`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        wsRef.current.send(JSON.stringify({ type: 'start', sessionId }));
        setIsRecording(true);
        setIsProcessing(false);
      };

      wsRef.current.binaryType = 'arraybuffer';
      wsRef.current.onmessage = async (event) => {
        // If it's a Buffer/Blob (Binary Audio from TTS)
        if (event.data instanceof ArrayBuffer) {
          playbackChunksRef.current.push(event.data);
          return;
        }

        try {
          // It is JSON text
          const msg = JSON.parse(event.data);
          console.log("[WS] Received message:", msg);
          
          if (msg.type === 'stt_progress') {
             console.log(`[🎤 Live STT]: "${msg.transcript}"`);
             setTranscript(msg.transcript);
          } else if (msg.type === 'ai_response') {
             console.log(`[🤖 Final STT Parsed]: "${msg.data.userText}"`);
             if (msg.data && msg.data.companion_reply) {
               setReply(msg.data.companion_reply);
             }
          } else if (msg.type === 'tts_done') {
             setIsProcessing(false);
             console.log("[WS] TTS Done. Playing chunks:", playbackChunksRef.current.length);
             // Play the accumulated TTS binary chunks!
             const finalAudioBlob = new Blob(playbackChunksRef.current, { type: 'audio/mpeg' });
             const audioUrl = URL.createObjectURL(finalAudioBlob);
             const audio = new Audio(audioUrl);
             audio.play().catch(e => console.error("[Audio] Playback error:", e));
          } else if (msg.type === 'error') {
             setReply("Something went wrong with the voice engine.");
             setIsProcessing(false);
          }
        } catch (err) {
          console.error("[WS] Error parsing message:", err, event.data);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("WebSocket connection error:", err);
      };

      // Realtime Audio Extraction to Raw PCM 16kHz for ElevenLabs standard STT WSS compatibility
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        wsRef.current.send(pcm16.buffer); // Fire instantly over websocket
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to talk to MindBridge.");
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto h-[70vh]">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-light text-teal-800 mb-4">MindBridge Support</h2>
        <p className="text-gray-600 font-medium">How are you feeling right now? Tap to talk.</p>
      </div>

      <div className="flex flex-col items-center gap-8">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-teal-500 hover:bg-teal-600 hover:scale-105'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          ) : isRecording ? (
            <Square className="w-12 h-12 text-white" fill="currentColor" />
          ) : (
            <Mic className="w-12 h-12 text-white" />
          )}
        </button>

        <div className="min-h-32 text-center w-full bg-white p-6 rounded-2xl shadow-sm border border-teal-50">
          {isRecording && <p className="text-red-500 font-medium animate-pulse">Listening...</p>}
          {isProcessing && <p className="text-teal-600 font-medium animate-pulse">Thinking & generating voice...</p>}
          
          {!isRecording && !isProcessing && transcript && (
            <div className="mb-4 text-left">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">You said:</span>
              <p className="text-gray-800 mt-1">"{transcript}"</p>
            </div>
          )}

          {!isRecording && !isProcessing && reply && (
            <div className="text-left bg-teal-50 p-4 rounded-xl border border-teal-100">
              <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">MindBridge says:</span>
              <p className="text-teal-900 mt-1">{reply}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

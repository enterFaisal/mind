import { API_BASE_URL } from "../config";
import { createElement, useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, BookOpen, Moon, Heart, Wind, Smile, Meh, Frown, AlertCircle, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const aiFeatures = [
  { label: 'Grounding', detail: 'Reset your focus', Icon: BookOpen, iconClass: 'bg-orange-100 text-orange-500' },
  { label: 'Sleep stories', detail: 'Unwind at night', Icon: Moon, iconClass: 'bg-blue-100 text-blue-500' },
  { label: 'Meditation', detail: 'Find a quiet moment', Icon: Heart, iconClass: 'bg-purple-100 text-purple-500' },
  { label: 'Breathing', detail: 'Calm your body', Icon: Wind, iconClass: 'bg-green-100 text-green-500' },
];

const moodOptions = [
  { label: 'Great', Icon: Smile, className: 'border-green-100 bg-green-50/60 text-green-700 hover:bg-green-50' },
  { label: 'Okay', Icon: Meh, className: 'border-blue-100 bg-blue-50/60 text-blue-700 hover:bg-blue-50' },
  { label: 'Stressed', Icon: Frown, className: 'border-orange-100 bg-orange-50/60 text-orange-700 hover:bg-orange-50' },
  { label: 'Difficult', Icon: AlertCircle, className: 'border-red-100 bg-red-50/50 text-red-700 hover:bg-red-50' },
];

export default function VoiceChat() {
  const { currentUser } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const playbackChunksRef = useRef([]);
  const audioElRef = useRef(null);

  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = API_BASE_URL.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}/api/voice/stream`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        playbackChunksRef.current.push(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stt_progress') {
           console.log("User Transcript:", msg.transcript);
           setTranscript(msg.transcript);
        } else if (msg.type === 'ai_response') {
           if (msg.data && msg.data.companion_reply) {
             console.log("AI Generated Text:", msg.data.companion_reply);
             setReply(msg.data.companion_reply);
           }
        } else if (msg.type === 'tts_done') {
           setIsProcessing(false);
           const finalAudioBlob = new Blob(playbackChunksRef.current, { type: 'audio/wav' });
           const audioUrl = URL.createObjectURL(finalAudioBlob);
           if (audioElRef.current) {
             audioElRef.current.src = audioUrl;
             audioElRef.current.play().catch(e => console.error("[Audio] Playback error:", e));
           } else {
             const audio = new Audio(audioUrl);
             audio.play().catch(e => console.error("[Audio] Playback error:", e));
           }
        } else if (msg.type === 'error') {
           setReply("Something went wrong with the voice engine.");
           setIsProcessing(false);
        }
      } catch (err) {
        console.error("[WS] Error parsing message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection error:", err);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setTranscript('');
      setReply('');
      playbackChunksRef.current = [];

      // Ensure WS is connected
      connectWebSocket();

      // Wait if connecting
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
        await new Promise(resolve => {
          const onOpen = () => {
            wsRef.current.removeEventListener('open', onOpen);
            resolve();
          };
          wsRef.current.addEventListener('open', onOpen);
        });
      }

      const voicePref = localStorage.getItem('mindbridge_voice') || 'female';
      const langPref = localStorage.getItem('mindbridge_language') || 'EN';
      wsRef.current.send(JSON.stringify({ type: 'start', patientId: currentUser.id, voice: voicePref, language: langPref }));
      setIsRecording(true);
      setIsProcessing(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

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

        wsRef.current.send(pcm16.buffer);
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

    // Unlock audio playback on iOS during this user-gesture (tap).
    // iOS Safari blocks Audio.play() unless it originates from a direct user tap.
    // Playing a silent buffer here "unlocks" the element for later async playback.
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play().then(() => { audio.pause(); }).catch(() => {});
    audioElRef.current = audio;

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

  const statusText = isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to speak';

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-4 pt-4 sm:pt-10 pb-6 sm:pb-10 relative z-10 animate-fade-in flex-1">
      <section className="text-center max-w-3xl mx-auto mb-5 sm:mb-12">
        <p className="inline-flex items-center rounded-full bg-white/70 border border-teal-100 px-3 py-1 text-xs sm:text-sm font-semibold text-teal-700 shadow-sm mb-3">
          Welcome, {currentUser?.name}
        </p>
        <h1 className="text-3xl sm:text-[2.75rem] font-bold text-gray-900 mb-2 sm:mb-4 tracking-tight leading-tight">
          I'm here for you
        </h1>
        <p className="text-sm sm:text-xl text-gray-600 px-1 leading-relaxed">
          Take a moment to breathe. Share what's on your mind, and let's work through it together.
        </p>
      </section>

      {(transcript || reply) && (
        <div className="w-full max-w-2xl mx-auto bg-white/85 backdrop-blur-sm border border-white/70 rounded-3xl shadow-sm p-4 mb-5 sm:mb-8">
          {transcript && (
            <p className="text-sm text-gray-500">
              You said: <span className="font-semibold text-gray-800">{transcript}</span>
            </p>
          )}
          {reply && (
            <p className="text-sm text-teal-700 mt-2">
              MindBridge: <span className="font-semibold">{reply}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-stretch">
        <section className="order-2 md:order-1 md:col-span-4 bg-white/80 backdrop-blur-sm rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-sm border border-white/60">
          <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 mb-1">AI Features</p>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Support for the moment</h2>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-3">
            {aiFeatures.map((feature) => (
              <button
                key={feature.label}
                className="bg-white/90 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex items-center md:flex-col lg:items-center lg:flex-row gap-3 text-left md:text-center lg:text-left hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                <span className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${feature.iconClass}`}>
                  {createElement(feature.Icon, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 leading-tight">{feature.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{feature.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="order-1 md:order-2 md:col-span-4 bg-white/55 md:bg-transparent border border-white/60 md:border-0 rounded-[2rem] md:rounded-none shadow-sm md:shadow-none min-h-[260px] sm:min-h-[320px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className={`absolute w-56 h-56 sm:w-[22rem] sm:h-[22rem] bg-[#e0f2fe]/60 rounded-full flex items-center justify-center ${isRecording ? 'animate-pulse' : ''} pointer-events-none`}>
            <div className={`w-36 h-36 sm:w-[16rem] sm:h-[16rem] bg-[#dcfce7]/80 rounded-full flex items-center justify-center ${isRecording ? 'animate-ping' : ''} pointer-events-none`} />
          </div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={statusText}
            className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 scale-105 shadow-red-200'
                : 'bg-[#21c55e] hover:bg-[#16a34a] hover:scale-105 shadow-green-200'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <Loader2 className="w-9 h-9 sm:w-10 sm:h-10 text-white animate-spin" />
            ) : isRecording ? (
              <Square className="w-9 h-9 sm:w-10 sm:h-10 text-white" fill="currentColor" />
            ) : (
              <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            )}
          </button>
          <span className="relative z-10 mt-5 sm:mt-8 text-base sm:text-[17px] font-semibold text-gray-700">
            {statusText}
          </span>
          <span className="relative z-10 mt-2 text-xs sm:text-sm text-gray-500 px-6 text-center">
            Your voice stays private between you and MindBridge.
          </span>
        </section>

        <section className="order-3 md:col-span-4 bg-white/80 backdrop-blur-sm rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-sm border border-white/60 flex flex-col">
          <div className="flex items-start gap-3 mb-4 sm:mb-6">
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-50 text-[#21c55e] flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 mb-1">Check-in</p>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">How are you feeling?</h2>
              <p className="text-sm text-gray-500 mt-1">Choose the closest mood for today.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-auto">
            {moodOptions.map((mood) => (
              <button
                key={mood.label}
                className={`min-h-[76px] sm:min-h-[88px] py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 font-semibold text-sm active:scale-[0.98] transition-all ${mood.className}`}
              >
                {createElement(mood.Icon, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
                {mood.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
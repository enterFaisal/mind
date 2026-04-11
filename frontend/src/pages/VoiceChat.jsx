import { API_BASE_URL } from "../config";
import { useState, useRef, useMemo, useEffect } from 'react';
import { Mic, Square, Loader2, BookOpen, Moon, Heart, Wind, Smile, Meh, Frown, AlertCircle, Sun } from 'lucide-react';

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
           const finalAudioBlob = new Blob(playbackChunksRef.current, { type: 'audio/mpeg' });
           const audioUrl = URL.createObjectURL(finalAudioBlob);
           const audio = new Audio(audioUrl);
           audio.play().catch(e => console.error("[Audio] Playback error:", e));
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
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
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
      wsRef.current.send(JSON.stringify({ type: 'start', sessionId, voice: voicePref }));
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
    <div className="flex flex-col items-center justify-start pt-2 sm:pt-10 pb-4 sm:pb-8 px-3 sm:px-0 w-full max-w-[1200px] mx-auto relative z-10 animate-fade-in flex-1 min-h-0">
      
      {/* Header - compact on mobile */}
      <div className="text-center max-w-2xl mb-3 sm:mb-16">
        <h1 className="text-xl sm:text-[2.75rem] font-bold text-gray-900 mb-1 sm:mb-4 tracking-tight">I'm here for you</h1>
        <p className="text-sm sm:text-xl text-gray-600 px-2 hidden sm:block">
          Take a moment to breathe. Share what's on your mind, and let's work through it together.
        </p>
        <p className="text-sm text-gray-600 px-2 sm:hidden">
          Share what's on your mind, let's work through it together.
        </p>
      </div>

      {/* Desktop: 3-column layout */}
      <div className="hidden md:grid grid-cols-3 gap-10 w-full items-stretch">
        
        {/* Left Card: AI Features */}
        <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 shadow-sm border border-white/50 relative flex flex-col justify-between h-full">
          <div>
             <h3 className="text-lg font-bold text-gray-900 mb-6">How you Can Use Our AI?</h3>
             <div className="grid grid-cols-2 gap-4">
               <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all hover:-translate-y-1">
                 <div className="bg-orange-100 p-3 rounded-2xl text-orange-500"><BookOpen className="w-6 h-6"/></div>
                 <span className="text-sm font-medium text-gray-800 text-center leading-tight">Grounding<br/>Exercise</span>
               </button>
               <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all hover:-translate-y-1">
                 <div className="bg-blue-100 p-3 rounded-2xl text-blue-500"><Moon className="w-6 h-6"/></div>
                 <span className="text-sm font-medium text-gray-800 text-center leading-tight">Sleep<br/>Stories</span>
               </button>
               <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all hover:-translate-y-1">
                 <div className="bg-purple-100 p-3 rounded-2xl text-purple-500"><Heart className="w-6 h-6"/></div>
                 <span className="text-sm font-medium text-gray-800 text-center leading-tight">Meditation</span>
               </button>
               <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all hover:-translate-y-1">
                 <div className="bg-green-100 p-3 rounded-2xl text-green-500"><Wind className="w-6 h-6"/></div>
                 <span className="text-sm font-medium text-gray-800 text-center leading-tight">Breathing<br/>Exercises</span>
               </button>
             </div>
          </div>
        </div>

        {/* Center: Microphone */}
        <div className="flex flex-col items-center justify-center relative min-h-[300px]">
          <div className={`absolute w-[22rem] h-[22rem] bg-[#e0f2fe]/60 rounded-full flex items-center justify-center ${isRecording ? 'animate-pulse' : ''} pointer-events-none`}>
             <div className={`w-[16rem] h-[16rem] bg-[#dcfce7]/80 rounded-full flex items-center justify-center ${isRecording ? 'animate-ping' : ''} pointer-events-none`}>
             </div>
          </div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-200'
                : 'bg-[#21c55e] hover:bg-[#16a34a] hover:scale-105 shadow-green-200'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : isRecording ? (
              <Square className="w-10 h-10 text-white" fill="currentColor" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>
          <span className="relative z-10 mt-8 text-[17px] font-medium text-gray-700">
            {isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to speak'}
          </span>
        </div>

        {/* Right Card: Daily Check-in */}
        <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 shadow-sm border border-white/50 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sun className="w-6 h-6 text-[#21c55e]" />
              <h3 className="text-xl font-bold text-gray-900">Daily Check-in</h3>
            </div>
            <p className="text-gray-500 mb-8 text-[15px]">How are you feeling today?</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-auto">
             <button className="py-4 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 border-green-100 bg-green-50/40 hover:bg-green-50 transition-colors text-green-700 font-medium h-[85px]">
               <Smile className="w-6 h-6" /> Great
             </button>
             <button className="py-4 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors text-blue-700 font-medium h-[85px]">
               <Meh className="w-6 h-6" /> Okay
             </button>
             <button className="py-4 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 border-orange-100 bg-orange-50/50 hover:bg-orange-50 transition-colors text-orange-700 font-medium h-[85px]">
               <Frown className="w-6 h-6" /> Stressed
             </button>
             <button className="py-4 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 border-red-100 bg-red-50/30 hover:bg-red-50 transition-colors text-red-700 font-medium h-[85px]">
               <AlertCircle className="w-6 h-6" /> Difficult
             </button>
          </div>
        </div>
      </div>

      {/* Mobile portrait layout */}
      <div className="flex flex-col w-full md:hidden flex-1 min-h-0">
        
        {/* Mic section - grows to fill space, pushes cards to bottom */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
          <div className={`absolute w-44 h-44 bg-[#e0f2fe]/60 rounded-full flex items-center justify-center ${isRecording ? 'animate-pulse' : ''} pointer-events-none`}>
             <div className={`w-28 h-28 bg-[#dcfce7]/80 rounded-full flex items-center justify-center ${isRecording ? 'animate-ping' : ''} pointer-events-none`}>
             </div>
          </div>
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-200'
                : 'bg-[#21c55e] hover:bg-[#16a34a] hover:scale-105 shadow-green-200'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : isRecording ? (
              <Square className="w-7 h-7 text-white" fill="currentColor" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>
          
          <span className="relative z-10 mt-3 text-sm font-medium text-gray-700">
            {isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to speak'}
          </span>
        </div>

        {/* Two cards side-by-side, pinned near bottom */}
        <div className="grid grid-cols-2 gap-2.5 w-full shrink-0 mb-12">
          
          {/* AI Features Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-white/50 flex flex-col">
            <h3 className="text-[13px] font-bold text-gray-900 mb-2.5">AI Features</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button className="bg-white p-2 rounded-xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <div className="bg-orange-100 p-1.5 rounded-lg text-orange-500"><BookOpen className="w-4 h-4"/></div>
                <span className="text-[10px] font-medium text-gray-700">Grounding</span>
              </button>
              <button className="bg-white p-2 rounded-xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-500"><Moon className="w-4 h-4"/></div>
                <span className="text-[10px] font-medium text-gray-700">Sleep</span>
              </button>
              <button className="bg-white p-2 rounded-xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <div className="bg-purple-100 p-1.5 rounded-lg text-purple-500"><Heart className="w-4 h-4"/></div>
                <span className="text-[10px] font-medium text-gray-700">Meditate</span>
              </button>
              <button className="bg-white p-2 rounded-xl shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <div className="bg-green-100 p-1.5 rounded-lg text-green-500"><Wind className="w-4 h-4"/></div>
                <span className="text-[10px] font-medium text-gray-700">Breathe</span>
              </button>
            </div>
          </div>

          {/* Daily Check-in Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-white/50 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <Sun className="w-4 h-4 text-[#21c55e]" />
              <h3 className="text-[13px] font-bold text-gray-900">Check-in</h3>
            </div>
            <p className="text-gray-500 mb-2 text-[10px]">How are you feeling?</p>
            <div className="grid grid-cols-2 gap-1.5 mt-auto">
               <button className="py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 border-green-100 bg-green-50/40 active:bg-green-50 transition-colors text-green-700 font-medium text-[11px]">
                 <Smile className="w-4 h-4" /> Great
               </button>
               <button className="py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 border-blue-100 bg-blue-50/50 active:bg-blue-50 transition-colors text-blue-700 font-medium text-[11px]">
                 <Meh className="w-4 h-4" /> Okay
               </button>
               <button className="py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 border-orange-100 bg-orange-50/50 active:bg-orange-50 transition-colors text-orange-700 font-medium text-[11px]">
                 <Frown className="w-4 h-4" /> Stressed
               </button>
               <button className="py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 border-red-100 bg-red-50/30 active:bg-red-50 transition-colors text-red-700 font-medium text-[11px]">
                 <AlertCircle className="w-4 h-4" /> Difficult
               </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleAudioStop;
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscript('');
      setReply('');
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to talk to MindBridge.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioStop = async () => {
    setIsProcessing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = []; // Reset chunks

    const formData = new FormData();
    formData.append('audio', audioBlob, 'patient-voice.webm');
    formData.append('sessionId', sessionId);

    try {
      // Send to backend
      const API_BASE_URL = `http://${window.location.hostname}:5000`;
      console.log(`[VoiceChat] Sending audio blob to backend. Size: ${audioBlob.size} bytes`);
      
      const response = await axios.post(`${API_BASE_URL}/api/voice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob' // We now expect audio/mpeg back directly!
      });
      
      // The log entry info is now stored in custom Headers since the response body is pure audio stream
      const encodedLog = response.headers['x-log-entry'];
      if (!encodedLog) throw new Error("Missing X-Log-Entry header containing AI analysis payload.");
      
      const logEntry = JSON.parse(decodeURIComponent(encodedLog));
      
      console.log("[VoiceChat] Received successful response from backend:", logEntry);
      
      setTranscript(logEntry.userText);
      setReply(logEntry.companion_reply);

      // Play the returning audio by turning the returned blob into a local ObjectURL
      const audioUrl = URL.createObjectURL(response.data);
      console.log("[VoiceChat] Playing TTS streaming audio buffer...");
      const audio = new Audio(audioUrl);
      audio.play().catch(e => console.error("[VoiceChat] Audio playback failed:", e));

    } catch (error) {
      console.error("\n================ VOICE CHAT REQUEST ERROR ===============");
      console.error("Time:", new Date().toISOString());
      console.error("Error Message:", error.message);
      if (error.response) {
        console.error("Response Status:", error.response.status);
        console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error("No response received. Request was:", error.request);
      }
      console.error("=========================================================\n");
      
      setReply("I'm sorry, I encountered an error. Could you try again?");
    } finally {
      setIsProcessing(false);
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

import { API_BASE_URL } from "../config";
import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Send, Loader2, Heart, Smile } from 'lucide-react';

export default function TextChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hello, I'm your MindBridge companion. I'm here to listen without judgment and support you through whatever you're experiencing.\n\nTake your time, and share whatever feels comfortable for you. How are you feeling right now?",
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef(null);

  const sessionId = useMemo(() => {
    let id = localStorage.getItem('mindbridge_session_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mindbridge_session_id', id);
    }
    return id;
  }, []);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textOverride = null) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now'
    };

    console.log("User Typed Text:", textToSend);

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        text: textToSend,
        sessionId: sessionId
      });

      console.log("AI Generated Text:", response.data.companion_reply);

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: response.data.companion_reply,
        timestamp: 'Just now'
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: "I'm having trouble connecting right now. Let's take a deep breath and try again in a moment.",
        timestamp: 'Just now'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const feelingPills = [
    { emoji: '😨', label: 'Anxious' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '🤯', label: 'Overwhelmed' },
    { emoji: '🙂', label: 'Okay' }
  ];

  return (
    <div className="flex flex-col items-center justify-start w-full max-w-4xl mx-auto h-full min-h-0 relative z-10 animate-fade-in p-4">
      
      {/* Safe Space Badge */}
      <div className="bg-white/80 backdrop-blur-sm border border-[#e2efe9] shadow-sm text-gray-700 py-3 px-8 rounded-full flex items-center justify-center gap-3 mb-6 mt-4">
        <div className="bg-[#ccf6f1] p-1.5 rounded-full">
           <Heart className="w-4 h-4 text-teal-600" fill="currentColor" />
        </div>
        <span className="font-medium text-[16px]">You're in a safe space</span>
      </div>

      {/* Main Chat Window */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-[2.5rem] w-full flex-1 flex flex-col overflow-hidden relative">
        
        {/* Messages Layout */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-10 pb-4">
          <div className="flex flex-col gap-8">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                
                {/* Bot Avatar */}
                {msg.sender === 'bot' && (
                  <div className="flex-shrink-0 w-12 h-12 bg-[#21c55e] rounded-full flex items-center justify-center text-white shadow-sm mt-1">
                    <Smile className="w-6 h-6" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`p-6 rounded-3xl text-[17px] leading-relaxed relative ${
                  msg.sender === 'user' 
                    ? 'bg-[#1ed760] text-white rounded-br-sm shadow-sm' 
                    : 'bg-[#f3fbf8] text-gray-800 rounded-bl-sm border border-[#e6f5ef]'
                }`}>
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i !== msg.text.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                  
                  {msg.sender === 'bot' && (
                    <div className="text-[12px] text-gray-400 mt-4 flex items-center gap-1">
                       <span className="inline-block w-3 h-3 border border-gray-300 rounded-full flex items-center justify-center text-[8px]">◑</span>
                       {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 max-w-[85%]">
                <div className="flex-shrink-0 w-12 h-12 bg-[#21c55e] rounded-full flex items-center justify-center text-white shadow-sm mt-1">
                  <Smile className="w-6 h-6" />
                </div>
                <div className="bg-[#f3fbf8] border border-[#e6f5ef] p-6 rounded-3xl rounded-bl-sm text-gray-800 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                  <span className="text-gray-500 text-[16px]">MindBridge is typing...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-8 pt-4 pb-10 bg-white/50 backdrop-blur-md border-t border-gray-50">
          
          {/* Quick Feeling Pills */}
          {messages.length === 1 && (
            <div className="mb-6 animate-fade-in">
              <p className="text-gray-500 text-sm font-medium mb-3 pl-2">How are you feeling right now?</p>
              <div className="flex flex-wrap gap-3">
                {feelingPills.map(pill => (
                  <button 
                    key={pill.label}
                    onClick={() => handleSend(`I'm feeling ${pill.label.toLowerCase()} today.`)}
                    className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm py-2 px-5 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    <span className="text-lg">{pill.emoji}</span>
                    <span className="text-gray-700 font-medium text-[15px]">{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Input Row */}
          <div className="flex items-center gap-4">
             <div className="flex-1 bg-white border border-gray-200 rounded-full shadow-sm flex items-center relative overflow-hidden outline focus-within:outline-2 focus-within:outline-[#21c55e]/20 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Tell me what's on your mind..."
                  className="w-full py-4 px-6 text-[17px] text-gray-800 bg-transparent outline-none placeholder-gray-400"
                />
                
                {/* Inline Mic Icon (just visual per design, Voice goes to Voice page) */}
                <button className="pr-6 pl-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <div className="bg-gray-100 p-2 rounded-full">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                </button>
             </div>
             
             <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="bg-[#1ed760] hover:bg-[#1db954] disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-4 rounded-full shadow-md transition-all shrink-0 hover:scale-105 active:scale-95"
             >
                <Send className="w-7 h-7 ml-1" />
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
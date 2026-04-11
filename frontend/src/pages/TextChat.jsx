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
    <div className="flex flex-col items-center justify-start w-full max-w-4xl mx-auto h-full min-h-0 relative z-10 animate-fade-in p-1 sm:p-4">
      
      {/* Safe Space Badge */}
      <div className="bg-white/80 backdrop-blur-sm border border-[#e2efe9] shadow-sm text-gray-700 py-2 sm:py-3 px-5 sm:px-8 rounded-full flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-6 mt-2 sm:mt-4">
        <div className="bg-[#ccf6f1] p-1.5 rounded-full">
           <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" fill="currentColor" />
        </div>
        <span className="font-medium text-sm sm:text-[16px]">You're in a safe space</span>
      </div>

      {/* Main Chat Window */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl sm:rounded-[2.5rem] w-full flex-1 flex flex-col overflow-hidden relative min-h-0">
        
        {/* Messages Layout */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-10 pb-3 sm:pb-4">
          <div className="flex flex-col gap-4 sm:gap-8">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 sm:gap-4 max-w-[92%] sm:max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                
                {/* Bot Avatar */}
                {msg.sender === 'bot' && (
                  <div className="flex-shrink-0 w-8 h-8 sm:w-12 sm:h-12 bg-[#21c55e] rounded-full flex items-center justify-center text-white shadow-sm mt-1">
                    <Smile className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`p-3 sm:p-6 rounded-2xl sm:rounded-3xl text-[15px] sm:text-[17px] leading-relaxed relative ${
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
                    <div className="text-[11px] sm:text-[12px] text-gray-400 mt-2 sm:mt-4 flex items-center gap-1">
                       <span className="inline-block w-3 h-3 border border-gray-300 rounded-full flex items-center justify-center text-[8px]">◑</span>
                       {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-2 sm:gap-4 max-w-[92%] sm:max-w-[85%]">
                <div className="flex-shrink-0 w-8 h-8 sm:w-12 sm:h-12 bg-[#21c55e] rounded-full flex items-center justify-center text-white shadow-sm mt-1">
                  <Smile className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <div className="bg-[#f3fbf8] border border-[#e6f5ef] p-3 sm:p-6 rounded-2xl sm:rounded-3xl rounded-bl-sm text-gray-800 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-teal-500" />
                  <span className="text-gray-500 text-sm sm:text-[16px]">MindBridge is typing...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-8 pt-3 sm:pt-4 pb-4 sm:pb-10 bg-white/50 backdrop-blur-md border-t border-gray-50">
          
          {/* Quick Feeling Pills */}
          {messages.length === 1 && (
            <div className="mb-3 sm:mb-6 animate-fade-in">
              <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2 sm:mb-3 pl-2">How are you feeling right now?</p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {feelingPills.map(pill => (
                  <button 
                    key={pill.label}
                    onClick={() => handleSend(`I'm feeling ${pill.label.toLowerCase()} today.`)}
                    className="flex items-center gap-1.5 sm:gap-2 bg-white border border-gray-200 shadow-sm py-1.5 sm:py-2 px-3 sm:px-5 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    <span className="text-base sm:text-lg">{pill.emoji}</span>
                    <span className="text-gray-700 font-medium text-[13px] sm:text-[15px]">{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Input Row */}
          <div className="flex items-center gap-2 sm:gap-4">
             <div className="flex-1 bg-white border border-gray-200 rounded-full shadow-sm flex items-center relative overflow-hidden outline focus-within:outline-2 focus-within:outline-[#21c55e]/20 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Tell me what's on your mind..."
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 text-[15px] sm:text-[17px] text-gray-800 bg-transparent outline-none placeholder-gray-400"
                />
             </div>
             
             <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="bg-[#1ed760] hover:bg-[#1db954] disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 sm:p-4 rounded-full shadow-md transition-all shrink-0 hover:scale-105 active:scale-95"
             >
                <Send className="w-5 h-5 sm:w-7 sm:h-7 ml-0.5 sm:ml-1" />
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
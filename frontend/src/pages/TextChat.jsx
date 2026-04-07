import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Send, User, Bot, Loader2 } from 'lucide-react';

export default function TextChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  const sessionId = useMemo(() => {
    let id = localStorage.getItem('mindbridge_session_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mindbridge_session_id', id);
    }
    return id;
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setInput('');

    try {
      console.log(`[TextChat] Sending message to backend: "${userMsg.content}"`);
      const API_BASE_URL = `http://${window.location.hostname}:5000`;
      const response = await axios.post(`${API_BASE_URL}/api/chat`, { 
        text: userMsg.content,
        sessionId
      });
      console.log("[TextChat] Received successful response from backend:", response.data);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: response.data.companion_reply }
      ]);
    } catch (error) {
      console.error("\n================ TEXT CHAT REQUEST ERROR ================");
      console.error("Time:", new Date().toISOString());
      console.error("Message Sent:", userMsg.content);
      console.error("Error Message:", error.message);
      if (error.response) {
        console.error("Response Status:", error.response.status);
        console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error("No response received. Request was:", error.request);
      }
      console.error("=========================================================\n");
      
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: "I'm having a bit of trouble responding right now. Please try again." }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
      <div className="bg-teal-600 text-white p-4 font-medium flex items-center justify-between shadow-sm z-10">
        <div>MindBridge Companion</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`p-3 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-md rounded-br-none' 
                  : 'bg-white text-gray-800 border-2 border-teal-100 shadow-sm rounded-bl-none'
              }`}>
                <p className="leading-snug text-[15px]">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-500 p-4 border-2 border-teal-100/50 shadow-sm rounded-2xl rounded-bl-none flex gap-2 w-16 h-12 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 shadow-2xl z-10">
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            type="text"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all font-medium text-gray-800 placeholder-gray-400"
            placeholder="How are you feeling?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md"
          >
            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -rotate-45 relative right-0.5 top-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}

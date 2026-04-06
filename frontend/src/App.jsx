import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import VoiceChat from './pages/VoiceChat';
import TextChat from './pages/TextChat';
import Dashboard from './pages/Dashboard';
import { Home, Mic, MessageSquare, Activity } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <nav className="bg-white shadow-sm p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold text-teal-700 flex items-center gap-2">
              <Home className="w-5 h-5" /> MindBridge
            </h1>
            <div className="flex gap-4">
              <Link to="/voice" className="flex items-center gap-1 text-gray-600 hover:text-teal-600">
                <Mic className="w-4 h-4"/> Voice
              </Link>
              <Link to="/text" className="flex items-center gap-1 text-gray-600 hover:text-teal-600">
                <MessageSquare className="w-4 h-4"/> Text
              </Link>
              <Link to="/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600">
                <Activity className="w-4 h-4"/> Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <main className="flex-1 w-full max-w-6xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<VoiceChat />} />
            <Route path="/voice" element={<VoiceChat />} />
            <Route path="/text" element={<TextChat />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

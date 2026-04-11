import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import VoiceChat from './pages/VoiceChat';
import TextChat from './pages/TextChat';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import Navigation from './components/Navigation';

function App() {
  return (
    <Router>
      <div className="h-screen h-[100dvh] flex flex-col bg-gradient-to-br from-[#f0fdff] to-[#e8fcf9] relative overflow-hidden">
        
        {/* Abstract Blobs */}
        <div className="absolute top-20 -left-20 w-48 h-48 sm:w-96 sm:h-96 bg-[#d0f5ee] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-40 right-10 sm:right-20 w-36 h-36 sm:w-72 sm:h-72 bg-[#e0f2fe] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-20 sm:left-40 w-48 h-48 sm:w-96 sm:h-96 bg-[#dcfce7] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

        <Navigation />

        <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-4 flex flex-col relative z-10 overflow-y-auto overflow-x-hidden min-h-0">
          <Routes>
            <Route path="/" element={<Setup />} />
            <Route path="/home" element={<VoiceChat />} />
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

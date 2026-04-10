import { Link, useLocation } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { Home, Mic, MessageSquare, Activity } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  if (location.pathname === '/') return null;

  const getPillClasses = (isActive) => {
    return `flex items-center gap-2 px-6 py-2.5 rounded-full transition-all font-medium text-[16px] ${
      isActive 
        ? 'bg-[#f4fdff] shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-teal-100 text-gray-900' 
        : 'text-gray-500 hover:text-gray-700'
    }`;
  };

  return (
    <nav className="sticky top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100/50 p-4 z-[100] shadow-sm flex-none">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
        <div className="flex items-center sm:items-start gap-4">
          <img src={logoUrl} alt="MindBridge Logo" className="w-14 h-14" 
               onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=MB&background=dcfce7&color=0f766e&rounded=true' }} />
          <div className="pt-1">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">MindBridge</h1>
            <p className="text-[15px] text-gray-500">Your AI Support Companion</p>
          </div>
        </div>
        
        {/* Unified Top Panel Segmented Control */}
        <div className="flex gap-1 p-1 bg-white shadow-sm border border-gray-100 rounded-full items-center">
          <Link to="/voice" className={getPillClasses(location.pathname === '/home' || location.pathname === '/voice')}>
            <Mic className={`w-[18px] h-[18px] ${location.pathname === '/home' || location.pathname === '/voice' ? 'text-teal-600' : 'text-gray-400'}`}/> Voice
          </Link>
          <Link to="/text" className={getPillClasses(location.pathname === '/text')}>
            <MessageSquare className={`w-[18px] h-[18px] ${location.pathname === '/text' ? 'text-teal-500' : 'text-gray-400'}`}/> Text
          </Link>
          {import.meta.env.DEV && (
            <Link to="/dashboard" className={getPillClasses(location.pathname === '/dashboard')}>
              <Activity className={`w-[18px] h-[18px] ${location.pathname === '/dashboard' ? 'text-indigo-500' : 'text-gray-400'}`}/> Dashboard
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
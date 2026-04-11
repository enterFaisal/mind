import { Link, useLocation } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { Home, Mic, MessageSquare, Activity } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  if (location.pathname === '/') return null;

  const getPillClasses = (isActive) => {
    return `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all font-medium text-sm sm:text-[16px] ${
      isActive 
        ? 'bg-[#f4fdff] shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-teal-100 text-gray-900' 
        : 'text-gray-500 hover:text-gray-700'
    }`;
  };

  return (
    <nav className="sticky top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100/50 px-3 py-2 sm:p-4 z-[100] shadow-sm flex-none">
      <div className="max-w-6xl mx-auto flex flex-row justify-between items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <img src={logoUrl} alt="MindBridge Logo" className="w-9 h-9 sm:w-14 sm:h-14 shrink-0" 
               onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=MB&background=dcfce7&color=0f766e&rounded=true' }} />
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 leading-tight truncate">MindBridge</h1>
            <p className="text-xs sm:text-[15px] text-gray-500 hidden sm:block">Your AI Support Companion</p>
          </div>
        </div>
        
        <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white shadow-sm border border-gray-100 rounded-full items-center shrink-0">
          <Link to="/voice" className={getPillClasses(location.pathname === '/home' || location.pathname === '/voice')}>
            <Mic className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/home' || location.pathname === '/voice' ? 'text-teal-600' : 'text-gray-400'}`}/> 
            <span className="hidden xs:inline sm:inline">Voice</span>
          </Link>
          <Link to="/text" className={getPillClasses(location.pathname === '/text')}>
            <MessageSquare className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/text' ? 'text-teal-500' : 'text-gray-400'}`}/> 
            <span className="hidden xs:inline sm:inline">Text</span>
          </Link>
          <Link to="/dashboard" className={getPillClasses(location.pathname === '/dashboard')}>
            <Activity className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/dashboard' ? 'text-indigo-500' : 'text-gray-400'}`}/> 
            <span className="hidden xs:inline sm:inline">Dashboard</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
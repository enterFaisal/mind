import { Link, useLocation } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { Activity, LogOut, Mic, MessageSquare, Shield, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  if (location.pathname === '/login' || location.pathname === '/setup') return null;

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
        
        {currentUser && (
          <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white shadow-sm border border-gray-100 rounded-full items-center shrink-0">
            {currentUser.role === 'PATIENT' && (
              <>
                <Link to="/chat" className={getPillClasses(location.pathname === '/chat')}>
                  <Mic className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/chat' ? 'text-teal-600' : 'text-gray-400'}`}/> 
                  <span className="hidden xs:inline sm:inline">Voice</span>
                </Link>
                <Link to="/chat/text" className={getPillClasses(location.pathname === '/chat/text')}>
                  <MessageSquare className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/chat/text' ? 'text-teal-500' : 'text-gray-400'}`}/> 
                  <span className="hidden xs:inline sm:inline">Text</span>
                </Link>
              </>
            )}
            {currentUser.role === 'DOCTOR' && (
              <Link to="/doctor" className={getPillClasses(location.pathname.startsWith('/doctor'))}>
                <Stethoscope className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname.startsWith('/doctor') ? 'text-indigo-500' : 'text-gray-400'}`}/> 
                <span className="hidden xs:inline sm:inline">Patients</span>
              </Link>
            )}
            {currentUser.role === 'ADMIN' && (
              <Link to="/admin" className={getPillClasses(location.pathname === '/admin')}>
                <Shield className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${location.pathname === '/admin' ? 'text-indigo-500' : 'text-gray-400'}`}/> 
                <span className="hidden xs:inline sm:inline">Admin</span>
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full transition-all font-medium text-sm sm:text-[16px] text-gray-500 hover:text-red-600"
            >
              <LogOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
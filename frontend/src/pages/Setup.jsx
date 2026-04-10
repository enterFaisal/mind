import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../assets/logo.svg';
import { Globe, Volume2 } from 'lucide-react';

export default function Setup() {
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(null);
  const [voice, setVoice] = useState(null);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      // Save preferences ideally, then navigate to main app
      localStorage.setItem('mindbridge_setup_complete', 'true');
      localStorage.setItem('mindbridge_language', language || 'EN');
      localStorage.setItem('mindbridge_voice', voice || 'female');
      navigate('/home');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-gradient-to-br from-[#e6fbf9] to-[#f0fdff] w-full absolute top-0 left-0 h-screen z-50">
      
      {/* Abstract Brain Logo Placeholder */}
      <div className="mb-8 relative w-24 h-24">
         <img src={logoUrl} alt="MindBridge Logo" className="w-full h-full object-contain" 
              onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=MB&background=dcfce7&color=0f766e&rounded=true' }} />
      </div>

      {step === 0 && (
        <div className="text-center max-w-md animate-fade-in px-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Welcome, I'm here for you</h1>
          <p className="text-lg text-gray-600 mb-10">
            You can talk to me anytime. Let's make this space comfortable for you.
          </p>
          <button 
            onClick={handleNext}
            className="bg-[#86e2b9] hover:bg-[#68d6a6] text-white font-medium py-3 px-8 rounded-xl transition-all shadow-sm text-lg"
          >
            Start Conversation
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="text-center max-w-2xl w-full px-4 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Let's Do a quick Set Up</h1>
          <p className="text-lg text-gray-600 mb-10">
            You can talk to me anytime. Let's make this space comfortable for you.
          </p>
          
          <div className="bg-white rounded-3xl p-8 shadow-sm max-w-xl mx-auto border border-gray-50">
            <div className="flex justify-center mb-6">
              <div className="bg-[#21c55e] p-3 rounded-2xl text-white">
                <Globe className="w-6 h-6" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Language</h2>
            <p className="text-gray-500 mb-8">Communicate in the language you're most comfortable with</p>
            
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
              <button 
                onClick={() => setLanguage('AR')}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-4 ${language === 'AR' ? 'border-[#38bdf8] bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
              >
                <div className="w-14 h-14 rounded-full bg-[#6ee7b7] flex items-center justify-center text-white font-bold text-xl">AR</div>
                <span className="font-semibold text-gray-800">العربية</span>
              </button>
              
              <button 
                onClick={() => setLanguage('EN')}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-4 ${language === 'EN' ? 'border-[#38bdf8] bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
              >
                <div className="w-14 h-14 rounded-full bg-[#93c5fd] flex items-center justify-center text-white font-bold text-xl">EN</div>
                <span className="font-semibold text-gray-800">English</span>
              </button>
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={handleNext}
              disabled={!language}
              className={`font-medium py-3 px-12 rounded-xl transition-all shadow-sm text-lg ${language ? 'bg-[#86e2b9] hover:bg-[#68d6a6] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Next
            </button>
            <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gray-200 text-white flex items-center justify-center text-[10px]">i</span>
              You can change these settings anytime in your preferences
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="text-center max-w-2xl w-full px-4 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Let's Do a quick Set Up</h1>
          <p className="text-lg text-gray-600 mb-10">
            You can talk to me anytime. Let's make this space comfortable for you.
          </p>
          
          <div className="bg-white rounded-3xl p-8 shadow-sm max-w-xl mx-auto border border-gray-50">
            <div className="flex justify-center mb-6">
              <div className="bg-[#21c55e] p-3 rounded-2xl text-white">
                 <Volume2 className="w-6 h-6" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Companion Voice</h2>
            <p className="text-gray-500 mb-8">Select the voice that feels most comforting to you</p>
            
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
              <button 
                onClick={() => setVoice('female')}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-4 ${voice === 'female' ? 'border-[#38bdf8] bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
              >
                <div className="w-14 h-14 rounded-full bg-[#fbcfe8] flex items-center justify-center text-[#be185d]">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a3 3 0 100 6 3 3 0 000-6zm2 7.2l3.44 6.88c.28.56-.12 1.22-.75 1.22H15v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6H7.31c-.63 0-1.03-.66-.75-1.22L10 9.2V9h4v.2z"/>
                   </svg>
                </div>
                <div>
                    <span className="font-semibold text-gray-800 block">Female Voice</span>
                    <span className="text-xs text-gray-500 mt-1">Warm and nurturing tone</span>
                </div>
              </button>
              
              <button 
                onClick={() => setVoice('male')}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-4 ${voice === 'male' ? 'border-[#38bdf8] bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
              >
                <div className="w-14 h-14 rounded-full bg-[#bfdbfe] flex items-center justify-center text-[#1d4ed8]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div>
                    <span className="font-semibold text-gray-800 block">Male Voice</span>
                    <span className="text-xs text-gray-500 mt-1">Calm and reassuring tone</span>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={handleNext}
              disabled={!voice}
              className={`font-medium py-3 px-12 rounded-xl transition-all shadow-sm text-lg ${voice ? 'bg-[#86e2b9] hover:bg-[#68d6a6] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Start Conversation
            </button>
            <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gray-200 text-white flex items-center justify-center text-[10px]">i</span>
              You can change these settings anytime in your preferences
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
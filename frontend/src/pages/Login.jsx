import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const rolePath = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  PATIENT: '/chat',
};

export default function Login() {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(id.trim());
      navigate(rolePath[user.role] || '/chat', { replace: true });
    } catch {
      setError('Account not found. Please contact the administrator.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-white/70 shadow-sm rounded-[2rem] p-8 animate-fade-in"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#dcfce7] text-teal-700 flex items-center justify-center mb-6">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MindBridge</h1>
        <p className="text-gray-500 mb-8">
          Enter your hospital-issued ID to continue.
        </p>

        <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="user-id">
          User ID
        </label>
        <input
          id="user-id"
          value={id}
          onChange={(event) => setId(event.target.value.replace(/\D/g, '').slice(0, 10))}
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          placeholder="Example: 1000000000"
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all"
        />

        {error && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !id.trim()}
          className="mt-6 w-full rounded-2xl bg-[#1ed760] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#1db954] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <LogIn className="w-5 h-5" />
          {isLoading ? 'Checking account...' : 'Continue'}
        </button>

        <p className="mt-5 text-xs text-gray-400">
          Default seeded admin ID: <span className="font-semibold text-gray-500">1000000000</span>
        </p>
      </form>
    </div>
  );
}

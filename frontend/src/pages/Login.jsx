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


        <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-600">
          <p className="font-semibold text-gray-800 mb-2">Demo accounts</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border">
              <div>
                <div className="font-medium text-gray-900">MindBridge Admin</div>
                <div className="text-xs text-gray-500">Role: ADMIN • ID: 1000000000</div>
              </div>
              <button
                type="button"
                onClick={() => setId('1000000000')}
                className="text-sm text-teal-600 font-semibold"
              >
                Use
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border">
              <div>
                <div className="font-medium text-gray-900">Dr. yasir</div>
                <div className="text-xs text-gray-500">Role: DOCTOR • ID: 0000000000</div>
              </div>
              <button
                type="button"
                onClick={() => setId('0000000000')}
                className="text-sm text-teal-600 font-semibold"
              >
                Use
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border">
              <div>
                <div className="font-medium text-gray-900">Ahmed</div>
                <div className="text-xs text-gray-500">Role: PATIENT • ID: 1111111111</div>
              </div>
              <button
                type="button"
                onClick={() => setId('1111111111')}
                className="text-sm text-teal-600 font-semibold"
              >
                Use
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Tip: click 'Use' to autofill the ID for demo login.</p>
        </div>

      </form>
    </div>
  );
}

import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import VoiceChat from './pages/VoiceChat';
import TextChat from './pages/TextChat';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Doctor from './pages/Doctor';
import Navigation from './components/Navigation';
import { AuthProvider, useAuth } from './context/AuthContext';

const rolePath = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  PATIENT: '/chat',
};

function ProtectedRoute({ allowedRoles, children }) {
  const { currentUser, isReady } = useAuth();

  if (!isReady) {
    return <div className="p-8 text-center text-gray-400 font-medium">Loading MindBridge...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={rolePath[currentUser.role] || '/login'} replace />;
  }

  return children;
}

function RoleRedirect() {
  const { currentUser, isReady } = useAuth();

  if (!isReady) {
    return <div className="p-8 text-center text-gray-400 font-medium">Loading MindBridge...</div>;
  }

  return <Navigate to={currentUser ? rolePath[currentUser.role] : '/login'} replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="h-screen h-[100dvh] flex flex-col bg-gradient-to-br from-[#f0fdff] to-[#e8fcf9] relative overflow-hidden">
          
          {/* Abstract Blobs */}
          <div className="absolute top-20 -left-20 w-48 h-48 sm:w-96 sm:h-96 bg-[#d0f5ee] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
          <div className="absolute top-40 right-10 sm:right-20 w-36 h-36 sm:w-72 sm:h-72 bg-[#e0f2fe] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-20 sm:left-40 w-48 h-48 sm:w-96 sm:h-96 bg-[#dcfce7] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

          <Navigation />

          <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-4 flex flex-col relative z-10 overflow-y-auto overflow-x-hidden min-h-0">
            <Routes>
              <Route path="/" element={<RoleRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/setup" element={<Setup />} />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <VoiceChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/text"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT']}>
                    <TextChat />
                  </ProtectedRoute>
                }
              />
              <Route path="/home" element={<Navigate to="/chat" replace />} />
              <Route path="/voice" element={<Navigate to="/chat" replace />} />
              <Route path="/text" element={<Navigate to="/chat/text" replace />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR']}>
                    <Doctor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/patient/:patientId"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR']}>
                    <Doctor />
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard" element={<RoleRedirect />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;

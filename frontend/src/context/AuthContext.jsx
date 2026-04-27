/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

const STORAGE_KEY = 'mindbridge_current_user';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (/^\d{10}$/.test(parsedUser?.id || '')) {
          return parsedUser;
        }
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return null;
  });
  const isReady = true;

  const login = async (id) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { id });
    setCurrentUser(response.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data));
    return response.data;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const authHeaders = useMemo(
    () => (currentUser ? { 'x-user-id': currentUser.id } : {}),
    [currentUser],
  );

  const value = useMemo(
    () => ({ authHeaders, currentUser, isReady, login, logout }),
    [authHeaders, currentUser, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  guestLogin: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  guestLogin: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for dummy user in session storage for persistence during preview
    const dummyUserStr = sessionStorage.getItem('landguard_guest_user');
    if (dummyUserStr) {
      const dummyData = JSON.parse(dummyUserStr);
      const dummy = {
        ...dummyData,
        getIdToken: async () => 'guest-token'
      } as any;
      setUser(dummy);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (error) => {
      console.warn("Firebase Auth error (likely missing config):", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    sessionStorage.removeItem('landguard_guest_user');
    await signOut(auth);
    setUser(null);
  };

  const guestLogin = () => {
    const dummy = { 
      uid: 'guest-user', 
      email: 'guest@landguard.ai', 
      displayName: 'Guest User',
      emailVerified: true,
      getIdToken: async () => 'guest-token'
    } as any; // Cast to any to bypass strict Firebase User type which has many internal methods
    sessionStorage.setItem('landguard_guest_user', JSON.stringify({
      uid: dummy.uid,
      email: dummy.email,
      displayName: dummy.displayName,
      emailVerified: dummy.emailVerified
    }));
    setUser(dummy);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, guestLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

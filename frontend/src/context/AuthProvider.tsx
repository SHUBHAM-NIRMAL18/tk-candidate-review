import React, { useState, useEffect } from 'react';
import type { User } from '../types/auth';
import { apiFetch } from '../api/client';
import { AuthContext } from './AuthContext';
import { triggerToast } from '../utils/toast';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const fetchUser = async () => {
      try {
        const response = await fetch('/api/v1/auth/me', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Not authenticated');
        const userData: User = await response.json();
        if (isMounted) setUser(userData);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Save toast before updating context user state
    triggerToast(
      'Login Successfully!',
      `Signed in successfully! Welcome back, ${res.user.email}.`,
      'success'
    );

    setUser(res.user);
  };

  const register = async (email: string, password: string) => {
    await apiFetch<{ user: User }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Save toast for login page before clearing registration session
    triggerToast(
      'Register Successfully!',
      `Account for ${email} registered successfully! Please sign in below.`,
      'success'
    );

    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      setUser(null);
    }
  };

  const logout = async () => {
    // Save toast for login page before clearing user state
    triggerToast(
      'Logout Successfully!',
      'Session logged out successfully!',
      'success'
    );

    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

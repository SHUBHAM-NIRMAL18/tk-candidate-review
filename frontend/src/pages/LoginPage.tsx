import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { AuthForm } from '../components/AuthForm';
import { Toast } from '../components/Toast';
import { consumeToast, type ToastData } from '../utils/toast';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    const pendingToast = consumeToast();
    if (pendingToast) {
      setToast(pendingToast);
    }
  }, []);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  return (
    <div className="auth-page-container">
      {toast && (
        <Toast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <AuthForm mode="login" onSubmit={handleLogin} />
    </div>
  );
};

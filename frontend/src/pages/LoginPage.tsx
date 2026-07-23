import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthForm } from '../components/AuthForm';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page-container">
      <AuthForm mode="login" onSubmit={handleLogin} />
    </div>
  );
};

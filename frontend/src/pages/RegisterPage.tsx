import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthForm } from '../components/AuthForm';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (email: string, password: string) => {
    await register(email, password);
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page-container">
      <AuthForm mode="register" onSubmit={handleRegister} />
    </div>
  );
};

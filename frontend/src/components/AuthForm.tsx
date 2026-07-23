import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import './AuthForm.css';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (email: string, password: string) => Promise<void>;
}

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthForm: React.FC<AuthFormProps> = ({ mode, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address (e.g. name@techkraft.com).';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long.';
    }

    if (isRegister) {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Perform registration/login API request
      await onSubmit(email.trim(), password);

      // Display success modal overlay
      const successText = isRegister 
        ? `Account for ${email.trim()} registered successfully as Reviewer! Redirecting...` 
        : `Signed in successfully as ${email.trim()}! Redirecting...`;
      
      setSuccessMessage(successText);

      // Keep success popup visible for 1.5s before redirect completes
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err: any) {
      setErrors({
        form: err.message || 'Authentication failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {successMessage && (
        <div className="success-popup-overlay">
          <div className="success-popup-card">
            <div className="success-icon-wrapper">
              <CheckCircle2 className="success-icon" size={32} />
            </div>
            <h3>{isRegister ? 'Registration Successful!' : 'Welcome Back!'}</h3>
            <p>{successMessage}</p>
            <div className="popup-progress-bar">
              <div className="popup-progress-fill" />
            </div>
          </div>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-header">
          <img src="/TechKraft-Logo.svg" alt="TechKraft Logo" className="auth-logo" />
          <h2 className="auth-title">
            {isRegister ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p className="auth-subtitle">
            {isRegister 
              ? 'Register to review candidates and manage evaluations' 
              : 'Sign in to access your Candidate Review Dashboard'}
          </p>
        </div>

        {errors.form && (
          <div className="auth-alert error">
            <AlertCircle className="alert-icon" size={18} />
            <span>{errors.form}</span>
          </div>
        )}

        {isRegister && (
          <div className="role-security-badge">
            <ShieldCheck className="shield-icon" size={18} />
            <div>
              <strong>Role Enforcement:</strong> New registrations strictly default to the <span>Reviewer</span> role.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">
              Email Address <span className="required-asterisk">*</span>
            </label>
            <div className={`input-wrapper ${errors.email ? 'input-error' : ''}`}>
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                placeholder="you@techkraft.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={loading}
              />
            </div>
            {errors.email && <span className="field-error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password <span className="required-asterisk">*</span>
            </label>
            <div className={`input-wrapper ${errors.password ? 'input-error' : ''}`}>
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={loading}
              />
            </div>
            {errors.password && <span className="field-error-text">{errors.password}</span>}
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required-asterisk">*</span>
              </label>
              <div className={`input-wrapper ${errors.confirmPassword ? 'input-error' : ''}`}>
                <Lock className="input-icon" size={18} />
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  disabled={loading}
                />
              </div>
              {errors.confirmPassword && (
                <span className="field-error-text">{errors.confirmPassword}</span>
              )}
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="spinner" size={18} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isRegister ? 'Register Account' : 'Sign In'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">
                Register as Reviewer
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
};

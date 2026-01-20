import React, { useState } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import PasswordStrength from './components/PasswordStrength';

function ForgotPassword({ onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);

  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must contain at least one special character (!@#$%^&*)';
    return null;
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/forgot-password`, { email });
      if (response.data.success) {
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/verify-reset-code`, { email, code });
      if (response.data.success) {
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/reset-password`, { email, code, newPassword });
      if (response.data.success) {
        setAlert({ type: 'success', title: 'Success', message: 'Password reset successfully!' });
        setTimeout(() => onBack(), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => { setAlert(null); onBack(); }}
        />
      )}
      <div className="flex min-h-screen bg-navy-dark items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-navy-dark p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-6">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none" className="mx-auto mb-3">
              <circle cx="50" cy="50" r="48" fill="#FF7120" opacity="0.1"/>
              <circle cx="50" cy="50" r="40" fill="#FF7120"/>
              <path d="M50 35v20M50 65h.01" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            </svg>
            <h2 className="text-white text-2xl font-semibold mb-2">
              {step === 1 && 'Forgot Password?'}
              {step === 2 && 'Enter Verification Code'}
              {step === 3 && 'Set New Password'}
            </h2>
            <p className="text-gray-400 text-sm">
              {step === 1 && 'Enter your email to receive a verification code'}
              {step === 2 && 'Check your email for the 6-digit code'}
              {step === 3 && 'Enter your new password'}
            </p>
          </div>

          {step === 1 && (
            <form onSubmit={handleSendCode}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 mb-4 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] placeholder:text-gray-500"
              />

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-base transition-all shadow-[0_4px_12px_rgba(255,113,32,0.3)] hover:shadow-[0_6px_20px_rgba(255,113,32,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Sending...' : 'Send Code'}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full text-primary text-sm hover:text-primary-dark hover:underline transition-colors"
                style={{background: 'none', border: 'none', cursor: 'pointer'}}
              >
                Back to Login
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="w-full px-4 py-3.5 mb-4 bg-navy border-2 border-primary/20 rounded-xl text-white text-base text-center tracking-widest transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] placeholder:text-gray-500"
              />

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full px-4 py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-base transition-all shadow-[0_4px_12px_rgba(255,113,32,0.3)] hover:shadow-[0_6px_20px_rgba(255,113,32,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-primary text-sm hover:text-primary-dark hover:underline transition-colors"
                style={{background: 'none', border: 'none', cursor: 'pointer'}}
              >
                Back
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] placeholder:text-gray-500"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
              </div>

              <PasswordStrength password={newPassword} />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 mb-4 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] placeholder:text-gray-500"
              />

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-base transition-all shadow-[0_4px_12px_rgba(255,113,32,0.3)] hover:shadow-[0_6px_20px_rgba(255,113,32,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;

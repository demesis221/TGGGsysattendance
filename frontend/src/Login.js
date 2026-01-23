import React, { useState, useEffect } from 'react';
import axios from 'axios';
import supabase from './supabaseClient';
import Lottie from 'lottie-react';
import cityBuildingAnimation from './cityBuilding.json';
import PasswordStrength from './components/PasswordStrength';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Login({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    acceptTerms: false,
    rememberMe: false,
    isEmployeeOrTrainee: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for OAuth callback
    const checkOAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          // Send token to backend for verification and profile creation
          const response = await axios.post(`${API}/auth/google`, {
            token: session.access_token
          });
          
          localStorage.setItem('token', session.access_token);
          localStorage.setItem('user', JSON.stringify({ 
            role: response.data.role, 
            name: response.data.name 
          }));
          onLogin(session.access_token, { 
            role: response.data.role, 
            name: response.data.name 
          });
        } catch (err) {
          console.error('OAuth callback error:', err);
          setError('Authentication failed. Please try again.');
        }
      }
    };
    checkOAuthCallback();
  }, [onLogin]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(''); // Clear error on input change
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Invalid email format';
    if (!email.endsWith('@gmail.com')) return 'Only @gmail.com emails are allowed';
    return null;
  };

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must contain at least one special character (!@#$%^&*)';
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/login`, { 
        email: formData.email, 
        password: formData.password 
      });
      
      if (formData.rememberMe) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ role: data.role, name: data.name }));
        localStorage.setItem('rememberMe', 'true');
      } else {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify({ role: data.role, name: data.name }));
        localStorage.removeItem('rememberMe');
      }
      
      onLogin(data.token, { role: data.role, name: data.name });
    } catch (err) { 
      const message = err.response?.data?.error || 'Invalid credentials. Please try again.';
      setError(message); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate employee/trainee status
    if (!formData.isEmployeeOrTrainee) {
      setError('You must be an employee or OJT trainee of Triple G to create an account.');
      return;
    }
    
    // Validate email
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setError(emailError);
      return;
    }
    
    // Validate password
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    
    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      await axios.post(`${API}/signup`, {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
        isEmployeeOrTrainee: formData.isEmployeeOrTrainee
      });
      setIsSignup(false);
      setFormData({ firstName: '', lastName: '', email: '', password: '', acceptTerms: false, rememberMe: false, isEmployeeOrTrainee: false });
      setError(formData.isEmployeeOrTrainee 
        ? 'Signup submitted for coordinator verification. You can log in once approved.'
        : 'Account created successfully! Please log in.');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
      console.error('Google sign-in error:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-navy-dark items-center justify-center p-4 md:p-8">
      <div className="flex flex-col md:flex-row w-full max-w-[1100px] md:h-[75vh] min-h-[600px] rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Left Side - Hero Section */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-navy to-navy-light items-center justify-center p-12 relative overflow-hidden">
          {/* Lottie Animation Background - Positioned at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[80%] opacity-40">
            <Lottie 
              animationData={cityBuildingAnimation} 
              loop={true}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'bottom' }}
            />
          </div>
          
          <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(255,113,32,0.2)_0%,_transparent_70%)] rounded-full -top-[300px] -left-[250px] animate-pulse"></div>
          
          <div className="relative z-10 text-center max-w-[500px]">
            <div className="mb-10 animate-bounce">
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="mx-auto drop-shadow-[0_10px_30px_rgba(255,113,32,0.3)]">
                <circle cx="50" cy="50" r="48" fill="#FF7120" opacity="0.1"/>
                <circle cx="50" cy="50" r="40" fill="#FF7120"/>
                <path d="M32 50L43 61L68 36" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-5xl font-light text-white leading-tight mb-4 [text-shadow:_0_2px_10px_rgba(0,0,0,0.2)]">
              Tracking Progress,<br/>Building Futures
            </h1>
            <p className="text-white/70 text-lg mb-12 font-light">
              Streamlined attendance management for your OJT program
            </p>
            <div className="flex gap-2.5 justify-center">
              <span className="w-10 h-1 bg-white/30 rounded-sm"></span>
              <span className="w-[60px] h-1 bg-primary rounded-sm"></span>
              <span className="w-10 h-1 bg-white/30 rounded-sm"></span>
            </div>
          </div>
          
          <div className="absolute -bottom-12 -right-12 w-[300px] h-[300px] border-2 border-primary/10 rounded-full animate-spin [animation-duration:20s]"></div>
        </div>

        {/* Right Side - Form Section */}
        <div className="flex-1 flex items-center justify-center bg-navy-dark p-4 md:p-8 overflow-y-auto scrollbar-none">
          <div className="w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="md:hidden text-center mb-6">
              <svg width="60" height="60" viewBox="0 0 100 100" fill="none" className="mx-auto mb-3">
                <circle cx="50" cy="50" r="48" fill="#FF7120" opacity="0.1"/>
                <circle cx="50" cy="50" r="40" fill="#FF7120"/>
                <path d="M32 50L43 61L68 36" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-white text-xl font-semibold">Triple G BuildHub</h2>
            </div>

            <h2 className="text-white text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
              {isSignup ? 'Create an account' : 'Welcome Back'}
            </h2>
            
            <p className="text-gray-400 mb-4 md:mb-6 text-xs md:text-sm">
              {isSignup ? (
                <>Already have an account? <button className="text-primary font-semibold underline hover:text-primary-dark" onClick={() => setIsSignup(false)}>Log in</button></>
              ) : (
                <>Don't have an account? <button className="text-primary font-semibold underline hover:text-primary-dark" onClick={() => setIsSignup(true)}>Sign up</button></>
              )}
            </p>

            <form onSubmit={isSignup ? handleSignup : handleLogin}>
              {isSignup && (
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4">
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    maxLength="12"
                    required
                    className="flex-1 w-full px-4 py-3.5 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] focus:-translate-y-0.5 placeholder:text-gray-500"
                  />
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    maxLength="12"
                    required
                    className="flex-1 w-full px-4 py-3.5 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] focus:-translate-y-0.5 placeholder:text-gray-500"
                  />
                </div>
              )}

              {isSignup && (
                <div className="mb-4 md:mb-5 p-4 bg-navy border-2 border-primary/20 rounded-xl text-gray-200 text-sm md:text-base">
                  <p className="mb-3 font-medium">Are you an employee or OJT trainee of Triple G?</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isEmployeeOrTrainee"
                        checked={formData.isEmployeeOrTrainee === true}
                        onChange={() => setFormData(prev => ({ ...prev, isEmployeeOrTrainee: true }))}
                        className="w-[18px] h-[18px] accent-primary"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isEmployeeOrTrainee"
                        checked={formData.isEmployeeOrTrainee === false}
                        onChange={() => setFormData(prev => ({ ...prev, isEmployeeOrTrainee: false }))}
                        className="w-[18px] h-[18px] accent-primary"
                      />
                      <span>No</span>
                    </label>
                  </div>
                  {formData.isEmployeeOrTrainee && (
                    <p className="mt-3 text-xs md:text-sm text-primary/80">
                      A coordinator must approve your signup before you can access the app.
                    </p>
                  )}
                  {formData.isEmployeeOrTrainee === false && (
                    <p className="mt-3 text-xs md:text-sm text-red-400">
                      You must be an employee or OJT trainee of Triple G to create an account.
                    </p>
                  )}
                </div>
              )}

              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 md:px-4 py-3 md:py-3.5 mb-3 md:mb-4 bg-navy border-2 border-primary/20 rounded-xl text-white text-sm md:text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] focus:-translate-y-0.5 placeholder:text-gray-500"
              />

              <div className="relative mb-2">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3.5 bg-navy border-2 border-primary/20 rounded-xl text-white text-base transition-all focus:outline-none focus:border-primary focus:bg-navy-light focus:shadow-[0_0_0_3px_rgba(255,113,32,0.1)] focus:-translate-y-0.5 placeholder:text-gray-500"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
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

              {isSignup && <PasswordStrength password={formData.password} />}

              {!isSignup && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-5 gap-2 md:gap-0">
                  <label className="flex items-center gap-2 text-gray-300 text-xs md:text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="w-[18px] h-[18px] cursor-pointer accent-primary"
                    />
                    <span>Remember me</span>
                  </label>
                  <button type="button" onClick={() => window.location.href = '/forgot-password'} className="text-primary text-xs md:text-sm hover:text-primary-dark hover:underline transition-colors" style={{background: 'none', border: 'none', cursor: 'pointer'}}>Forgot password?</button>
                </div>
              )}

              {isSignup && (
                <label className="flex items-center gap-2 mb-4 md:mb-6 text-gray-300 text-xs md:text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleInputChange}
                    className="w-[18px] h-[18px] cursor-pointer accent-primary"
                  />
                  <span>I agree to the <button type="button" className="text-primary hover:underline" style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}>Terms & Conditions</button></span>
                </label>
              )}

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="w-full px-4 py-3 md:py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl font-semibold text-sm md:text-base transition-all shadow-[0_4px_12px_rgba(255,113,32,0.3)] hover:shadow-[0_6px_20px_rgba(255,113,32,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed mb-4 md:mb-6 tracking-wide"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">⏳ Processing...</span>
                ) : (
                  isSignup ? 'Create account' : 'Sign in'
                )}
              </button>
            </form>

            {!isSignup && (
              <>
                <div className="relative text-center my-6">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20"></div>
                  <span className="relative bg-navy-dark px-4 text-gray-500 text-sm">Or continue with</span>
                </div>

                <button 
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-navy border-2 border-primary/20 rounded-xl text-white text-base font-medium transition-all hover:bg-navy-light hover:border-primary hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(255,113,32,0.3)]" 
                  type="button" 
                  onClick={handleGoogleSignIn}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

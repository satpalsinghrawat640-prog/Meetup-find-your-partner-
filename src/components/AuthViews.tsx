import React, { useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import {
  Eye,
  EyeOff,
  Heart,
  Mail,
  Lock,
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import { auth, googleProvider, isSameFirebaseOrigin } from '../lib/firebase';
import { INDIAN_STATES, INDIAN_STATES_DISTRICTS } from '../data/indianLocations';
import { GenderOption, InterestedInOption, UserProfile } from '../types/igmeet';
import {
  calculateExactAge,
  isUsernameAvailable,
  saveCompletedProfile,
  uploadToFirebaseStorage
} from '../services/igmeetService';

interface AuthProps {
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
  onAuthComplete?: () => void;
}

export function AuthFlow({ onToast }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup_choice' | 'signup_email' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [accountNotFound, setAccountNotFound] = useState(false);

  useEffect(() => {
    if (!isSameFirebaseOrigin) return;
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) onToast('Signed in with Google.', 'success');
      })
      .catch(() => {});
  }, [onToast]);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setAccountNotFound(false);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onToast('Signed in with Google.', 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (isSameFirebaseOrigin && code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('Browser blocked the Google sign-in popup. Allow popups or sign in with email.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('Google sign-in was cancelled. Please try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg('This domain is not listed under Firebase Auth Authorized Domains.');
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg('Google Sign-In must be enabled in Firebase Console -> Authentication.');
      } else {
        setErrorMsg('Unable to sign in with Google. Check Firebase OAuth configuration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAccountNotFound(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setAccountNotFound(true);
        setErrorMsg('Account Not Found. No IG Meet account exists for this email.');
      } else if (code === 'auth/wrong-password') {
        setErrorMsg('Incorrect Password. Please re-enter your password or use Forgot Password.');
      } else if (code === 'auth/invalid-credential') {
        // Disambiguate unregistered email vs incorrect password when Email Enumeration Protection allows
        try {
          const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
          if (methods.length === 0) {
            setAccountNotFound(true);
            setErrorMsg('Account Not Found. Check your email or create a new account.');
          } else {
            setErrorMsg('Incorrect Password. Please check your password and try again.');
          }
        } catch {
          setErrorMsg('Incorrect Password or Account Not Found. Verify your credentials.');
        }
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many failed attempts. Wait a few minutes before retrying.');
      } else {
        setErrorMsg('Unable to log in right now. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMsg('All registration fields are required.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await sendEmailVerification(cred.user).catch(() => {});
      onToast('Account created. Verification email sent.', 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Please log in instead.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Choose a stronger password with at least 6 characters.');
      } else {
        setErrorMsg('Unable to create account. Check Firebase Email/Password auth settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Enter your registered email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      onToast('Password reset link sent to your email.', 'success');
      setMode('login');
    } catch {
      setErrorMsg('Could not send password reset email. Verify the address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-gradient-to-b from-[#FF2D78] via-[#E91E4D] to-[#C2184A] text-white overflow-y-auto">
      <div className="flex flex-col items-center text-center pt-4 pb-6">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-[#FF2D78] fill-[#FF2D78]" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">IG Meet</h1>
        <p className="text-sm font-medium text-white/90 mt-1">Find Your Match</p>
        <p className="text-xs text-white/75 mt-2">Adults-only social discovery platform (18+)</p>
      </div>

      <div className="bg-white dark:bg-[#1C1419] text-[#1A1015] dark:text-white rounded-3xl p-6 shadow-2xl space-y-4">
        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setAccountNotFound(false);
              setMode(mode === 'signup_email' ? 'signup_choice' : 'login');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5A63] dark:text-neutral-300 hover:text-[#FF2D78] min-h-[36px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup_choice' && 'Create Account'}
            {mode === 'signup_email' && 'Sign Up with Email'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs text-[#6E5A63] dark:text-neutral-400 mt-1">
            {mode === 'login' && 'Log in to continue discovering matches on IG Meet.'}
            {mode === 'signup_choice' && 'Choose how you want to create your IG Meet account.'}
            {mode === 'signup_email' && 'Verify your email after registration to secure your account.'}
            {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {accountNotFound && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setAccountNotFound(false);
                  setMode('signup_choice');
                }}
                className="w-full py-2 rounded-xl bg-[#FF2D78] text-white font-semibold text-xs"
              >
                Create Account
              </button>
            )}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A3B42] dark:text-neutral-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm focus:border-[#FF2D78] outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A3B42] dark:text-neutral-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 pl-10 pr-11 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm focus:border-[#FF2D78] outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-neutral-500"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('forgot');
                  }}
                  className="text-xs font-semibold text-[#E91E4D] hover:underline py-1"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white font-bold text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Log In</span>
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              <span className="text-xs font-semibold text-neutral-400">OR</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.5 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
                <path fill="#34A853" d="M3.2 7.3l3.2 2.3C7.3 7.7 9.5 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 8.1 2 4.8 4.2 3.2 7.3z" />
                <path fill="#FBBC05" d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5C4.8 19.8 8.1 22 12 22z" />
                <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.7H12v3.9h5.4c-.3 1.4-1.1 2.4-2 3.1l2.9 2.4c1.7-1.6 3.3-4 3.3-7.7z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="text-center pt-2 text-xs text-[#6E5A63] dark:text-neutral-400">
              <span>Don&apos;t have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setAccountNotFound(false);
                  setMode('signup_choice');
                }}
                className="font-bold text-[#E91E4D] hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {mode === 'signup_choice' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold flex items-center justify-center gap-2.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.5 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
                <path fill="#34A853" d="M3.2 7.3l3.2 2.3C7.3 7.7 9.5 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 8.1 2 4.8 4.2 3.2 7.3z" />
                <path fill="#FBBC05" d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5C4.8 19.8 8.1 22 12 22z" />
                <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.7H12v3.9h5.4c-.3 1.4-1.1 2.4-2 3.1l2.9 2.4c1.7-1.6 3.3-4 3.3-7.7z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('signup_email')}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>Sign Up with Email</span>
            </button>

            <div className="text-center pt-2 text-xs text-[#6E5A63] dark:text-neutral-400">
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-bold text-[#E91E4D] hover:underline"
              >
                Log In
              </button>
            </div>
          </div>
        )}

        {mode === 'signup_email' && (
          <form onSubmit={handleEmailSignupSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full h-11 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full h-11 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Account</span>
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              <span className="text-xs font-semibold text-neutral-400">OR</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.5 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
                <path fill="#34A853" d="M3.2 7.3l3.2 2.3C7.3 7.7 9.5 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 8.1 2 4.8 4.2 3.2 7.3z" />
                <path fill="#FBBC05" d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5C4.8 19.8 8.1 22 12 22z" />
                <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.7H12v3.9h5.4c-.3 1.4-1.1 2.4-2 3.1l2.9 2.4c1.7-1.6 3.3-4 3.3-7.7z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered email address"
              className="w-full h-12 px-4 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white font-bold text-sm"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] text-white/80 pt-5">
        By continuing, you confirm that you are 18 years of age or older.
      </p>
    </div>
  );
}

interface CreateProfileProps {
  uid: string;
  email: string;
  initialName?: string;
  providers: string[];
  onBack: () => void;
  onCompleted: (profile: UserProfile) => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function CreateProfileScreen({
  uid,
  email,
  initialName = '',
  providers,
  onBack,
  onCompleted,
  onToast
}: CreateProfileProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [fullName, setFullName] = useState(initialName);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [gender, setGender] = useState<GenderOption>('Male');
  const [interestedIn, setInterestedIn] = useState<InterestedInOption>('Female');
  const [bio, setBio] = useState('');
  const [post1, setPost1] = useState<{ file: File; preview: string; caption: string } | null>(null);
  const [post2, setPost2] = useState<{ file: File; preview: string; caption: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const districts = selectedState ? INDIAN_STATES_DISTRICTS[selectedState] || [] : [];

  const handleUsernameBlur = async () => {
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) return;
    setUsernameStatus('checking');
    try {
      const ok = await isUsernameAvailable(clean, uid);
      setUsernameStatus(ok ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!photoFile) {
      setErrorMsg('Please upload a Profile Photo.');
      return;
    }
    if (fullName.trim().length < 2) {
      setErrorMsg('Enter your Full Name.');
      return;
    }
    const cleanUser = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(cleanUser)) {
      setErrorMsg('Username must be 3-24 characters using letters, numbers, dots, or underscores.');
      return;
    }
    const day = Number(dobDay);
    const month = Number(dobMonth);
    const year = Number(dobYear);
    const age = calculateExactAge(day, month, year);
    if (age < 18) {
      setErrorMsg('You must be at least 18 years old to use IG Meet.');
      return;
    }
    if (!selectedState || !selectedDistrict) {
      setErrorMsg('Select both your State and District.');
      return;
    }

    setSubmitting(true);
    try {
      const available = await isUsernameAvailable(cleanUser, uid);
      if (!available) {
        setUsernameStatus('taken');
        setErrorMsg('This username is already taken. Choose another unique username.');
        setSubmitting(false);
        return;
      }

      const photoUrl = await uploadToFirebaseStorage(`profiles/${uid}/avatar_${Date.now()}.jpg`, photoFile);
      const initialPosts: { imageUrl: string; caption: string }[] = [];

      if (post1) {
        const url1 = await uploadToFirebaseStorage(`posts/${uid}/post1_${Date.now()}.jpg`, post1.file);
        initialPosts.push({ imageUrl: url1, caption: post1.caption });
      }
      if (post2) {
        const url2 = await uploadToFirebaseStorage(`posts/${uid}/post2_${Date.now()}.jpg`, post2.file);
        initialPosts.push({ imageUrl: url2, caption: post2.caption });
      }

      const profile: UserProfile = {
        uid,
        email,
        fullName: fullName.trim(),
        username: cleanUser,
        dobDay: day,
        dobMonth: month,
        dobYear: year,
        age,
        state: selectedState,
        district: selectedDistrict,
        gender,
        interestedIn,
        bio: bio.trim(),
        photoUrl,
        gallery: [photoUrl],
        verified: false,
        membershipTier: 'free',
        role: 'user',
        status: 'active',
        profileComplete: true,
        privacy: {
          whoCanMessageMe: 'Only My Matches',
          showOnlineStatus: true,
          showLastSeen: true
        },
        notifications: {
          allNotifications: true,
          likes: true,
          messages: true,
          newMatches: true,
          announcements: true
        },
        createdAt: Date.now(),
        authProviders: providers
      };

      await saveCompletedProfile(profile, initialPosts);
      onToast('Profile created successfully.', 'success');
      onCompleted(profile);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to save profile. Verify Firebase Storage and Firestore rules.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#FFF8FA] dark:bg-[#140E12] px-4 py-6">
      <div className="bg-white dark:bg-[#1D151A] rounded-3xl p-5 shadow-sm border border-rose-100/70 dark:border-neutral-800 space-y-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to login"
            className="mt-0.5 p-2 rounded-xl bg-rose-50 dark:bg-white/5 text-[#1A1015] dark:text-white hover:bg-rose-100 dark:hover:bg-white/10 active:scale-95 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#1A1015] dark:text-white">Create Your Profile</h1>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400 mt-0.5">
              Complete your adult profile (18+) to start matching on IG Meet.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Profile Photo */}
          <div className="flex flex-col items-center">
            <label className="relative w-24 h-24 rounded-full bg-rose-50 dark:bg-neutral-800 border-2 border-dashed border-[#FF2D78] flex items-center justify-center overflow-hidden cursor-pointer">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-[#FF2D78]">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] font-bold mt-1">Photo</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPhotoFile(f);
                    setPhotoPreview(URL.createObjectURL(f));
                  }
                }}
              />
            </label>
            <span className="text-[11px] text-[#6E5A63] dark:text-neutral-400 mt-1.5">1. Profile Photo (Required)</span>
          </div>

          {/* 2. Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              maxLength={60}
              className="w-full h-11 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
              required
            />
          </div>

          {/* 3. Unique Username */}
          <div className="space-y-1">
            <label className="text-xs font-semibold flex items-center justify-between">
              <span>Unique Username</span>
              {usernameStatus === 'available' && (
                <span className="text-emerald-600 inline-flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Available
                </span>
              )}
              {usernameStatus === 'taken' && (
                <span className="text-rose-600 text-[11px]">Already taken</span>
              )}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''));
                setUsernameStatus('idle');
              }}
              onBlur={handleUsernameBlur}
              placeholder="e.g. aarav.sharma"
              maxLength={24}
              className="w-full h-11 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
              required
            />
          </div>

          {/* 4. Date of Birth (Day / Month / Year) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold">Date of Birth (Day / Month / Year — 18+ Only)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                max={31}
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                placeholder="Day"
                className="h-11 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm text-center tabular-nums outline-none focus:border-[#FF2D78]"
                required
              />
              <input
                type="number"
                min={1}
                max={12}
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                placeholder="Month"
                className="h-11 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm text-center tabular-nums outline-none focus:border-[#FF2D78]"
                required
              />
              <input
                type="number"
                min={1930}
                max={new Date().getFullYear()}
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                placeholder="Year"
                className="h-11 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm text-center tabular-nums outline-none focus:border-[#FF2D78]"
                required
              />
            </div>
          </div>

          {/* 5 & 6. State and dependent District */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold">State</label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full h-11 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
                required
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">District</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedState}
                className="w-full h-11 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78] disabled:opacity-50"
                required
              >
                <option value="">Select District</option>
                {districts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7. Gender (one straight horizontal line) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Gender</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Male', 'Female', 'Other'] as GenderOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGender(opt)}
                  className={`h-11 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                    gender === opt
                      ? 'bg-[#FF2D78] text-white border-[#FF2D78]'
                      : 'bg-[#FFF8FA] dark:bg-neutral-900 text-[#4A3B42] dark:text-neutral-300 border-rose-100 dark:border-neutral-800'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Interested In (one straight horizontal line) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Interested In</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Male', 'Female', 'Everyone'] as InterestedInOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterestedIn(opt)}
                  className={`h-11 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                    interestedIn === opt
                      ? 'bg-[#E91E4D] text-white border-[#E91E4D]'
                      : 'bg-[#FFF8FA] dark:bg-neutral-900 text-[#4A3B42] dark:text-neutral-300 border-rose-100 dark:border-neutral-800'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label className="text-xs font-semibold">Bio (Optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={250}
              rows={2}
              placeholder="Write a short introduction about yourself..."
              className="w-full p-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78] resize-none"
            />
          </div>

          {/* 9. Create Your First Post (Optional, Max 2) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold">Create Your First Post (Optional — Max 2)</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Add Post 1', data: post1, setter: setPost1 },
                { label: 'Add Post 2', data: post2, setter: setPost2 }
              ].map((slot) => (
                <div
                  key={slot.label}
                  className="rounded-2xl border border-dashed border-rose-200 dark:border-neutral-700 p-2 bg-[#FFF8FA] dark:bg-neutral-900 space-y-2"
                >
                  {slot.data ? (
                    <>
                      <div className="relative aspect-square rounded-xl overflow-hidden">
                        <img src={slot.data.preview} alt={slot.label} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => slot.setter(null)}
                          aria-label="Remove post"
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={slot.data.caption}
                        onChange={(e) =>
                          slot.setter(slot.data ? { ...slot.data, caption: e.target.value } : null)
                        }
                        placeholder="Caption..."
                        className="w-full h-8 px-2 rounded-lg bg-white dark:bg-neutral-800 text-xs outline-none"
                      />
                    </>
                  ) : (
                    <label className="aspect-square flex flex-col items-center justify-center text-[#E91E4D] cursor-pointer">
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-semibold mt-1">{slot.label}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            slot.setter({ file: f, preview: URL.createObjectURL(f), caption: '' });
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 10. Continue */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white font-bold text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Continue</span>
          </button>
        </form>
      </div>
    </div>
  );
}

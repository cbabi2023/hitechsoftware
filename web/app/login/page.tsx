'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { getDashboardRouteByRole } from '@/modules/auth/auth.service';
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen';

const DEFAULT_EMAIL = 'Varghesejoby2003@gmail.com';

/** Map raw Supabase/service error strings to human-readable messages. */
function mapAuthError(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  
  // Handle URL error codes
  if (lower === 'unauthorized' || lower === 'invalid_role') {
    return 'Your account is authenticated, but you do not have a valid role assigned for this application. Please contact your administrator.';
  }

  if (lower.includes('profile is missing') || lower.includes('profile record')) {
    return 'Your login is valid, but your app profile is not configured yet. Please ask admin to add your profile.';
  }
  if (lower.includes('no role is assigned') || lower.includes('no role assigned') || lower.includes('account has no role')) {
    return 'Your login is valid, but no role is assigned in this app. Please ask admin to assign your role.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials') || lower.includes('wrong password') || lower.includes('no user found')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Please verify your email address before signing in.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.';
  }
  return raw;
}

function LoginContent() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const { signIn, user, isLoading, isHydrated, userRole, error } = useAuth();

  // ─── Guard: already authenticated — redirect to correct dashboard ────────────
  useEffect(() => {
    if (isHydrated && !isLoading && user && userRole) {
      const destination = getDashboardRouteByRole(userRole);
      router.replace(destination);
    }
  }, [isHydrated, isLoading, user, userRole, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await signIn({
        email,
        password,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });

      if (result.ok) {
        // Redirect immediately — don't rely on useEffect timing
        const destination = getDashboardRouteByRole(result.data.role);
        router.replace(destination);
        // Note: we don't strictly need to setSubmitting(false) here as the page is unmounting,
        // but it's safer for slow-redirect edge cases.
        setIsSubmitting(false);
        return;
      }

      setSubmitError(result.error.message);
      setIsSubmitting(false);
    } catch (err) {
      console.error('[LoginPage] signIn threw:', err);
      setSubmitError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Prefer locally-captured error (directly from result) or URL error over store-derived error
  const friendlyError = mapAuthError(submitError ?? urlError ?? error);
  // Only disable form fields while a sign-in request is in flight.
  // Do NOT block on isHydrated — middleware guarantees only unauthenticated users
  // reach this page, so we can show the form immediately.
  const isFormLoading = isSubmitting;

  // Only show loading screen when an authenticated user is being redirected away
  // (e.g. after a successful login while the router.replace is in flight).
  if (isHydrated && user) {
    return <AppLoadingScreen />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_38%,#0b3b8c_100%)] p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-5rem] top-16 h-72 w-72 rounded-full bg-white/12 blur-3xl animate-blob"></div>
        <div className="absolute right-[-4rem] top-32 h-80 w-80 rounded-full bg-blue-300/18 blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glowing border effect */}
        <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-r from-white/60 via-blue-200/50 to-white/35 blur-xl"></div>
        
        {/* Card Container */}
        <div className="relative rounded-[26px] border border-white/50 bg-white px-8 py-10 shadow-[0_24px_90px_rgba(2,6,23,0.45)] md:px-10">
          
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 shadow-lg shadow-blue-950/25">
                <span className="text-xl font-bold text-white">HT</span>
              </div>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-slate-950">
              Hitech Software
            </h1>
            <p className="text-sm text-slate-600">
              Service Management System
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Sign in with your authorized admin account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isFormLoading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isFormLoading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isFormLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {friendlyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{friendlyError}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isFormLoading}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-950 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFormLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            <p className="text-center text-sm text-slate-500">
              Access is restricted to approved team members.
            </p>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            © 2026 Hitech Software. All rights reserved.
          </p>
        </div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <LoginContent />
    </Suspense>
  );
}

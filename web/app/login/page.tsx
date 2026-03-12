'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const DEFAULT_EMAIL = 'Varghesejoby2003@gmail.com';

export default function LoginPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { signIn, user, isLoading, error } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await signIn({
        email,
        password,
        userAgent: navigator.userAgent,
      });
      
      if (result.ok) {
        router.push(result.data.redirectTo ?? '/dashboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
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
                disabled={isLoading}
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
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
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
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-950 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
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

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

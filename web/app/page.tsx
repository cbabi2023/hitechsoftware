'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user) {
      router.push(ROUTES.DASHBOARD);
      return;
    }

    router.push(ROUTES.LOGIN);
  }, [isLoading, router, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-blue-950">
      <div className="text-center">
        <div className="inline-block">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">HT</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Hitech Software</h1>
        <p className="text-slate-400 mb-6">Loading...</p>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}

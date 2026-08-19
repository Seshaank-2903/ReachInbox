'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api
      .getMe()
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Connecting to ReachInbox Scheduler...</span>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Mail, Zap, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LoginPage() {
  const router = useRouter();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleDevLogin = async () => {
    setIsDemoLoading(true);
    setErrorMsg('');
    try {
      await api.devLogin('demo.user@reachinbox.ai', 'ReachInbox Cold Outreacher');
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to authenticate');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Decorative ambient glows */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/25 mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">ReachInbox Scheduler</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Production Cold Outreach & Automated Rate Limit Engine
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-3 mb-8 p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>BullMQ Redis Delayed Job Scheduling</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Idempotent Execution & Zero Double-Send</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Hourly Rate Limits & Staggered Delay</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Login Options */}
        <div className="space-y-3">
          {/* Real Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Dev Quick Login Fallback */}
          <div className="relative py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative px-3 bg-slate-900 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              or instant access
            </span>
          </div>

          <Button
            onClick={handleDevLogin}
            variant="secondary"
            className="w-full py-3 text-sm justify-center"
            isLoading={isDemoLoading}
          >
            <span>Launch Quick Demo Session</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

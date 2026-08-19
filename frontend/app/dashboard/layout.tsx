'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, Sender } from '../../types';
import { api } from '../../lib/api';
import { Header } from '../components/Header';
import { ComposeModal } from '../components/ComposeModal';
import { ToastContainer, ToastMessage } from '../components/ui/Toast';
import { Clock, CheckCircle2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    // 1. Fetch user session
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        setIsLoadingUser(false);
      })
      .catch(() => {
        router.push('/login');
      });

    // 2. Fetch configured senders
    api
      .getSenders()
      .then((res) => {
        setSenders(res.senders);
        if (res.senders.length > 0) {
          setSelectedSenderId(res.senders[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load senders:', err);
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {}
    router.push('/login');
  };

  const handleScheduleSuccess = (count: number) => {
    addToast('success', `Successfully scheduled ${count} cold email job(s)!`);
    // Refresh page or trigger custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('campaign-scheduled'));
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading dashboard session...</span>
        </div>
      </div>
    );
  }

  const isScheduledTab = pathname === '/dashboard' || pathname === '/dashboard/';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Header */}
      <Header
        user={user}
        senders={senders}
        selectedSenderId={selectedSenderId}
        onSelectSender={setSelectedSenderId}
        onOpenCompose={() => setIsComposeOpen(true)}
        onLogout={handleLogout}
      />

      {/* Dashboard Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                isScheduledTab
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
            </Link>

            <Link
              href="/dashboard/sent"
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                !isScheduledTab
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sent Emails</span>
            </Link>
          </nav>
        </div>

        {/* Tab Content */}
        {children}
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        selectedSenderId={selectedSenderId}
        onScheduleSuccess={handleScheduleSuccess}
        onError={(msg) => addToast('error', msg)}
        apiSchedule={api.scheduleCampaign}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

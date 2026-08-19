'use client';

import React from 'react';
import { User, Sender } from '../../types';
import { Button } from './ui/Button';
import { Mail, Plus, LogOut, Send } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  senders: Sender[];
  selectedSenderId: string;
  onSelectSender: (id: string) => void;
  onOpenCompose: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  senders,
  selectedSenderId,
  onSelectSender,
  onOpenCompose,
  onLogout,
}) => {
  return (
    <header className="w-full bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              ReachInbox <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">Scheduler</span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Cold Outreach & Automated Rate Limiting</p>
          </div>
        </div>

        {/* Sender selector & Action */}
        <div className="flex items-center gap-4">
          {senders.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-300">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">Sender:</span>
              <select
                value={selectedSenderId}
                onChange={(e) => onSelectSender(e.target.value)}
                className="bg-transparent border-none text-slate-100 font-medium focus:outline-none cursor-pointer"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                    {s.name} ({s.etherealEmail})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={onOpenCompose} variant="primary" size="md">
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </Button>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 object-cover"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

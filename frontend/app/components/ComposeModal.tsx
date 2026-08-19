'use client';

import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Sender } from '../../types';
import { Upload, Calendar, Clock, AlertCircle, FileText, CheckCircle } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  selectedSenderId: string;
  onScheduleSuccess: (count: number) => void;
  onError: (msg: string) => void;
  apiSchedule: (data: any) => Promise<{ message: string; totalScheduled: number }>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  selectedSenderId,
  onScheduleSuccess,
  onError,
  apiSchedule,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [senderId, setSenderId] = useState(selectedSenderId || (senders[0]?.id ?? ''));
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmailsMs, setDelayBetweenEmailsMs] = useState(2000);
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Sync default sender if updated
  React.useEffect(() => {
    if (selectedSenderId && !senderId) {
      setSenderId(selectedSenderId);
    }
  }, [selectedSenderId, senderId]);

  // Compute parsed recipient count live
  const parsedCount = React.useMemo(() => {
    if (!recipientsText.trim()) return 0;
    return recipientsText
      .split(/[\n,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@')).length;
  }, [recipientsText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRecipientsText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) return onError('Subject line is required.');
    if (!body.trim()) return onError('Email body text is required.');
    if (parsedCount === 0) return onError('At least one valid recipient email is required.');

    setIsSubmitting(true);
    try {
      const res = await apiSchedule({
        subject: subject.trim(),
        body: body.trim(),
        recipients: recipientsText,
        senderId: senderId || undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmailsMs: Number(delayBetweenEmailsMs),
        maxEmailsPerHour: Number(maxEmailsPerHour),
      });

      onScheduleSuccess(res.totalScheduled);
      // Reset form
      setSubject('');
      setBody('');
      setRecipientsText('');
      setFileName(null);
      onClose();
    } catch (err: any) {
      onError(err?.message || 'Failed to schedule campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose Cold Outreach Campaign" maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sender Select */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Select Sender Account
          </label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.etherealEmail})
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <Input
          label="Subject Line"
          placeholder="e.g. Scaling outreach with automated scheduler"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        {/* Body */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Email Body Content
          </label>
          <textarea
            rows={4}
            placeholder="Hi {{name}}, I noticed your team is working on..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all resize-none"
            required
          />
        </div>

        {/* Recipients & CSV Upload */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Recipients (CSV or Line Separated)
            </label>
            <span className="text-xs font-medium text-sky-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {parsedCount} recipient{parsedCount === 1 ? '' : 's'} detected
            </span>
          </div>

          <textarea
            rows={3}
            placeholder="alex@company.com, sarah@startup.io or paste CSV content"
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all resize-none font-mono text-xs"
          />

          {/* File upload dropzone */}
          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Upload CSV / TXT File</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
            {fileName && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {fileName}
              </span>
            )}
          </div>
        </div>

        {/* Advanced Scheduling Settings */}
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-400" /> Start Schedule
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" /> Inter-Send Delay (ms)
            </label>
            <input
              type="number"
              min={0}
              step={500}
              value={delayBetweenEmailsMs}
              onChange={(e) => setDelayBetweenEmailsMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-purple-400" /> Max / Hour
            </label>
            <input
              type="number"
              min={1}
              value={maxEmailsPerHour}
              onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>

        {/* Submit Footer */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Schedule {parsedCount > 0 ? `${parsedCount} Email${parsedCount === 1 ? '' : 's'}` : 'Campaign'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

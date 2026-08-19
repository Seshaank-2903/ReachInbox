'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EmailJob, Pagination } from '../../types';
import { api } from '../../lib/api';
import { ScheduledTable } from '../components/ScheduledTable';
import { RefreshCw } from 'lucide-react';

export default function ScheduledEmailsPage() {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchScheduled = useCallback((page = 1) => {
    setIsLoading(true);
    api
      .getScheduledEmails(page, 20)
      .then((res) => {
        setJobs(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        console.error('Error fetching scheduled emails:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchScheduled(1);

    const handleRefresh = () => fetchScheduled(1);
    window.addEventListener('campaign-scheduled', handleRefresh);
    const interval = setInterval(() => fetchScheduled(pagination.page), 10000); // Polling every 10s

    return () => {
      window.removeEventListener('campaign-scheduled', handleRefresh);
      clearInterval(interval);
    };
  }, [fetchScheduled, pagination.page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Scheduled Queue</h2>
          <p className="text-xs text-slate-400">
            Pending cold outreach emails waiting for delayed BullMQ execution
          </p>
        </div>
        <button
          onClick={() => fetchScheduled(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <ScheduledTable
        jobs={jobs}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={(p) => fetchScheduled(p)}
      />
    </div>
  );
}

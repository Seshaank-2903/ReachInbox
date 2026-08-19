'use client';

import React from 'react';
import { EmailJob, Pagination } from '../../types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ExternalLink, CheckCircle2, AlertTriangle, Calendar, Mail } from 'lucide-react';

interface SentTableProps {
  jobs: EmailJob[];
  pagination: Pagination;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  jobs,
  pagination,
  isLoading,
  onPageChange,
}) => {
  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse flex items-center justify-between px-4">
            <div className="w-48 h-4 bg-slate-800 rounded"></div>
            <div className="w-64 h-4 bg-slate-800 rounded"></div>
            <div className="w-32 h-4 bg-slate-800 rounded"></div>
            <div className="w-20 h-6 bg-slate-800 rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No Sent Emails Yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Emails sent by the worker will automatically register here alongside their Ethereal test inbox preview URLs.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Sent Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ethereal Preview URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium text-slate-200">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>{job.recipientEmail}</span>
                </div>
              </TableCell>

              <TableCell className="max-w-xs truncate text-slate-300">
                {job.campaign?.subject || 'No Subject'}
              </TableCell>

              <TableCell className="text-slate-300 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {job.sentAt
                      ? new Date(job.sentAt).toLocaleString()
                      : new Date(job.updatedAt).toLocaleString()}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <Badge status={job.status} />
                {job.error && (
                  <p className="text-[11px] text-rose-400 mt-1 max-w-xs truncate flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {job.error}
                  </p>
                )}
              </TableCell>

              <TableCell>
                {job.previewUrl ? (
                  <a
                    href={job.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <span>View Inbox Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500 italic">No URL</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <div>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total emails)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

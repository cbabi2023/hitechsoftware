'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Truck, MapPin, Wrench } from 'lucide-react';
import type { IncompleteJobInput } from '@/modules/subjects/subject.types';

type IncompleteReason = IncompleteJobInput['reason'];

interface StatusActionBarProps {
  currentStatus: string;
  isAssignedTechnician: boolean;
  canTransition: boolean;
  isLoading: boolean;
  onStatusChange: (status: string) => void;
  onMarkIncomplete: (input: IncompleteJobInput) => void;
  onMarkComplete: (notes?: string) => void;
  completionError?: Error | null;
  isMarkingComplete?: boolean;
}

const STATUS_FLOW = {
  ACCEPTED: { label: 'Accepted', icon: CheckCircle2, next: 'EN_ROUTE' },
  EN_ROUTE: { label: 'En Route', icon: Truck, next: 'ARRIVED' },
  ARRIVED: { label: 'Arrived', icon: MapPin, next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'Work Started', icon: Wrench, next: 'COMPLETED' },
  COMPLETED: { label: 'Completed', icon: CheckCircle2, next: null },
  INCOMPLETE: { label: 'Incomplete', icon: AlertCircle, next: null },
};

const INCOMPLETE_REASONS = [
  { value: 'customer_cannot_afford', label: 'Customer Cannot Afford' },
  { value: 'power_issue', label: 'Power Issue' },
  { value: 'door_locked', label: 'Door Locked' },
  { value: 'spare_parts_not_available', label: 'Spare Parts Not Available' },
  { value: 'site_not_ready', label: 'Site Not Ready' },
  { value: 'other', label: 'Other' },
];

function isIncompleteReason(value: string): value is IncompleteReason {
  return INCOMPLETE_REASONS.some((item) => item.value === value);
}

export function StatusActionBar({
  currentStatus,
  isAssignedTechnician,
  canTransition,
  isLoading,
  onStatusChange,
  onMarkIncomplete,
  onMarkComplete,
  completionError,
  isMarkingComplete,
}: StatusActionBarProps) {
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [incompleteNote, setIncompleteNote] = useState<string>('');
  const [sparePartsName, setSparePartsName] = useState<string>('');
  const [sparePartsQty, setSparePartsQty] = useState<number>(1);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [completeNotes, setCompleteNotes] = useState<string>('');

  const statusInfo = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW];

  if (!isAssignedTechnician) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-100 rounded-lg">
        <AlertCircle className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600">
          You are not assigned to this job. Status updates require assignment.
        </span>
      </div>
    );
  }

  const handleTransitionClick = () => {
    if (statusInfo?.next) {
      onStatusChange(statusInfo.next);
    }
  };

  const handleMarkIncomplete = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!incompleteReason) {
      alert('Please select a reason');
      return;
    }

    if (incompleteReason === 'other' && incompleteNote.trim().length < 10) {
      alert('Please provide at least 10 characters for "Other" reason');
      return;
    }

    if (incompleteReason === 'spare_parts_not_available') {
      if (!sparePartsName || sparePartsQty <= 0) {
        alert('Please specify part name and quantity');
        return;
      }
    }

    if (!isIncompleteReason(incompleteReason)) {
      return;
    }

    onMarkIncomplete({
      reason: incompleteReason,
      note: incompleteNote,
      sparePartsRequested: sparePartsName || undefined,
      sparePartsQuantity: sparePartsName ? sparePartsQty : undefined,
      rescheduledDate: rescheduleDate || undefined,
    });

    setShowIncompleteDialog(false);
    setIncompleteReason('');
    setIncompleteNote('');
    setSparePartsName('');
    setSparePartsQty(1);
    setRescheduleDate('');
  };

  const handleMarkComplete = () => {
    onMarkComplete(completeNotes || undefined);
    setShowCompleteDialog(false);
    setCompleteNotes('');
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {statusInfo?.icon && <statusInfo.icon className="h-5 w-5 text-blue-600" />}
            <span className="font-medium text-blue-900">{statusInfo?.label || currentStatus}</span>
          </div>
          {statusInfo?.next && (
            <p className="text-sm text-blue-700 mt-1">
              Next: {STATUS_FLOW[statusInfo.next as keyof typeof STATUS_FLOW]?.label}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {currentStatus !== 'COMPLETED' && currentStatus !== 'INCOMPLETE' && statusInfo?.next && (
            <button
              onClick={handleTransitionClick}
              disabled={isLoading || !canTransition}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Updating...' : `Move to ${STATUS_FLOW[statusInfo.next as keyof typeof STATUS_FLOW]?.label || 'Next'}`}
            </button>
          )}

          {currentStatus === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => setShowCompleteDialog(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Mark Complete
              </button>
              <button
                onClick={() => setShowIncompleteDialog(true)}
                className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors"
              >
                Cannot Complete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Incomplete Job Modal */}
      {showIncompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Mark Job As Incomplete</h2>
              <p className="text-sm text-gray-600 mt-1">
                Please specify why you cannot complete this job.
              </p>
            </div>

            <form onSubmit={handleMarkIncomplete} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={incompleteReason}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncompleteReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason...</option>
                  {INCOMPLETE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {incompleteReason === 'spare_parts_not_available' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Part Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sparePartsName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSparePartsName(e.target.value)}
                      placeholder="e.g., Compressor Motor"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Quantity Needed <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={sparePartsQty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSparePartsQty(parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {incompleteReason === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={incompleteNote}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIncompleteNote(e.target.value)}
                    placeholder="Explain the situation... (minimum 10 characters)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {incompleteNote.length} / 10 characters
                  </p>
                </div>
              )}

              {['customer_cannot_afford', 'power_issue', 'door_locked', 'site_not_ready'].includes(incompleteReason) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={incompleteNote}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIncompleteNote(e.target.value)}
                    placeholder="Any additional information..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reschedule Date (optional)
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowIncompleteDialog(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Mark Incomplete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Complete Job</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add completion notes before finalizing the job.
              </p>
            </div>

            {completionError && (
              <div className="p-4 mx-6 mt-6 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{completionError.message}</p>
                </div>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Completion Notes (optional)
                </label>
                <textarea
                  value={completeNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCompleteNotes(e.target.value)}
                  placeholder="e.g., Service completed successfully, unit tested..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCompleteDialog(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkComplete}
                  disabled={isMarkingComplete}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isMarkingComplete ? 'Completing...' : 'Complete Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Input, Label, Alert, AlertDescription } from '@/components/ui/form';
import { AlertCircle, CheckCircle2, MapPin, Wrench } from 'lucide-react';
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
  ACCEPTED: { label: 'Accepted', icon: CheckCircle2, next: 'ARRIVED', buttonLabel: 'Mark as Arrived' },
  ARRIVED: { label: 'Arrived', icon: MapPin, next: 'IN_PROGRESS', buttonLabel: 'Start Work' },
  IN_PROGRESS: { label: 'Work in Progress', icon: Wrench, next: null, buttonLabel: null },
  COMPLETED: { label: 'Completed', icon: CheckCircle2, next: null, buttonLabel: null },
  INCOMPLETE: { label: 'Incomplete', icon: AlertCircle, next: null, buttonLabel: null },
  AWAITING_PARTS: { label: 'Awaiting Parts', icon: AlertCircle, next: null, buttonLabel: null },
};

const TRANSITION_BUTTON_LABEL: Record<string, string> = {
  ARRIVED: 'Mark as Arrived',
  IN_PROGRESS: 'Start Work',
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

  const handleMarkIncomplete = (e: React.FormEvent) => {
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
          {currentStatus !== 'COMPLETED' && currentStatus !== 'INCOMPLETE' && currentStatus !== 'AWAITING_PARTS' && statusInfo?.next && (
            <Button
              onClick={handleTransitionClick}
              disabled={isLoading || !canTransition}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Updating...' : (TRANSITION_BUTTON_LABEL[statusInfo.next] ?? `Move to ${STATUS_FLOW[statusInfo.next as keyof typeof STATUS_FLOW]?.label ?? 'Next'}`)}
            </Button>
          )}

          {currentStatus === 'IN_PROGRESS' && (
            <>
              <Button
                onClick={() => setShowCompleteDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                Mark Complete
              </Button>
              <Button
                onClick={() => setShowIncompleteDialog(true)}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Cannot Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Incomplete Job Dialog */}
      <Dialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Job As Incomplete</DialogTitle>
            <DialogDescription>
              Please specify why you cannot complete this job. This information helps schedule follow-up.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMarkIncomplete} className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Select value={incompleteReason} onValueChange={setIncompleteReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {INCOMPLETE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {incompleteReason === 'spare_parts_not_available' && (
              <>
                <div>
                  <Label>Part Name</Label>
                  <Input
                    value={sparePartsName}
                    onChange={(e) => setSparePartsName(e.target.value)}
                    placeholder="e.g., Compressor Motor"
                  />
                </div>
                <div>
                  <Label>Quantity Needed</Label>
                  <Input
                    type="number"
                    min="1"
                    value={sparePartsQty.toString()}
                    onChange={(e) => setSparePartsQty(parseInt(e.target.value) || 1)}
                  />
                </div>
              </>
            )}

            {incompleteReason === 'other' && (
              <div>
                <Label>Details (minimum 10 characters)</Label>
                <Textarea
                  value={incompleteNote}
                  onChange={(e) => setIncompleteNote(e.target.value)}
                  placeholder="Explain the situation..."
                  className="min-h-24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {incompleteNote.length} / 10 characters
                </p>
              </div>
            )}

            {['customer_cannot_afford', 'power_issue', 'door_locked', 'site_not_ready'].includes(incompleteReason) && (
              <div>
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  value={incompleteNote}
                  onChange={(e) => setIncompleteNote(e.target.value)}
                  placeholder="Any additional information..."
                  className="min-h-20"
                />
              </div>
            )}

            <div>
              <Label>Reschedule Date (optional)</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIncompleteDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                Mark Incomplete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Job Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
            <DialogDescription>
              Add completion notes before finalizing the job.
            </DialogDescription>
          </DialogHeader>

          {completionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{completionError.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label>Completion Notes (optional)</Label>
              <Textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="e.g., Service completed successfully, unit tested..."
                className="min-h-24"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCompleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                {isMarkingComplete ? 'Completing...' : 'Complete Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

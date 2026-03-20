import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SubjectBill } from '@/modules/subjects/subject.types';
import { BillPDF, type BillPDFSubjectDetails } from '@/lib/pdf/BillPDF';

export async function generateBillPDF(bill: SubjectBill, subject: BillPDFSubjectDetails): Promise<Blob> {
  const doc = <BillPDF bill={bill} subject={subject} />;
  return pdf(doc).toBlob();
}

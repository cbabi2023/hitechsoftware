import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

type PdfComponentProps = React.PropsWithChildren<{ [key: string]: unknown }>;

const PdfDocument = Document as unknown as React.ComponentType<React.PropsWithChildren>;
const PdfPage = Page as unknown as React.ComponentType<PdfComponentProps>;
const PdfText = Text as unknown as React.ComponentType<PdfComponentProps>;
const PdfView = View as unknown as React.ComponentType<PdfComponentProps>;
import type { SubjectBill } from '@/modules/subjects/subject.types';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, color: '#0f172a' },
  header: { marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 10, color: '#334155' },
  section: { marginBottom: 10 },
  row: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { color: '#475569' },
  value: { fontWeight: 600 },
  tableHeader: { display: 'flex', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 4, marginBottom: 4 },
  tableRow: { display: 'flex', flexDirection: 'row', marginBottom: 3 },
  colName: { width: '42%' },
  colQty: { width: '16%', textAlign: 'right' },
  colUnit: { width: '20%', textAlign: 'right' },
  colTotal: { width: '22%', textAlign: 'right' },
  grand: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#cbd5e1', fontWeight: 700 },
  stampPaid: { marginTop: 6, color: '#166534', fontWeight: 700 },
  stampDue: { marginTop: 6, color: '#b91c1c', fontWeight: 700 },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, color: '#475569', fontSize: 10 },
});

export interface BillPDFSubjectDetails {
  subject_number: string;
  category_name: string | null;
  type_of_service: string;
  technician_name: string | null;
  customer_name: string | null;
  customer_address: string | null;
  accessories?: Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>;
}

interface Props {
  bill: SubjectBill;
  subject: BillPDFSubjectDetails;
}

export function BillPDF({ bill, subject }: Props) {
  const accessories = subject.accessories ?? [];

  return (
    <PdfDocument>
      <PdfPage size="A4" style={styles.page}>
        <PdfView style={styles.header}>
          <PdfText style={styles.title}>Hi Tech Engineering</PdfText>
          <PdfText style={styles.sub}>Kottayam, Kerala</PdfText>
          <PdfText style={styles.sub}>Phone: +91-00000-00000</PdfText>
        </PdfView>

        <PdfView style={styles.section}>
          <PdfView style={styles.row}><PdfText style={styles.label}>Bill Number</PdfText><PdfText style={styles.value}>{bill.bill_number}</PdfText></PdfView>
          <PdfView style={styles.row}><PdfText style={styles.label}>Date</PdfText><PdfText>{new Date(bill.generated_at).toLocaleString('en-GB')}</PdfText></PdfView>
          <PdfView style={styles.row}><PdfText style={styles.label}>Bill Type</PdfText><PdfText>{bill.bill_type === 'brand_dealer_invoice' ? 'Tax Invoice' : 'Service Receipt'}</PdfText></PdfView>
        </PdfView>

        <PdfView style={styles.section}>
          <PdfText style={styles.value}>Issued To</PdfText>
          <PdfText>{bill.issued_to}</PdfText>
          {bill.issued_to_type === 'customer' && subject.customer_address ? <PdfText>{subject.customer_address}</PdfText> : null}
        </PdfView>

        <PdfView style={styles.section}>
          <PdfView style={styles.row}><PdfText style={styles.label}>Subject Number</PdfText><PdfText>{subject.subject_number}</PdfText></PdfView>
          <PdfView style={styles.row}><PdfText style={styles.label}>Category</PdfText><PdfText>{subject.category_name ?? '-'}</PdfText></PdfView>
          <PdfView style={styles.row}><PdfText style={styles.label}>Type of Service</PdfText><PdfText>{subject.type_of_service}</PdfText></PdfView>
          <PdfView style={styles.row}><PdfText style={styles.label}>Technician</PdfText><PdfText>{subject.technician_name ?? '-'}</PdfText></PdfView>
        </PdfView>

        <PdfView style={styles.section}>
          <PdfView style={styles.tableHeader}>
            <PdfText style={styles.colName}>Description</PdfText>
            <PdfText style={styles.colQty}>Qty</PdfText>
            <PdfText style={styles.colUnit}>Unit</PdfText>
            <PdfText style={styles.colTotal}>Total</PdfText>
          </PdfView>

          {bill.visit_charge > 0 ? (
            <PdfView style={styles.tableRow}>
              <PdfText style={styles.colName}>Visit Charge</PdfText>
              <PdfText style={styles.colQty}>1</PdfText>
              <PdfText style={styles.colUnit}>{bill.visit_charge.toFixed(2)}</PdfText>
              <PdfText style={styles.colTotal}>{bill.visit_charge.toFixed(2)}</PdfText>
            </PdfView>
          ) : null}

          {bill.service_charge > 0 ? (
            <PdfView style={styles.tableRow}>
              <PdfText style={styles.colName}>Service Charge</PdfText>
              <PdfText style={styles.colQty}>1</PdfText>
              <PdfText style={styles.colUnit}>{bill.service_charge.toFixed(2)}</PdfText>
              <PdfText style={styles.colTotal}>{bill.service_charge.toFixed(2)}</PdfText>
            </PdfView>
          ) : null}

          {accessories.map((item, index) => (
            <PdfView style={styles.tableRow} key={`item-${index}`}>
              <PdfText style={styles.colName}>{item.item_name}</PdfText>
              <PdfText style={styles.colQty}>{item.quantity}</PdfText>
              <PdfText style={styles.colUnit}>{Number(item.unit_price).toFixed(2)}</PdfText>
              <PdfText style={styles.colTotal}>{Number(item.total_price).toFixed(2)}</PdfText>
            </PdfView>
          ))}

          <PdfView style={styles.row}>
            <PdfText style={styles.grand}>Grand Total</PdfText>
            <PdfText style={styles.grand}>{bill.grand_total.toFixed(2)}</PdfText>
          </PdfView>
        </PdfView>

        <PdfView style={styles.section}>
          {bill.bill_type === 'customer_receipt' ? (
            <>
              <PdfText>Payment Mode: {bill.payment_mode ?? '-'}</PdfText>
              <PdfText style={styles.stampPaid}>PAID</PdfText>
            </>
          ) : (
            <>
              <PdfText>Payment pending from Brand/Dealer.</PdfText>
              <PdfText style={styles.stampDue}>{bill.payment_status.toUpperCase()}</PdfText>
            </>
          )}
        </PdfView>

        <PdfView style={styles.footer}>
          <PdfText>Thank you for choosing Hi Tech Engineering.</PdfText>
          <PdfText>Contact: support@hitech.local</PdfText>
        </PdfView>
      </PdfPage>
    </PdfDocument>
  );
}

import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

type PdfComponentProps = React.PropsWithChildren<{ [key: string]: unknown }>;

const PdfDocument = Document as unknown as React.ComponentType<React.PropsWithChildren>;
const PdfPage = Page as unknown as React.ComponentType<PdfComponentProps>;
const PdfText = Text as unknown as React.ComponentType<PdfComponentProps>;
const PdfView = View as unknown as React.ComponentType<PdfComponentProps>;
import type { SubjectBill } from '@/modules/subjects/subject.types';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, color: '#0f172a' },
  header: { marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 10, color: '#334155' },
  section: { marginBottom: 10 },
  row: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { color: '#475569' },
  value: { fontWeight: 600 },
  tableHeader: { display: 'flex', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 4, marginBottom: 4, backgroundColor: '#f8fafc' },
  tableRow: { display: 'flex', flexDirection: 'row', marginBottom: 3 },
  colName: { width: '28%' },
  colMrp: { width: '12%', textAlign: 'right' },
  colDisc: { width: '10%', textAlign: 'right' },
  colQty: { width: '8%', textAlign: 'right' },
  colBase: { width: '14%', textAlign: 'right' },
  colGst: { width: '14%', textAlign: 'right' },
  colTotal: { width: '14%', textAlign: 'right' },
  grand: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#cbd5e1', fontWeight: 700 },
  summaryRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  summaryLabel: { color: '#475569', fontSize: 10 },
  summaryValue: { fontWeight: 600, fontSize: 10 },
  stampPaid: { marginTop: 8, fontSize: 14, color: '#166534', fontWeight: 700, textAlign: 'center', borderWidth: 2, borderColor: '#166534', padding: 6, borderRadius: 4, width: 120 },
  stampDue: { marginTop: 8, fontSize: 14, color: '#b91c1c', fontWeight: 700, textAlign: 'center', borderWidth: 2, borderColor: '#b91c1c', padding: 6, borderRadius: 4, width: 120 },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, color: '#475569', fontSize: 10 },
});

const GST_DIVISOR = 1.18;

export interface BillPDFAccessory {
  item_name: string;
  quantity: number;
  mrp: number;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  discount_amount: number;
  discounted_mrp: number;
  base_price: number;
  gst_amount: number;
  line_total: number;
  line_base_total: number;
  line_gst_total: number;
}

export interface BillPDFSubjectDetails {
  subject_number: string;
  category_name: string | null;
  type_of_service: string;
  technician_name: string | null;
  customer_name: string | null;
  customer_address: string | null;
  accessories?: BillPDFAccessory[];
}

interface Props {
  bill: SubjectBill;
  subject: BillPDFSubjectDetails;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export function BillPDF({ bill, subject }: Props) {
  const accessories = subject.accessories ?? [];

  // Compute visit/service charge GST split
  const visitBase = Math.round(bill.visit_charge / GST_DIVISOR * 100) / 100;
  const visitGst = Math.round((bill.visit_charge - visitBase) * 100) / 100;
  const serviceBase = Math.round(bill.service_charge / GST_DIVISOR * 100) / 100;
  const serviceGst = Math.round((bill.service_charge - serviceBase) * 100) / 100;

  const accessoriesBaseTotal = accessories.reduce((s, a) => s + a.line_base_total, 0);
  const accessoriesGstTotal = accessories.reduce((s, a) => s + a.line_gst_total, 0);
  const accessoriesDiscountTotal = accessories.reduce((s, a) => s + a.discount_amount * a.quantity, 0);

  const totalBase = accessoriesBaseTotal + visitBase + serviceBase;
  const totalGst = accessoriesGstTotal + visitGst + serviceGst;

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

        {/* Items table with GST columns */}
        <PdfView style={styles.section}>
          <PdfView style={styles.tableHeader}>
            <PdfText style={styles.colName}>Item Name</PdfText>
            <PdfText style={styles.colMrp}>MRP</PdfText>
            <PdfText style={styles.colDisc}>Discount</PdfText>
            <PdfText style={styles.colQty}>Qty</PdfText>
            <PdfText style={styles.colBase}>Base Price</PdfText>
            <PdfText style={styles.colGst}>GST 18%</PdfText>
            <PdfText style={styles.colTotal}>Amount</PdfText>
          </PdfView>

          {bill.visit_charge > 0 ? (
            <PdfView style={styles.tableRow}>
              <PdfText style={styles.colName}>Visit Charge</PdfText>
              <PdfText style={styles.colMrp}>{fmt(bill.visit_charge)}</PdfText>
              <PdfText style={styles.colDisc}>—</PdfText>
              <PdfText style={styles.colQty}>1</PdfText>
              <PdfText style={styles.colBase}>{fmt(visitBase)}</PdfText>
              <PdfText style={styles.colGst}>{fmt(visitGst)}</PdfText>
              <PdfText style={styles.colTotal}>{fmt(bill.visit_charge)}</PdfText>
            </PdfView>
          ) : null}

          {bill.service_charge > 0 ? (
            <PdfView style={styles.tableRow}>
              <PdfText style={styles.colName}>Service Charge</PdfText>
              <PdfText style={styles.colMrp}>{fmt(bill.service_charge)}</PdfText>
              <PdfText style={styles.colDisc}>—</PdfText>
              <PdfText style={styles.colQty}>1</PdfText>
              <PdfText style={styles.colBase}>{fmt(serviceBase)}</PdfText>
              <PdfText style={styles.colGst}>{fmt(serviceGst)}</PdfText>
              <PdfText style={styles.colTotal}>{fmt(bill.service_charge)}</PdfText>
            </PdfView>
          ) : null}

          {accessories.map((item, index) => (
            <PdfView style={styles.tableRow} key={`item-${index}`}>
              <PdfText style={styles.colName}>{item.item_name}</PdfText>
              <PdfText style={styles.colMrp}>{fmt(item.mrp)}</PdfText>
              <PdfText style={styles.colDisc}>
                {item.discount_value > 0
                  ? item.discount_type === 'percentage'
                    ? `${item.discount_value}%`
                    : fmt(item.discount_value)
                  : '—'}
              </PdfText>
              <PdfText style={styles.colQty}>{item.quantity}</PdfText>
              <PdfText style={styles.colBase}>{fmt(item.line_base_total)}</PdfText>
              <PdfText style={styles.colGst}>{fmt(item.line_gst_total)}</PdfText>
              <PdfText style={styles.colTotal}>{fmt(item.line_total)}</PdfText>
            </PdfView>
          ))}
        </PdfView>

        {/* Bill Summary with GST breakdown */}
        <PdfView style={styles.section}>
          {accessoriesDiscountTotal > 0 && (
            <PdfView style={styles.summaryRow}>
              <PdfText style={styles.summaryLabel}>Total Discount</PdfText>
              <PdfText style={styles.summaryValue}>-{fmt(accessoriesDiscountTotal)}</PdfText>
            </PdfView>
          )}
          <PdfView style={styles.summaryRow}>
            <PdfText style={styles.summaryLabel}>Base Amount (excl. GST)</PdfText>
            <PdfText style={styles.summaryValue}>{fmt(totalBase)}</PdfText>
          </PdfView>
          <PdfView style={styles.summaryRow}>
            <PdfText style={styles.summaryLabel}>GST 18%</PdfText>
            <PdfText style={styles.summaryValue}>{fmt(totalGst)}</PdfText>
          </PdfView>
          <PdfView style={styles.row}>
            <PdfText style={styles.grand}>Grand Total</PdfText>
            <PdfText style={styles.grand}>{fmt(bill.grand_total)}</PdfText>
          </PdfView>
        </PdfView>

        {/* Payment status with PAID/DUE stamp */}
        <PdfView style={styles.section}>
          {bill.bill_type === 'customer_receipt' ? (
            <>
              <PdfText>Payment Mode: {bill.payment_mode ?? '-'}</PdfText>
              <PdfText style={bill.payment_status === 'paid' ? styles.stampPaid : styles.stampDue}>
                {bill.payment_status.toUpperCase()}
              </PdfText>
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

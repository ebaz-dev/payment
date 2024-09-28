import { InvoiceEventSubjects } from "./invoice-event-subjects";

export interface InvoicePaidEvent {
  subject: InvoiceEventSubjects.InvoicePaid;
  data: {
    id: string;
    orderId: string;
    supplierId: string;
    merchantId: string;
    status: string;
    invoiceAmount: number;
    paidAmount: number;
    thirdPartyInvoiceId?: string;
    paymentMethod: string;
  };
}

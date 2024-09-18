import { InvoiceEventSubjects } from "./invoice-event-subjects";

export interface InvoicePaidEvent {
  subject: InvoiceEventSubjects.InvoicePaid;
  data: {
    id: string;
    orderId: string;
    merchantId: string;
    status: string;
    invoiceAmount: number;
    paidAmount: string;
    thirdPartyInvoiceId: string;
    paymentMethod: string;
  };
}

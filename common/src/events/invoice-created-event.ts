import { InvoiceEventSubjects } from "./invoice-event-subjects";

export interface InvoiceCreatedEvent {
  subject: InvoiceEventSubjects.InvoiceCreated;
  data: {
    id: string;
    orderId: string;
    status: string;
    invoiceAmount: number;
    thirdPartyInvoiceId?: string;
    paymentMethod: string;
  };
}

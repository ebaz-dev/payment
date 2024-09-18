import { Publisher } from "@ebazdev/core";
import { InvoicePaidEvent } from "../../shared/events/invoice-paid-event";
import { InvoiceEventSubjects } from "../../shared/events/invoice-event-subjects";

export class InvoicePaidPublisher extends Publisher<InvoicePaidEvent> {
  subject: InvoiceEventSubjects.InvoicePaid = InvoiceEventSubjects.InvoicePaid;
}

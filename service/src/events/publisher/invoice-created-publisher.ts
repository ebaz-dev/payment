import { Publisher } from "@ebazdev/core";
import { InvoiceCreatedEvent } from "../../shared/events/invoice-created-event";
import { InvoiceEventSubjects } from "../../shared/events/invoice-event-subjects";

export class InvoiceCreatedPublisher extends Publisher<InvoiceCreatedEvent> {
  subject: InvoiceEventSubjects.InvoiceCreated =
    InvoiceEventSubjects.InvoiceCreated;
}

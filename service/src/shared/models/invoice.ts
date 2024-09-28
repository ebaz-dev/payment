import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

export enum InvoiceStatus {
  Awaiting = "awaiting",
  Paid = "paid",
}

export enum PaymentMethod {
  QPay = "qpay",
  MBank = "mbank",
  Cash = "cash",
}

interface AdditionalData {
  thirdPartyInvoiceId?: string;
  invoiceToken?: string;
  thirdPartyData?: object;
}
interface InvoiceDoc extends Document {
  id: Types.ObjectId;
  orderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  merchantId: Types.ObjectId;
  status: InvoiceStatus;
  invoiceAmount: number;
  paidAmount?: number;
  paymentMethod: PaymentMethod;
  additionalData: AdditionalData;
}

const invoiceSchema = new Schema<InvoiceDoc>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: "Order",
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Customer",
    },
    merchantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Customer",
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(InvoiceStatus),
    },
    invoiceAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      required: false,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    additionalData: {
      type: Object,
      required: false,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
    timestamps: true,
  }
);

invoiceSchema.set("versionKey", "version");
invoiceSchema.plugin(updateIfCurrentPlugin);

const Invoice = model<InvoiceDoc>("Invoice", invoiceSchema);

export { Invoice, InvoiceDoc };

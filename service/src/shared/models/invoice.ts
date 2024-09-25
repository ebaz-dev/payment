import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface InvoiceDoc extends Document {
  id: Types.ObjectId;
  orderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  merchantId: Types.ObjectId;
  status: string;
  invoiceAmount: number;
  paidAmount?: string;
  thirdPartyInvoiceId: string;
  invoiceToken: string;
  paymentMethod: string;
  thirdPartyData?: object;
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
      required: false,
      default: "awaiting",
    },
    invoiceAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: String,
      required: false,
    },
    thirdPartyInvoiceId: {
      type: String,
      required: false,
      ref: "Invoice",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    thirdPartyData: {
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

export { Invoice };

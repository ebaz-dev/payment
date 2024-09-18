import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface InvoiceRequestDoc extends Document {
  cartId: Types.ObjectId;
  paymentMethod: string;
  invoiceCode: string;
  senderInvoiceNo: string;
  invoiceReceiverCode: string;
  invoiceDescription: string;
  invoiceAmount: number;
  callBackUrl: string;
  invoiceId: Types.ObjectId;
  thirdPartyInvoiceId: string;
}

const invoiceRequestSchema = new Schema<InvoiceRequestDoc>(
  {
    cartId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Cart",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    invoiceCode: {
      type: String,
      required: true,
    },
    senderInvoiceNo: {
      type: String,
      required: true,
    },
    invoiceReceiverCode: {
      type: String,
      required: true,
    },
    invoiceDescription: {
      type: String,
      required: true,
    },
    invoiceAmount: {
      type: Number,
      required: true,
    },
    callBackUrl: {
      type: String,
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: "Invoice",
    },
    thirdPartyInvoiceId: {
      type: String,
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

invoiceRequestSchema.set("versionKey", "version");
invoiceRequestSchema.plugin(updateIfCurrentPlugin);

const InvoiceRequest = model<InvoiceRequestDoc>(
  "Payment",
  invoiceRequestSchema
);

export { InvoiceRequest };

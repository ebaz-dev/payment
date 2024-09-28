import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface AdditionalData {
  invoiceCode?: string;
  senderInvoiceNo?: string;
  invoiceReceiverCode?: string;
  invoiceDescription?: string;
  thirdPartyInvoiceId?: string;
  callBackUrl?: string;
  invoiceToken?: string;
}

interface InvoiceRequestDoc extends Document {
  orderId: Types.ObjectId;
  paymentMethod: string;
  invoiceAmount: number;
  invoiceId?: Types.ObjectId;
  additionalData: AdditionalData;
}

const invoiceRequestSchema = new Schema<InvoiceRequestDoc>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Cart",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    invoiceAmount: {
      type: Number,
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: "Invoice",
    },
    additionalData: {
      invoiceCode: {
        type: String,
        required: false,
      },
      senderInvoiceNo: {
        type: String,
        required: false,
      },
      invoiceReceiverCode: {
        type: String,
        required: false,
      },
      invoiceDescription: {
        type: String,
        required: false,
      },
      thirdPartyInvoiceId: {
        type: String,
        required: false,
      },
      callBackUrl: {
        type: String,
        required: false,
      },
      invoiceToken: {
        type: String,
        required: false,
      },
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
  "InvoiceRequest",
  invoiceRequestSchema
);

export { InvoiceRequest };

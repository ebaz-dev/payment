import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface thirdPartyData {
  paymentId?: string;
  status?: string;
  currency?: string;
  paymentWallet?: string;
  paymentType?: string;
  transactionData?: object[];
}

interface IncoiceDoc extends Document {
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
  thirdPartyData?: thirdPartyData;
}

const incoiceSchema = new Schema<IncoiceDoc>(
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
      paymentId: {
        type: String,
        required: false,
      },
      status: {
        type: String,
        required: false,
      },
      currency: {
        type: String,
        required: false,
      },
      paymentWallet: {
        type: String,
        required: false,
      },
      paymentType: {
        type: String,
        required: false,
      },
      transactionData: {
        type: Object,
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

incoiceSchema.set("versionKey", "version");
incoiceSchema.plugin(updateIfCurrentPlugin);

const Invoice = model<IncoiceDoc>("Invoice", incoiceSchema);

export { Invoice };

import { Document, Schema, model, Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";


export enum PaymentThirdPartyOrigin {
  QPay = "qpay",
  MBank = "mbank",
}


interface ThirdPartyExternalDataDoc extends Document {
  id: Types.ObjectId;
  token: String;
  origin: PaymentThirdPartyOrigin;
}

const thirdPartyExternalDataSchema = new Schema<ThirdPartyExternalDataDoc>(
  {
    token: {
      type: String,
      required: true,
    },
    origin: {
      type: String,
      required: true,
      enum: Object.values(PaymentThirdPartyOrigin),
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

thirdPartyExternalDataSchema.set("versionKey", "version");
thirdPartyExternalDataSchema.plugin(updateIfCurrentPlugin);

const ThirdPartyExternalData = model<ThirdPartyExternalDataDoc>("ThirdPartyExternalData", thirdPartyExternalDataSchema);

export { ThirdPartyExternalData };

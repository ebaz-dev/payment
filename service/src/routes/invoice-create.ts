import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest, BadRequestError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from "../shared/models/invoice";
import { InvoiceRequest } from "../shared/models/invoice-request";
import { InvoiceCreatedPublisher } from "../events/publisher/invoice-created-publisher";
import { Order } from "@ebazdev/order";
import { natsWrapper } from "../nats-wrapper";
import axios from "axios";
import mongoose from "mongoose";

const router = express.Router();

router.post(
  "/invoice-create",
  [
    body("orderId")
      .isMongoId()
      .withMessage("Order ID must be a valid ObjectId"),
    body("amount")
      .isNumeric()
      .notEmpty()
      .withMessage("Amount must be provided")
      .custom((value) => value > 0)
      .withMessage("Amount must be greater than 0"),
    body("paymentMethod")
      .isArray({ min: 1 })
      .withMessage("Payment method must be an array of strings")
      .custom((methods) => {
        return methods.every((method: string) =>
          ["qpay", "mbank", "cash"].includes(method)
        );
      })
      .withMessage('Each payment method must be one of "qpay", "mbank", "cash'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { orderId, amount } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      throw new BadRequestError("Order not found");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    if (
      !process.env.QPAY_AUTH_TOKEN_URL ||
      !process.env.QPAY_INVOICE_REQUEST_URL
    ) {
      throw new Error("Missing QPAY environment variables");
    }

    try {
      const invoiceAmount = parseInt(amount, 10);

      const qpayInvoiceRequest = new InvoiceRequest({
        orderId: orderId,
        paymentMethod: PaymentMethod.QPay,
        invoiceAmount: invoiceAmount,
        additionalData: {
          invoiceCode: process.env.QPAY_INVOICE_CODE,
          senderInvoiceNo: orderId,
          invoiceReceiverCode: "terminal",
          invoiceDescription: orderId,
          callBackUrl: process.env.QPAY_CALLBACK_URL + orderId,
        },
      });

      await qpayInvoiceRequest.save({ session });

      let qpayAccessToken: string;

      try {
        const token = `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`;
        const encodedToken = Buffer.from(token).toString("base64");
        const headers = { Authorization: "Basic " + encodedToken };

        interface QPayAuthResponse {
          access_token: string;
        }

        const qpayAuthResponse = await axios.post<QPayAuthResponse>(
          process.env.QPAY_AUTH_TOKEN_URL,
          {},
          { headers }
        );

        qpayAccessToken = qpayAuthResponse.data.access_token;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(
            "Error during QPAY authentication:",
            error.response?.data || error.message
          );
        } else {
          console.error("Unexpected error during QPAY authentication:", error);
        }

        throw new BadRequestError("Failed to authenticate with QPAY");
      }

      const qpayRequestData = {
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: orderId,
        invoice_receiver_code: "terminal",
        invoice_description: orderId,
        amount: invoiceAmount,
        callback_url: process.env.QPAY_CALLBACK_URL + orderId,
        date: new Date(),
      };

      const qpayConfig = {
        headers: { Authorization: `Bearer ${qpayAccessToken}` },
      };

      let qpayInvoiceResponse: any;

      try {
        qpayInvoiceResponse = await axios.post(
          process.env.QPAY_INVOICE_REQUEST_URL,
          qpayRequestData,
          qpayConfig
        );
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(
            "Error during QPAY invoice request:",
            error.response?.data || error.message
          );
        } else {
          console.error("Unexpected error:", error);
        }
        throw new BadRequestError("Failed to create invoice with QPAY");
      }

      const qpayResponseStatus = qpayInvoiceResponse.status;
      if (qpayResponseStatus !== StatusCodes.OK) {
        throw new BadRequestError("Failed to create invoice with QPAY");
      }

      const qpayInvoiceResponseData = qpayInvoiceResponse.data;
      const qpayInvoiceId = qpayInvoiceResponseData.invoice_id;

      const mbankInvoice = createInvoice(
        orderId,
        order.supplierId,
        order.merchantId,
        invoiceAmount,
        PaymentMethod.MBank
      );

      const qpayInvoice = createInvoice(
        orderId,
        order.supplierId,
        order.merchantId,
        invoiceAmount,
        PaymentMethod.QPay,
        {
          thirdPartyInvoiceId: qpayInvoiceId,
          invoiceToken: qpayAccessToken,
          thirdPartyData: qpayInvoiceResponseData,
        }
      );

      await mbankInvoice.save({ session });
      await qpayInvoice.save({ session });

      qpayInvoiceRequest.invoiceId = qpayInvoice.id;
      qpayInvoiceRequest.additionalData.thirdPartyInvoiceId = qpayInvoiceId;

      await qpayInvoiceRequest.save({ session });

      new InvoiceCreatedPublisher(natsWrapper.client).publish({
        id: qpayInvoice.id.toString(),
        orderId: qpayInvoice.orderId.toString(),
        status: qpayInvoice.status,
        invoiceAmount: qpayInvoice.invoiceAmount,
        thirdPartyInvoiceId: qpayInvoice.additionalData.thirdPartyInvoiceId,
        paymentMethod: qpayInvoice.paymentMethod,
      });

      await session.commitTransaction();

      res.status(StatusCodes.CREATED).json({
        orderId: orderId,
        data: qpayInvoiceResponseData.urls,
        qr: qpayInvoiceResponseData.qr_text,
        qrImage: qpayInvoiceResponseData.qr_image,
      });
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof BadRequestError) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
      } else {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: "Something went wrong" });
      }
    } finally {
      session.endSession();
    }
  }
);

const createInvoice = (
  orderId: mongoose.Types.ObjectId,
  supplierId: mongoose.Types.ObjectId,
  merchantId: mongoose.Types.ObjectId,
  invoiceAmount: number,
  paymentMethod: PaymentMethod,
  additionalData?: {
    thirdPartyInvoiceId?: string;
    invoiceToken?: string;
    thirdPartyData?: any;
  }
) => {
  const invoiceData: any = {
    orderId,
    supplierId,
    merchantId,
    status: InvoiceStatus.Awaiting,
    invoiceAmount,
    paymentMethod,
  };

  if (additionalData) {
    if (additionalData.thirdPartyInvoiceId) {
      invoiceData.thirdPartyInvoiceId = additionalData.thirdPartyInvoiceId;
    }
    if (additionalData.invoiceToken) {
      invoiceData.invoiceToken = additionalData.invoiceToken;
    }
    if (additionalData.thirdPartyData) {
      invoiceData.thirdPartyData = additionalData.thirdPartyData;
    }
  }

  return new Invoice(invoiceData);
};

export { router as invoiceCreateRouter };

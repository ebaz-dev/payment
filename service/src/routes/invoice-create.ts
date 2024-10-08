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
import { QpayClient } from "../shared/utils/qpay-api-client"

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

    const colaClient = new QpayClient();

    if (!order) {
      throw new BadRequestError("Order not found");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE!;
    const QPAY_CALLBACK_URL = process.env.QPAY_CALLBACK_URL!;

    try {
      const invoiceAmount = parseInt(amount, 10);

      const qpayInvoiceRequest = new InvoiceRequest({
        orderId: orderId,
        paymentMethod: PaymentMethod.QPay,
        invoiceAmount: invoiceAmount,
        additionalData: {
          invoiceCode: QPAY_INVOICE_CODE,
          senderInvoiceNo: orderId,
          invoiceReceiverCode: "terminal",
          invoiceDescription: orderId,
          callBackUrl: QPAY_CALLBACK_URL + orderId,
        },
      });

      await qpayInvoiceRequest.save({ session });

      const qpayRequestData = {
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: orderId,
        invoice_receiver_code: "terminal",
        invoice_description: orderId,
        amount: invoiceAmount,
        callback_url: QPAY_CALLBACK_URL + orderId,
        date: new Date(),
      };
      let qpayInvoiceResponse: any;

      try {
        qpayInvoiceResponse = await colaClient.post(
          "/invoice",
          qpayRequestData
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

      const qpayInvoice = new Invoice({
        orderId,
        supplierId: order.supplierId,
        merchantId: order.merchantId,
        status: InvoiceStatus.Awaiting,
        invoiceAmount,
        paymentMethod: PaymentMethod.QPay,
        additionalData: {
          thirdPartyInvoiceId: qpayInvoiceId,
          invoiceToken: colaClient.token,
          thirdPartyData: qpayInvoiceResponseData,
        },
      });

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
        console.error("Iinvoice requesting error:", error);
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: "Something went wrong" });
      }
    } finally {
      session.endSession();
    }
  }
);

export { router as invoiceCreateRouter };

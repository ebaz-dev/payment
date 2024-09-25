import express, { Request, Response } from "express";
import { body } from "express-validator";
import { validateRequest, BadRequestError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import { Invoice } from "../shared/models/invoice";
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
      .isString()
      .notEmpty()
      .withMessage("Order ID must be provided"),
    body("amount")
      .isNumeric()
      .notEmpty()
      .withMessage("Amount must be provided")
      .custom((value) => value > 0)
      .withMessage("Amount must be greater than 0"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { orderId, amount } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      throw new BadRequestError("Order not found");
    }

    const currentInvoice = await Invoice.findOne({ orderId: orderId });

    if (currentInvoice) {
      throw new BadRequestError("Invoice already exists");
    }

    const paymentMethod = "qpay";

    if (
      !process.env.QPAY_USERNAME ||
      !process.env.QPAY_PASSWORD ||
      !process.env.QPAY_INVOICE_CODE ||
      !process.env.QPAY_AUTH_TOKEN_URL ||
      !process.env.QPAY_INVOICE_REQUEST_URL ||
      !process.env.QPAY_CALLBACK_URL
    ) {
      throw new BadRequestError("Qpay credentials are not provided");
    }

    const invoiceRequest = new InvoiceRequest({
      orderId: orderId,
      paymentMethod: paymentMethod,
      invoiceCode: process.env.QPAY_INVOICE_CODE,
      senderInvoiceNo: "order_" + orderId,
      invoiceReceiverCode: "terminal",
      invoiceDescription: "order_" + orderId,
      invoiceAmount: parseInt(amount, 10),
      callBackUrl: process.env.QPAY_CALLBACK_URL + orderId,
    });

    try {
      await invoiceRequest.save();
    } catch (error) {
      console.error("Error saving InvoiceRequest:", error);
      throw new BadRequestError("Failed to save invoice request");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let qpayAccessToken: string;

      try {
        const token = `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`;
        const encodedToken = Buffer.from(token).toString("base64");
        const headers = { Authorization: "Basic " + encodedToken };

        const qpayAuthResponse = await axios.post(
          process.env.QPAY_AUTH_TOKEN_URL,
          {},
          { headers }
        );

        qpayAccessToken = qpayAuthResponse.data.access_token;
      } catch (error) {
        console.error("Error during QPAY authentication:", error);
        throw new BadRequestError("Failed to authenticate with QPAY");
      }

      const data = {
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: "order_" + orderId,
        invoice_receiver_code: "terminal",
        invoice_description: "order_" + orderId,
        amount: parseInt(amount, 10),
        callback_url: process.env.QPAY_CALLBACK_URL + orderId,
        date: new Date(),
      };

      const config = {
        headers: { Authorization: `Bearer ${qpayAccessToken}` },
      };

      let qpayInvoiceResponse: any;

      try {
        qpayInvoiceResponse = await axios.post(
          process.env.QPAY_INVOICE_REQUEST_URL,
          data,
          config
        );
      } catch (error) {
        console.error("Error during QPAY invoice request:", error);
        throw new BadRequestError("Failed to create invoice with QPAY");
      }

      const qpayResponseStatus = qpayInvoiceResponse.status;

      if (qpayResponseStatus !== 200) {
        throw new BadRequestError("Failed to create invoice with QPAY");
      }

      const qpayInvoiceResponseData = qpayInvoiceResponse.data;
      const qpayInvoiceId = qpayInvoiceResponseData.invoice_id;

      const invoice = new Invoice({
        orderId: orderId,
        supplierId: order.supplierId,
        merchantId: order.merchantId,
        status: "created",
        invoiceAmount: parseInt(amount, 10),
        thirdPartyInvoiceId: qpayInvoiceId,
        invoiceToken: qpayAccessToken,
        paymentMethod: paymentMethod,
        thirdPartyData: qpayInvoiceResponseData
      });

      await invoice.save({ session });

      invoiceRequest.invoiceId = invoice.id;
      invoiceRequest.thirdPartyInvoiceId = qpayInvoiceId;
      await invoiceRequest.save();

      new InvoiceCreatedPublisher(natsWrapper.client).publish({
        id: invoice.id.toString(),
        orderId: invoice.orderId.toString(),
        status: invoice.status,
        invoiceAmount: invoice.invoiceAmount,
        thirdPartyInvoiceId: invoice.thirdPartyInvoiceId,
        paymentMethod: invoice.paymentMethod,
      });

      await session.commitTransaction();

      res.status(StatusCodes.CREATED).json({
        orderId: orderId,
        data: qpayInvoiceResponseData.urls,
        qr: qpayInvoiceResponseData.qr_text,
        qrImage: qpayInvoiceResponseData.qr_image,
      });

    } catch (error) {
      console.error(error);
      await session.abortTransaction();
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "Something went wrong" });
    } finally {
      session.endSession();
    }
  }
);

export { router as invoiceCreateRouter };

import express, { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from "../shared/models/invoice";
import { InvoicePaidPublisher } from "../events/publisher/invoice-paid-publisher";
import { natsWrapper } from "../nats-wrapper";
import axios, { AxiosRequestConfig } from "axios";

const router = express.Router();

router.get("/invoice-status", async (req: Request, res: Response) => {
  const invoiceId = req.query.invoice;

  if (!invoiceId || typeof invoiceId !== "string") {
    return res.status(StatusCodes.BAD_REQUEST).send("FAILURE");
  }

  if (!process.env.QPAY_PAYMENT_CHECK_URL) {
    throw new BadRequestError("Qpay payment check URL is not provided");
  }

  const invoice = await Invoice.findOne({
    orderId: invoiceId,
    paymentMethod: PaymentMethod.QPay,
  });

  if (!invoice) {
    return res.status(StatusCodes.BAD_REQUEST).send("FAILURE");
  }

  const data = {
    object_type: "INVOICE",
    object_id: invoice.additionalData.thirdPartyInvoiceId,
    offset: {
      page_number: 1,
      page_limit: 100,
    },
  };

  const config: AxiosRequestConfig = {
    method: "post",
    url: process.env.QPAY_PAYMENT_CHECK_URL,
    headers: { Authorization: `Bearer ${invoice.additionalData.invoiceToken}` },
    data: data,
  };

  try {
    const response = await axios(config);

    if (response.status !== StatusCodes.OK) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .send("PAYMENT CHECK REQUEST FAILED");
    }

    const responseData = response.data;
    const responseDetails = responseData.rows[0];

    if (responseDetails.payment_status !== "PAID") {
      return res.status(StatusCodes.BAD_REQUEST).send("STATUS PENDING");
    }

    const thirdPartyData = {
      paymentId: responseDetails.payment_id,
      status: responseDetails.payment_status,
      currency: responseDetails.payment_currency,
      paymentWallet: responseDetails.payment_wallet,
      paymentType: responseDetails.payment_type,
      transactionData: responseDetails.p2p_transactions,
    };

    invoice.set({
      status: InvoiceStatus.Paid,
      paidAmount: responseData.paid_amount,
      additionalData: {
        ...invoice.additionalData,
        thirdPartyData: thirdPartyData,
      },
    });

    await invoice.save();

    await new InvoicePaidPublisher(natsWrapper.client).publish({
      id: invoice.id.toString(),
      orderId: invoice.orderId.toString(),
      supplierId: invoice.supplierId.toString(),
      merchantId: invoice.merchantId.toString(),
      status: invoice.status,
      invoiceAmount: invoice.invoiceAmount,
      paidAmount: invoice.paidAmount || 0,
      thirdPartyInvoiceId: invoice.additionalData.thirdPartyInvoiceId || "",
      paymentMethod: invoice.paymentMethod,
    });

    return res.status(StatusCodes.OK).send("SUCCESS");
  } catch (error) {
    console.error("Error during payment status check:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("FAILURE");
  }
});

export { router as paymemntStatusRouter };

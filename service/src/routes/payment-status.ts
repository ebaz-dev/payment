import express, { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import { Invoice } from "../shared/models/invoice";
import { InvoicePaidPublisher } from "../events/publisher/invoice-paid-publisher";
import { natsWrapper } from "../nats-wrapper";
import axios, { AxiosRequestConfig } from "axios";
import mongoose from "mongoose";

const router = express.Router();

router.get("/status", async (req: Request, res: Response) => {
  const invoiceid = req.query.invoiceid;
  // invoiceid gadnaas irsen huselt block hiij mgadgui ged validation hiisengui

  if (!process.env.QPAY_PAYMENT_CHECK_URL) {
    throw new BadRequestError("Qpay payment check url is not provided");
  }

  const invoice = await Invoice.findOne({ orderId: invoiceid });

  if (!invoice) {
    throw new NotFoundError();
  }

  const data = {
    object_type: "INVOICE",
    object_id: invoice.thirdPartyInvoiceId,
    offset: {
      page_number: 1,
      page_limit: 100,
    },
  };

  const config: AxiosRequestConfig = {
    method: "post",
    url: process.env.QPAY_PAYMENT_CHECK_URL,
    headers: { Authorization: `Bearer ${invoice.invoiceToken}` },
    data: data,
  };

  try {
    const response = await axios(config);

    const responseData = response.data;
    const responseDetails = responseData.rows[0];

    invoice.set({
      status: "paid",
      paidAmount: responseData.paid_amount,
      thirdPartyData: {
        paymentId: responseDetails.payment_id,
        status: responseDetails.payment_status,
        currency: responseDetails.payment_currency,
        paymentWallet: responseDetails.payment_wallet,
        paymentType: responseDetails.payment_type,
        transactionData: responseDetails.p2p_transactions,
      },
    });

    await invoice.save();

    await new InvoicePaidPublisher(natsWrapper.client).publish({
      id: invoice.id,
      orderId: invoice.orderId.toString(),
      merchantId: invoice.merchantId.toString(),
      status: invoice.status,
      invoiceAmount: invoice.invoiceAmount,
      paidAmount: invoice.paidAmount || "",
      thirdPartyInvoiceId: invoice.thirdPartyInvoiceId,
      paymentMethod: invoice.paymentMethod,
    });

    return res.status(200).send("SUCCESS");
  } catch (error) {
    console.error("Error during payment status check:", error);
    return res.status(400).send("FAILURE");
  }
});

export { router as paymemntStatusRouter };

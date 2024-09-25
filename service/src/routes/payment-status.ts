import express, { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import { Invoice, InvoiceStatus } from "../shared/models/invoice";
import { InvoicePaidPublisher } from "../events/publisher/invoice-paid-publisher";
import { natsWrapper } from "../nats-wrapper";
import axios, { AxiosRequestConfig } from "axios";

const router = express.Router();

router.get("/invoice-status", async (req: Request, res: Response) => {
  console.log("checking req.query");
  console.log(req.query);
  console.log("**********************");
  const invoiceId = req.query.invoice;

  console.log("************************");
  console.log(invoiceId);
  console.log("******** invoice status **************");

  if (!invoiceId || typeof invoiceId !== "string") {
    throw new BadRequestError("Invoice ID is required and must be a string");
  }

  if (!process.env.QPAY_PAYMENT_CHECK_URL) {
    throw new BadRequestError("Qpay payment check URL is not provided");
  }

  console.log("*************************");
  console.log(invoiceId);
  console.log("INVOICE ID");

  const invoice = await Invoice.findOne({ orderId: invoiceId });

  if (!invoice) {
    return res.status(StatusCodes.BAD_REQUEST).send("FAILURE");
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

    if (response.status !== StatusCodes.OK) {
      throw new BadRequestError("Qpay payment check failed");
    }

    const responseData = response.data;
    const responseDetails = responseData.rows[0];

    if (responseDetails.payment_status !== "PAID") {
      return res.status(StatusCodes.OK).send("STATUS PENDING");
    }

    invoice.set({
      status: InvoiceStatus.Paid,
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
      id: invoice.id.toString(),
      orderId: invoice.orderId.toString(),
      supplierId: invoice.supplierId.toString(),
      merchantId: invoice.merchantId.toString(),
      status: invoice.status,
      invoiceAmount: invoice.invoiceAmount,
      paidAmount: invoice.paidAmount || 0,
      thirdPartyInvoiceId: invoice.thirdPartyInvoiceId,
      paymentMethod: invoice.paymentMethod,
    });

    return res.status(StatusCodes.OK).send("SUCCESS");
  } catch (error) {
    console.error("Error during payment status check:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("FAILURE");
  }
});

export { router as paymemntStatusRouter };

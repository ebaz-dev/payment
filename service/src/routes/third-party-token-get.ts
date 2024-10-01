import express, { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "@ebazdev/core";
import { StatusCodes } from "http-status-codes";
import axios, { AxiosRequestConfig } from "axios";
import {
  ThirdPartyExternalData,
  PaymentThirdPartyOrigin,
} from "../shared/models/third-party-token";

const router = express.Router();

router.get("/qpay/token", async (req: Request, res: Response) => {
  try {
    const QPAY_USERNAME = "EBAZAAR";
    const QPAY_PASSWORD = "My7ZkVHq";
    const QPAY_AUTH_TOKEN_URL = "https://merchant.qpay.mn/v2/auth/token";

    const token = `${QPAY_USERNAME}:${QPAY_PASSWORD}`;
    const encodedToken = Buffer.from(token).toString("base64");
    const headers = { Authorization: "Basic " + encodedToken };

    console.log('replacing token');
    interface QPayAuthResponse {
      access_token: string;
    }

    const qpayAuthResponse = await axios.post<QPayAuthResponse>(
      QPAY_AUTH_TOKEN_URL,
      {},
      { headers }
    );

    const qpayAccessToken = qpayAuthResponse.data.access_token;

    const existingToken = await ThirdPartyExternalData.findOne({
      origin: PaymentThirdPartyOrigin.QPay,
    });
    console.log('CHECKING TOKEN UPDATE');
    if (existingToken) {
      existingToken.token = qpayAccessToken;
      await existingToken.save();
    } else {
      const newToken = new ThirdPartyExternalData({
        token: qpayAccessToken,
        origin: PaymentThirdPartyOrigin.QPay,
      });

      await newToken.save();
    }

    res.status(StatusCodes.OK).send("Token updated successfully");
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
});

export { router as qpayTokenUpdateRouter };

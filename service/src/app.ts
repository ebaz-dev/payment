import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import { errorHandler, NotFoundError, currentUser } from "@ebazdev/core";
import cookieSession from "cookie-session";
import { invoiceCreateRouter } from "./routes/invoice-create";
import { paymemntStatusRouter } from "./routes/payment-status";
import { qpayTokenUpdateRouter } from "./routes/third-party-token-get";
import dotenv from "dotenv";
import { healthRouter } from "./routes/health";
import axios from "axios";
import cron from "node-cron";

dotenv.config();

const apiPrefix = "/api/v1/payment";

const app = express();
app.set("trust proxy", true);
app.use(json());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== "test",
  })
);

app.use(currentUser);
app.use(apiPrefix, healthRouter);
app.use(apiPrefix, invoiceCreateRouter);
app.use(apiPrefix, paymemntStatusRouter);
app.use(apiPrefix, qpayTokenUpdateRouter);

app.all("*", async () => {
  throw new NotFoundError();
});

app.use(errorHandler);

cron.schedule("*/10 * * * *", async () => {
  try {
    console.log("Running scheduled task to update QPay token");
    await axios.get(`http://localhost:3000${apiPrefix}/qpay/token`);
    console.log("QPay token updated successfully");
  } catch (error) {
    console.error("Error updating QPay token:", error);
  }
});

export { app };

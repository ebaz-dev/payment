import mongoose from "mongoose";
import { app } from "./app";
import { natsWrapper } from "./nats-wrapper";

const start = async () => {
  if (!process.env.PORT) {
    throw new Error("INDEX_PORT must be defined");
  }

  if (!process.env.JWT_KEY) {
    throw new Error("JWT_KEY must be defined");
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be defined");
  }

  if (!process.env.NATS_CLIENT_ID) {
    throw new Error("NATS_CLIENT_ID must be defined");
  }

  if (!process.env.NATS_URL) {
    throw new Error("NATS_URL must be defined");
  }

  if (!process.env.NATS_CLUSTER_ID) {
    throw new Error("NATS_CLUSTER_ID must be defined");
  }

  if (!process.env.NATS_USER) {
    throw new Error("NATS_USER must be defined");
  }

  if (!process.env.NATS_PASS) {
    throw new Error("NATS_PASS must be defined");
  }

  if (!process.env.QPAY_PAYMENT_CHECK_URL) {
    throw new Error("QPAY_PAYMENT_CHECK_URL must be defined");
  }

  if (!process.env.QPAY_USERNAME) {
    throw new Error("QPAY_USERNAME must be defined");
  }

  if (!process.env.QPAY_PASSWORD) {
    throw new Error("QPAY_PASSWORD must be defined");
  }

  if (!process.env.QPAY_INVOICE_CODE) {
    throw new Error("QPAY_INVOICE_CODE must be defined");
  }

  if (!process.env.QPAY_AUTH_TOKEN_URL) {
    throw new Error("QPAY_AUTH_TOKEN_URL must be defined");
  }

  if (!process.env.QPAY_INVOICE_REQUEST_URL) {
    throw new Error("QPAY_INVOICE_REQUEST_URL must be defined");
  }

  if (!process.env.QPAY_CALLBACK_URL) {
    throw new Error("QPAY_CALLBACK_URL must be defined");
  }

  try {
    await natsWrapper.connect(
      process.env.NATS_CLUSTER_ID,
      process.env.NATS_CLIENT_ID,
      process.env.NATS_URL,
      process.env.NATS_USER,
      process.env.NATS_PASS
    );

    natsWrapper.client.on("close", () => {
      console.log("NATS connection closed!");
      process.exit();
    });

    process.on("SIGINT", () => natsWrapper.client.close());
    process.on("SIGTERM", () => natsWrapper.client.close());

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

  } catch (err) {
    console.error(err);
  }

  app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}!!!!!!!!!!`);
  });
};

start();

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

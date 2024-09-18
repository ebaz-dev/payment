import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import { errorHandler, NotFoundError, currentUser } from "@ebazdev/core";
import cookieSession from "cookie-session";
import { invoiceCreateRouter } from "./routes/invoice-create";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.API_PREFIX) {
  throw new Error("API_PREFIX must be defined");
}

const apiPrefix = process.env.API_PREFIX;

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
app.use(apiPrefix, invoiceCreateRouter);

app.all("*", async () => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };

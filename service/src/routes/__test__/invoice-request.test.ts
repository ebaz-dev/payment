import request from "supertest";
import { app } from "../../app";

const apiPrefix = `/api/v1/payment/invoice-create`;

it("returns 400 if orderId is not provided", async () => {
  const response = await request(app)
    .post(apiPrefix)
    .send({
      amount: 100,
      paymentMethod: "credit_card",
    })
    .expect(400);
});

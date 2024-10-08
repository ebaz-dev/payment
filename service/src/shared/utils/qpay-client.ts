import { QpayClient } from "./qpay-api-client";  // Path to your QpayClient class

// Initialize and export the QpayClient instance
export const qpayClient = new QpayClient();

// Optionally, you can get the token right away if needed
(async () => {
  try {
    await qpayClient.getToken();
    console.log("Qpay token initialized.");
  } catch (error) {
    console.error("Error initializing Qpay token:", error);
  }
})();

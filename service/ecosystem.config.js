const { PORTS, ENVS } = require('@ebazdev/core');

module.exports = {
  apps: [
    {
      name: "payment",
      script: "./build/index.js",
      instances: 1,
      exec_mode: "cluster",
      env_development: {
        NODE_ENV: "development",
        PORT: PORTS.DEV.Payment,
        NATS_CLIENT_ID: process.env.PM2_INSTANCE_ID ? `payment-service-${process.env.PM2_INSTANCE_ID}` : 'payment-service',
        PORT: '3000',
        QPAY_USERNAME: "EBAZAAR",
        QPAY_PASSWORD: "My7ZkVHq",
        QPAY_INVOICE_CODE: "EBAZAAR_INVOICE",
        QPAY_BASE_URI: "https://merchant.qpay.mn/v2",
        ...ENVS.DEV
      },
      env_stag: {
        NODE_ENV: "stag",
        PORT: PORTS.STAG.Payment,
        NATS_CLIENT_ID: process.env.PM2_INSTANCE_ID ? `payment-service-${process.env.PM2_INSTANCE_ID}` : 'payment-service',
        PORT: '3000',
        QPAY_USERNAME: "EBAZAAR",
        QPAY_PASSWORD: "My7ZkVHq",
        QPAY_INVOICE_CODE: "EBAZAAR_INVOICE",
        QPAY_BASE_URI: "https://merchant.qpay.mn/v2",
        ...ENVS.STAG
      },
      env_production: {
        NODE_ENV: "production",
        PORT: PORTS.DEV.Payment,
        NATS_CLIENT_ID: process.env.PM2_INSTANCE_ID ? `payment-service-${process.env.PM2_INSTANCE_ID}` : 'payment-service',
        PORT: '3000',
        QPAY_USERNAME: "EBAZAAR",
        QPAY_PASSWORD: "My7ZkVHq",
        QPAY_INVOICE_CODE: "EBAZAAR_INVOICE",
        QPAY_BASE_URI: "https://merchant.qpay.mn/v2",
        ...ENVS.PROD
      },
    },
  ],
};

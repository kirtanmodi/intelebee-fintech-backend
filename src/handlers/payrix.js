const payrixService = require("../services/payrix");
const { createSuccessResponse, createErrorResponse } = require("../utils/responses");
const dashboard = require("../services/payrix/dashboard");
const createMerchant = async (event) => {
  try {
    const merchantData = JSON.parse(event.body || "{}");

    // Basic validation
    if (!merchantData.name || !merchantData.email) {
      return createErrorResponse(400, "Name and email are required fields");
    }

    const result = await payrixService.createMerchant(merchantData);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payrix Handler Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create merchant", {
      message: error.message,
      details: error.details,
    });
  }
};

const getMerchants = async (event) => {
  try {
    // Parse any query parameters from the event
    const queryParams = event.queryStringParameters || {};

    const result = await payrixService.getMerchants(queryParams);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payrix Handler Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to fetch merchants", {
      message: error.message,
      details: error.details,
    });
  }
};

const deleteMerchant = async (event) => {
  try {
    // Validate merchantId exists in path parameters
    if (!event.pathParameters?.merchantId) {
      return createErrorResponse(400, "Merchant ID is required");
    }

    const merchantId = event.pathParameters.merchantId;
    const result = await payrixService.deleteMerchant(merchantId);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payrix Handler Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to delete merchant", {
      message: error.message,
      details: error.details,
    });
  }
};

const createPayment = async (event) => {
  try {
    const paymentData = JSON.parse(event.body || "{}");

    // Basic validation
    if (!paymentData.merchant || !paymentData.payment || !paymentData.total) {
      return createErrorResponse(400, "Missing required payment information");
    }

    // Validate payment card details
    const { payment } = paymentData;
    if (!payment.number || !payment.cvv || !payment.expiration) {
      return createErrorResponse(400, "Invalid payment card details");
    }

    // Set default values if not provided
    const enhancedPaymentData = {
      ...paymentData,
    };

    console.log("[Payrix Payment Data]:", paymentData);

    const result = await payrixService.createPayment(paymentData);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payrix Payment Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to process payment", {
      message: error.message,
      details: error.details,
    });
  }
};

const getMerchantDashboard = async (event) => {
  try {
    // Validate merchantId exists in path parameters
    if (!event.pathParameters?.merchantId) {
      return createErrorResponse(400, "Merchant ID is required");
    }

    console.log("[Payrix Dashboard Event]:", event?.pathParameters?.merchantId);

    const merchantId = event.pathParameters.merchantId;
    const result = await dashboard.getMerchantDashboard(merchantId);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payrix Dashboard Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to get merchant dashboard", {
      message: error.message,
      details: error.details,
    });
  }
};

module.exports = {
  createMerchant,
  getMerchants,
  deleteMerchant,
  createPayment,
  getMerchantDashboard,
};

const payrixService = require("../services/payrix");
const { createSuccessResponse, createErrorResponse } = require("../utils/responses");

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

module.exports = {
  createMerchant,
  getMerchants,
  deleteMerchant,
};

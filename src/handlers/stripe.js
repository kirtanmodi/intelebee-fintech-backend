const expressService = require("../services/stripe/express");
const standardService = require("../services/stripe/standard");
const accountService = require("../services/stripe/accounts");
const paymentService = require("../services/stripe/payments");
const { createSuccessResponse, createErrorResponse } = require("../utils/responses");

// Express Account Handlers
exports.createExpressOnboardingLink = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await expressService.createOnboardingLink(requestBody);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Stripe Express Onboarding Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create express onboarding link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Standard Account Handlers
exports.createStandardOnboardingLink = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await standardService.createOnboardingLink(requestBody);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Stripe Standard Onboarding Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create standard onboarding link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Account Management Handlers
exports.getAllAccounts = async () => {
  try {
    const accounts = await accountService.getAllAccounts();
    return createSuccessResponse({ accounts });
  } catch (error) {
    console.error("[Get All Accounts Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to fetch accounts");
  }
};

// Payment Handlers
exports.createPayment = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await paymentService.createPayment(requestBody);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Payment Creation Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create payment", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Add these exports to the existing handlers file
exports.createExpressDashboardLink = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await expressService.createDashboardLink(requestBody);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Express Dashboard Link Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create dashboard link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

exports.expressDashboardSettings = async (event) => {
  try {
    const settings = JSON.parse(event.body || "{}");
    const result = await expressService.updateDashboardSettings(settings);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Express Dashboard Settings Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to update dashboard settings", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

exports.createStandardDashboardLink = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await standardService.createDashboardLink(requestBody);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Standard Dashboard Link Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to create dashboard link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

exports.deleteAccount = async (event) => {
  try {
    const { accountId } = JSON.parse(event.body || "{}");
    await accountService.deleteAccount(accountId);
    return createSuccessResponse({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("[Delete Account Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to delete account", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

exports.updateAccountSettings = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const result = await accountService.updateAccountSettings(requestBody.accountId, requestBody.settings);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Update Account Settings Error]:", error);
    return createErrorResponse(error.statusCode || 500, "Failed to update account settings", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Add other handlers following the same pattern...

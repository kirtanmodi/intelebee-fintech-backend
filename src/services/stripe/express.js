const { v4: uuidv4 } = require("uuid");
const stripe = require("./index");
const { BASE_FRONTEND_URL } = require("../../config/constants");
const { createSuccessResponse, createErrorResponse } = require("../../utils/responses");

const createOnboardingLink = async (requestBody) => {
  const uid = uuidv4();
  const { email, business_profile, settings } = requestBody;

  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: settings?.payout_schedule || "manual" },
      },
      payments: {
        statement_descriptor: settings?.statement_descriptor || "INTELEBEE PAY",
      },
    },
    business_profile: business_profile || undefined,
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: "system",
      accountType: "express",
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
    return_url: `${BASE_FRONTEND_URL}/onboarding/complete?uid=${uid}&accountId=${account.id}`,
    type: "account_onboarding",
    collect: "eventually_due",
  });

  return {
    url: accountLink.url,
    accountId: account.id,
    type: "express_account_link",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

const createDashboardLink = async ({ accountId, returnUrl }) => {
  if (!accountId) {
    throw new Error("Account ID is required");
  }

  const loginLink = await stripe.accounts.createLoginLink(accountId, {
    redirect_url: returnUrl || `${BASE_FRONTEND_URL}/dashboard`,
  });

  return {
    url: loginLink.url,
    accountId,
    type: "express_dashboard_link",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

const updateDashboardSettings = async (settings) => {
  const { accountId, branding } = settings;

  if (!accountId) {
    throw new Error("Account ID is required");
  }

  const updatedAccount = await stripe.accounts.update(accountId, {
    settings: {
      branding: {
        primary_color: branding?.accentColor,
        logo: branding?.logo,
        icon: branding?.icon,
      },
      dashboard: {
        display_name: branding?.displayName,
      },
    },
  });

  return {
    success: true,
    accountId,
    updatedAt: new Date().toISOString(),
    settings: updatedAccount.settings,
  };
};

const checkAccountStatus = async (accountId) => {
  try {
    if (!accountId) {
      return createErrorResponse(400, "Account ID is required");
    }

    const account = await stripe.accounts.retrieve(accountId);

    const accountStatus = {
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        pending_verification: account.requirements?.pending_verification || [],
      },
    };

    return createSuccessResponse(accountStatus);
  } catch (error) {
    console.error("Error checking account status:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    return createErrorResponse(error.statusCode || 500, "Failed to check account status", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

module.exports = {
  createOnboardingLink,
  createDashboardLink,
  updateDashboardSettings,
  checkAccountStatus,
};

const stripe = require("./index");
const { v4: uuidv4 } = require("uuid");
const { validateEmail } = require("../../utils/validators");
const { SUPPORTED_BUSINESS_TYPES, BASE_FRONTEND_URL, DEFAULT_MCC_CODE } = require("../../config/constants");

const createOnboardingLink = async (requestBody) => {
  const { email, business_type = "individual" } = requestBody;

  if (!email || !validateEmail(email)) {
    throw new Error("Valid email is required");
  }

  if (!SUPPORTED_BUSINESS_TYPES.includes(business_type)) {
    throw new Error(`Invalid business type. Supported types: ${SUPPORTED_BUSINESS_TYPES.join(", ")}`);
  }

  const account = await stripe.accounts.create({
    type: "standard",
    email,
    business_type,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      mcc: DEFAULT_MCC_CODE,
      url: `${BASE_FRONTEND_URL}/connected-accounts`,
      support_email: email,
      support_url: `${BASE_FRONTEND_URL}/support`,
    },
    settings: {
      payouts: {
        schedule: { interval: "manual" },
      },
      payments: {
        statement_descriptor: "INTELEBEE PAY",
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: "system",
      accountType: "standard",
      businessType: business_type,
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
    return_url: `${BASE_FRONTEND_URL}/onboarding/complete`,
    type: "account_onboarding",
    collect: "eventually_due",
  });

  return {
    url: accountLink.url,
    accountId: account.id,
    type: "standard_account_link",
    email,
    businessType: business_type,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

const createDashboardLink = async ({ accountId, returnUrl }) => {
  if (!accountId) {
    throw new Error("Account ID is required");
  }

  const account = await stripe.accounts.retrieve(accountId);
  if (account.type !== "standard") {
    throw new Error("Account must be a standard account type");
  }

  const loginLink = await stripe.accounts.createLoginLink(accountId, {
    redirect_url: returnUrl,
  });

  return {
    url: loginLink.url,
    accountId,
    type: "standard_dashboard_link",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

module.exports = {
  createOnboardingLink,
  createDashboardLink,
};

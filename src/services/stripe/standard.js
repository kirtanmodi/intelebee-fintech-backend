const stripe = require("./index");
const { v4: uuidv4 } = require("uuid");
const { validateEmail } = require("../../utils/validators");
const { SUPPORTED_BUSINESS_TYPES, BASE_FRONTEND_URL, DEFAULT_MCC_CODE } = require("../../config/constants");

const createOnboardingLink = async (requestBody) => {
  try {
    const { email, business_type = "individual" } = requestBody;

    if (!email || !validateEmail(email)) {
      throw new Error("Valid email is required");
    }

    if (!SUPPORTED_BUSINESS_TYPES.includes(business_type)) {
      throw new Error(`Invalid business type. Supported types: ${SUPPORTED_BUSINESS_TYPES.join(", ")}`);
    }

    // Generate idempotency key for safe retries
    const idempotencyKey = uuidv4();

    const account = await stripe.accounts.create(
      {
        type: "standard",
        email,
        business_type,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          us_bank_account_ach_payments: { requested: true },
          tax_reporting_us_1099_k: { requested: true }, // For US tax reporting
        },
        business_profile: {
          mcc: DEFAULT_MCC_CODE,
          url: `${BASE_FRONTEND_URL}/connected-accounts`,
          support_email: email,
          support_url: `${BASE_FRONTEND_URL}/support`,
          product_description: "Payment processing services",
        },
        settings: {
          payouts: {
            schedule: { interval: "manual" },
            statement_descriptor: "INTELEBEE PAYOUT",
            debit_negative_balances: true,
          },
          payments: {
            statement_descriptor: "INTELEBEE PAY",
            statement_descriptor_prefix: "IB*",
            card_payments: {
              decline_on: {
                avs_failure: true,
                cvc_failure: true,
              },
            },
          },
          treasury: {
            tos_acceptance: { date: Math.floor(Date.now() / 1000) },
          },
        },
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "system",
          accountType: "standard",
          businessType: business_type,
          idempotencyKey,
        },
      },
      {
        idempotencyKey,
      }
    );

    const accountLink = await stripe.accountLinks.create(
      {
        account: account.id,
        refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
        return_url: `${BASE_FRONTEND_URL}/onboarding/complete`,
        type: "account_onboarding",
        collect: "eventually_due",
        collect_requirements: {
          currently_due: true,
          eventually_due: true,
          past_due: true,
          pending_verification: true,
        },
      },
      {
        idempotencyKey: uuidv4(), // Separate idempotency key for account link
      }
    );

    return {
      url: accountLink.url,
      accountId: account.id,
      type: "standard_account_link",
      email,
      businessType: business_type,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      requirements: account.requirements,
      capabilities: account.capabilities,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
    };
  } catch (error) {
    if (error.type === "StripeError") {
      throw new Error(`Stripe API Error: ${error.message}`);
    }
    throw error;
  }
};

const createDashboardLink = async ({ accountId, returnUrl }) => {
  try {
    if (!accountId) {
      throw new Error("Account ID is required");
    }

    const account = await stripe.accounts.retrieve(accountId);

    if (account.type !== "standard") {
      throw new Error("Account must be a standard account type");
    }

    const loginLink = await stripe.accounts.createLoginLink(
      accountId,
      {
        redirect_url: returnUrl,
      },
      {
        idempotencyKey: uuidv4(),
      }
    );

    return {
      url: loginLink.url,
      accountId,
      type: "standard_dashboard_link",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      accountStatus: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
      },
    };
  } catch (error) {
    if (error.type === "StripeError") {
      throw new Error(`Stripe API Error: ${error.message}`);
    }
    throw error;
  }
};

// Direct Payment function for Standard accounts
const createDirectPayment = async ({ accountId, amount, currency = "usd", paymentMethodId, description, metadata = {} }) => {
  try {
    if (!accountId || !amount || !paymentMethodId) {
      throw new Error("Account ID, amount, and payment method are required");
    }

    // Verify account exists and is enabled for payments
    const account = await stripe.accounts.retrieve(accountId);
    if (!account.charges_enabled) {
      throw new Error("Account is not fully onboarded or enabled for charges");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirmation_method: "manual",
      confirm: true,
      description,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        paymentType: "direct_charge",
      },
      on_behalf_of: accountId, // This is key for direct charges
      transfer_data: {
        destination: accountId,
      },
      statement_descriptor_suffix: account.business_profile?.name?.slice(0, 12) || "",
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      chargeId: paymentIntent.latest_charge,
    };
  } catch (error) {
    if (error.type === "StripeError") {
      throw new Error(`Stripe API Error: ${error.message}`);
    }
    throw error;
  }
};

// Refund handling for direct payments
const createDirectRefund = async ({ chargeId, amount, reason = "requested_by_customer", metadata = {} }) => {
  try {
    if (!chargeId) {
      throw new Error("Charge ID is required");
    }

    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount,
      reason,
      metadata: {
        ...metadata,
        refundedAt: new Date().toISOString(),
        refundType: "direct_charge_refund",
      },
    });

    return {
      success: true,
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      currency: refund.currency,
    };
  } catch (error) {
    if (error.type === "StripeError") {
      throw new Error(`Stripe API Error: ${error.message}`);
    }
    throw error;
  }
};

// Update account capabilities
const updateAccountCapabilities = async (accountId) => {
  try {
    if (!accountId) {
      throw new Error("Account ID is required");
    }

    const account = await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        tax_reporting_us_1099_k: { requested: true },
        us_bank_account_ach_payments: { requested: true },
        link_payments: { requested: true },
        afterpay_clearpay_payments: { requested: true },
        card_issuing: { requested: true },
        sofort_payments: { requested: true },
      },
    });

    return {
      success: true,
      accountId: account.id,
      capabilities: account.capabilities,
      requirements: account.requirements,
    };
  } catch (error) {
    if (error.type === "StripeError") {
      throw new Error(`Stripe API Error: ${error.message}`);
    }
    throw error;
  }
};

module.exports = {
  createOnboardingLink,
  createDashboardLink,
  createDirectPayment,
  createDirectRefund,
  updateAccountCapabilities,
};

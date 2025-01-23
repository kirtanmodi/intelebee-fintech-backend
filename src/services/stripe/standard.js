const stripe = require("./index");
const { v4: uuidv4 } = require("uuid");
const { validateEmail } = require("../../utils/validators");
const { SUPPORTED_BUSINESS_TYPES, BASE_FRONTEND_URL, DEFAULT_MCC_CODE } = require("../../config/constants");

const createOnboardingLink = async (requestBody) => {
  try {
    const { email, business_type = "individual", account_id } = requestBody;

    // if (!email || !validateEmail(email)) {
    //   throw new Error("Valid email is required");
    // }

    // if (!SUPPORTED_BUSINESS_TYPES.includes(business_type)) {
    //   throw new Error(`Invalid business type. Supported types: ${SUPPORTED_BUSINESS_TYPES.join(", ")}`);
    // }

    const idempotencyKey = uuidv4();

    if (account_id) {
      const account = await stripe.accounts.retrieve(account_id);
      if (account.type !== "standard") {
        throw new Error("Account is not a standard account");
      }

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${BASE_FRONTEND_URL}/stripe-standard/onboarding/refresh`,
        return_url: `${BASE_FRONTEND_URL}/stripe-standard/onboarding/complete?accountId=${account.id}`,
        type: "account_onboarding",
      });

      return {
        url: accountLink.url,
        accountId: account.id,
        type: "standard_account_link",
        email,
        businessType: business_type,
      };
    }

    // Simplified account creation with essential capabilities
    // const account = await stripe.accounts.create(
    //   {
    //     type: "standard",
    //     email,
    //     business_type,
    //     capabilities: {
    //       card_payments: { requested: true },
    //       transfers: { requested: true },
    //     },
    //     business_profile: {
    //       mcc: DEFAULT_MCC_CODE,
    //       url: `${BASE_FRONTEND_URL}/connected-accounts`,
    //       support_email: email,
    //     },
    //     settings: {
    //       payouts: {
    //         schedule: { interval: "manual" },
    //         statement_descriptor: "INTELEBEE PAYOUT",
    //       },
    //       payments: {
    //         statement_descriptor: "INTELEBEE PAY",
    //       },
    //     },
    //     metadata: {
    //       createdAt: new Date().toISOString(),
    //       accountType: "standard",
    //       businessType: business_type,
    //     },
    //   },
    //   { idempotencyKey }
    // );

    const account = await stripe.accounts.create({
      type: "standard",
      email,
      business_type,
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${BASE_FRONTEND_URL}/stripe-standard/onboarding/refresh`,
      return_url: `${BASE_FRONTEND_URL}/stripe-standard/onboarding/complete?accountId=${account.id}`,
      type: "account_onboarding",
    });

    // Simplified account link creation
    // const accountLink = await stripe.accountLinks.create({
    //   account: account.id,
    //   refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
    //   return_url: `${BASE_FRONTEND_URL}/onboarding/complete`,
    //   type: "account_onboarding",
    //   collect: "eventually_due",
    // });

    return {
      url: accountLink.url,
      accountId: account.id,
      type: "standard_account_link",
      email,
      businessType: business_type,
      requirements: account.requirements,
      capabilities: account.capabilities,
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
const createDirectPayment = async ({ accountId, amount, currency = "usd", paymentMethodId, description }) => {
  try {
    if (!accountId || !amount || !paymentMethodId) {
      throw new Error("Account ID, amount, and payment method are required");
    }

    const account = await stripe.accounts.retrieve(accountId);
    if (!account.charges_enabled) {
      throw new Error("Account is not fully onboarded or enabled for charges");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirm: true,
      description,
      on_behalf_of: accountId,
      transfer_data: {
        destination: accountId,
      },
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
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

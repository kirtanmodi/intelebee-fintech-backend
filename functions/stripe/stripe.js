const Stripe = require("stripe");
const { v4: uuidv4 } = require("uuid");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Constants
const SUPPORTED_BUSINESS_TYPES = ["individual", "company", "non_profit", "government_entity"];
const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5;
const BASE_FRONTEND_URL = "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com";
const DEFAULT_MCC_CODE = "5734"; // Computer Software Stores

// Utility functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const createErrorResponse = (statusCode, message, details = null) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,Origin,Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,HEAD",
    "Access-Control-Max-Age": "3600",
  },
  body: JSON.stringify({
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  }),
});

const createSuccessResponse = (data) => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,Origin,Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,HEAD",
    "Access-Control-Max-Age": "3600",
  },
  body: JSON.stringify({
    success: true,
    ...data,
    timestamp: new Date().toISOString(),
  }),
});

// ------------------------------------------------------------------------------------------------ Express ------------------------------------------------------------------------------------------------

// Create Express Onboarding Link
module.exports.createOnboardingLink = async (event) => {
  // Sample request body:
  /*
  {
    "email": "user@example.com", // Optional email for the connected account
    "business_profile": { // Optional business profile details
      "name": "My Business",
      "url": "https://mybusiness.com",
      "support_email": "support@mybusiness.com",
      "support_phone": "+1234567890"
    },
    "settings": { // Optional custom settings
      "statement_descriptor": "CUSTOM DESC", // Defaults to "INTELEBEE PAY"
      "payout_schedule": "manual" // or "daily", "weekly", "monthly"
    }
  }
  */
  const uid = uuidv4();

  try {
    const requestBody = JSON.parse(event.body || "{}");
    const { email, business_profile, settings } = requestBody;

    // Create Express account with enhanced configuration
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

    // Create onboarding link with enhanced configuration
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
      return_url: `${BASE_FRONTEND_URL}/onboarding/complete?uid=${uid}&accountId=${account.id}`,
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return createSuccessResponse({
      url: accountLink.url,
      accountId: account.id,
      type: "express_account_link",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Links expire in 24 hours
    });
  } catch (error) {
    console.error("[Stripe Express Onboarding Error]:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    return createErrorResponse(error.statusCode || 500, "Failed to create express onboarding link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Check Account Status
module.exports.checkAccountStatus = async (event) => {
  try {
    const { accountId } = event.pathParameters;

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

// Create Express Dashboard Link
module.exports.createExpressDashboardLink = async (event) => {
  try {
    const { accountId, returnUrl } = JSON.parse(event.body || "{}");

    if (!accountId) {
      return createErrorResponse(400, "Account ID is required");
    }

    // Create login link with enhanced configuration
    const loginLink = await stripe.accounts.createLoginLink(accountId, {
      redirect_url: returnUrl || `${BASE_FRONTEND_URL}/dashboard`,
    });

    return createSuccessResponse({
      url: loginLink.url,
      accountId,
      type: "express_dashboard_link",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Links expire in 24 hours
    });
  } catch (error) {
    console.error("[Stripe Dashboard Link Error]:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    // Handle specific Stripe errors
    if (error.type === "StripeInvalidRequestError") {
      return createErrorResponse(400, "Invalid account ID or configuration", {
        message: error.message,
        code: error.code,
      });
    }

    return createErrorResponse(error.statusCode || 500, "Failed to create dashboard link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Express Dashboard Settings
module.exports.expressDashboardSettings = async (event) => {
  try {
    const settings = JSON.parse(event.body || "{}");
    const { accountId } = settings;

    if (!accountId) {
      return createErrorResponse(400, "Account ID is required");
    }

    // Update Stripe account branding settings
    await stripe.accounts.update(accountId, {
      settings: {
        branding: {
          primary_color: settings.branding?.accentColor,
          logo: settings.branding?.logo,
          icon: settings.branding?.icon,
        },
        dashboard: {
          display_name: settings.branding?.displayName,
        },
      },
    });

    return createSuccessResponse({
      success: true,
      accountId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Express Dashboard Settings Error]:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    return createErrorResponse(error.statusCode || 500, "Failed to update dashboard settings", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// ------------------------------------------------------------------------------------------------ Standard ------------------------------------------------------------------------------------------------

// Create Standard Onboarding Link
module.exports.createStandardOnboardingLink = async (event) => {
  // Sample request body
  const sampleBody = {
    email: "merchant@example.com",
    business_type: "individual", // Optional, defaults to "individual". Other options: "company", "non_profit", "government_entity"
  };

  try {
    const requestBody = JSON.parse(event.body || "{}");
    const { email, business_type = "individual" } = requestBody;

    // Input validation
    if (!email || !validateEmail(email)) {
      return createErrorResponse(400, "Valid email is required");
    }

    if (!SUPPORTED_BUSINESS_TYPES.includes(business_type)) {
      return createErrorResponse(400, `Invalid business type. Supported types: ${SUPPORTED_BUSINESS_TYPES.join(", ")}`);
    }

    // Create Standard account with enhanced configuration
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

    // Create account link with enhanced configuration
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${BASE_FRONTEND_URL}/onboarding/refresh`,
      return_url: `${BASE_FRONTEND_URL}/onboarding/complete`,
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return createSuccessResponse({
      url: accountLink.url,
      accountId: account.id,
      type: "standard_account_link",
      email,
      businessType: business_type,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("[Stripe Standard Onboarding Error]:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    // Handle specific Stripe errors
    if (error.code === "account_invalid") {
      return createErrorResponse(400, "Invalid account configuration");
    }

    if (error.code === "email_invalid") {
      return createErrorResponse(400, "Invalid email address provided");
    }

    return createErrorResponse(error.statusCode || 500, "Failed to create standard onboarding link", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
  }
};

// Create Standard Dashboard Link
module.exports.createStandardDashboardLink = async (event) => {
  try {
    // Parse the request body
    const { accountId, returnUrl } = JSON.parse(event.body || "{}");

    // Input validation
    if (!returnUrl) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Return URL is required",
        }),
      };
    }

    if (!accountId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Account ID is required",
        }),
      };
    }

    // Verify account exists and is a standard account
    const account = await stripe.accounts.retrieve(accountId);
    if (account.type !== "standard") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Account must be a standard account type",
        }),
      };
    }

    // Create login link with redirect URL
    const loginLink = await stripe.accounts.createLoginLink(accountId, {
      redirect_url: returnUrl,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        url: loginLink.url,
        accountId,
        type: "standard_dashboard_link",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    };
  } catch (error) {
    console.error("Error creating dashboard login link:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to generate dashboard access link",
      }),
    };
  }
};

// ------------------------------------------------------------------------------------------------ Account Settings ------------------------------------------------------------------------------------------------
// Update Account Settings
module.exports.updateAccountSettings = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const { accountId } = requestBody;

    if (!accountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "accountId is required" }),
      };
    }

    const accountSettings = await stripe.accounts.update(accountId, {
      controller: {
        stripe_dashboard: {
          type: "full",
        },
        fees: {
          payer: "account",
        },
        losses: {
          payments: "stripe",
        },
        requirement_collection: "stripe",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Account settings updated successfully",
        settings: accountSettings,
      }),
    };
  } catch (error) {
    console.error("Stripe Account Settings Error:", error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: error.message,
        type: error.type,
        code: error.code,
      }),
    };
  }
};

// ------------------------------------------------------------------------------------------------ Account ------------------------------------------------------------------------------------------------

// Get Account
module.exports.getAccount = async (event) => {
  try {
    const { accountId } = JSON.parse(event.body);

    if (!accountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "accountId is required" }),
      };
    }

    const account = await stripe.accounts.retrieve(accountId);

    return {
      statusCode: 200,
      body: JSON.stringify(account),
    };
  } catch (error) {
    console.error("Stripe Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Delete Account
module.exports.deleteAccount = async (event) => {
  try {
    const { accountId } = JSON.parse(event.body);

    if (!accountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "accountId is required" }),
      };
    }

    await stripe.accounts.del(accountId);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Account deleted successfully" }),
    };
  } catch (error) {
    console.error("Stripe Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Get All Accounts
module.exports.getAllAccounts = async (event) => {
  try {
    const accounts = await stripe.accounts.list({
      limit: 100, // Adjust limit as needed
    });

    return {
      statusCode: 200,
      body: JSON.stringify(accounts.data),
    };
  } catch (error) {
    console.error("Stripe Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// ------------------------------------------------------------------------------------------------ Payment ------------------------------------------------------------------------------------------------
// Create payment for a connected account
module.exports.createPayment = async (event) => {
  // Sample request body:
  /*
  {
    "amount": 1000, // Amount in cents (e.g., $10.00)
    "currency": "usd", // Supported: usd, eur, gbp, aud
    "accountId": "acct_123xyz", // Connected Stripe account ID
    "description": "Payment for services", // Optional payment description
    "platformFeePercentage": 5, // Optional, defaults to 5%
    "metadata": { // Optional additional metadata
      "orderId": "ord_123",
      "customerName": "John Doe"
    }
  }
  */
  try {
    const {
      amount,
      currency,
      accountId,
      description,
      platformFeePercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE, // Default platform fee is 5%
      metadata = {},
    } = JSON.parse(event.body || "{}");

    // Input validation
    const validationErrors = [];
    if (!amount || amount <= 0) validationErrors.push("Amount must be greater than 0");
    if (!currency) validationErrors.push("Currency is required");
    if (!accountId) validationErrors.push("Connected account ID is required");

    // Check for supported currencies
    const supportedCurrencies = ["usd", "eur", "gbp", "aud"];
    if (!supportedCurrencies.includes(currency?.toLowerCase())) {
      validationErrors.push(`Currency not supported. Supported currencies: ${supportedCurrencies.join(", ")}`);
    }

    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Validation failed",
          details: validationErrors,
        }),
      };
    }

    // Verify connected account exists and is enabled
    const account = await stripe.accounts.retrieve(accountId);
    if (!account || !account.charges_enabled) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid account or account not fully onboarded",
          details: "The connected account must be fully onboarded to receive payments",
        }),
      };
    }

    // Calculate platform fee (ensuring it's an integer)
    const platformFee = Math.max(
      Math.round(amount * (platformFeePercentage / 100) || 0),
      50 // Minimum fee of 50 cents
    );

    // Create payment intent with enhanced configuration
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency.toLowerCase(),
      description: description || `Payment to ${account.business_profile?.name || accountId}`,
      application_fee_amount: platformFee,
      automatic_payment_methods: {
        enabled: true,
      },
      transfer_data: {
        destination: accountId,
      },
      metadata: {
        ...metadata,
        platformFeePercentage,
        platformFeeAmount: platformFee,
        createdAt: new Date().toISOString(),
      },
      statement_descriptor: "INTELEBEE PAY", // Max 22 characters
      statement_descriptor_suffix: account.business_profile?.name?.slice(0, 12) || "", // Max 12 characters
      capture_method: "automatic",
      confirm: false,
      setup_future_usage: "off_session",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        platformFee,
        destinationAccount: accountId,
        status: paymentIntent.status,
      }),
    };
  } catch (error) {
    console.error("Payment creation error:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    // Handle specific Stripe errors
    if (error.type === "StripeInvalidRequestError") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid request to payment service",
          message: error.message,
          code: error.code,
        }),
      };
    }

    if (error.type === "StripeAuthenticationError") {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Authentication with payment service failed",
          message: "Invalid API key or unauthorized access",
        }),
      };
    }

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: "Payment processing failed",
        message: error.message,
        code: error.code,
        type: error.type,
      }),
    };
  }
};

// ------------------------------------------------------------------------------------------------ Payout ------------------------------------------------------------------------------------------------

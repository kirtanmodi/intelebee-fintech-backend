const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Express Onboarding Link
module.exports.createOnboardingLink = async (event) => {
  // const { id } = event.body;
  const uid = uuidv4();
  try {
    // Create or retrieve a connected account
    const account = await stripe.accounts.create({ type: "express" });

    // console.log("Account created:", account);

    // Create the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com/",
      return_url: `http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com?uid=${uid}`,
      type: "account_onboarding",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: accountLink.url }),
    };
  } catch (error) {
    console.error("Stripe Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Create Standard Onboarding Link
module.exports.createStandardOnboardingLink = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || "{}");
    const { email, business_type = "individual" } = requestBody;

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    // Create a Standard account
    const account = await stripe.accounts.create({
      type: "standard",
      email,
      business_type,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        mcc: "5734", // Computer Software Stores
        url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com/connected-accounts",
      },
      settings: {
        payouts: {
          schedule: {
            interval: "manual", // or 'daily', 'weekly', 'monthly'
          },
        },
      },
    });

    // Create the account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com",
      return_url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com",
      type: "account_onboarding",
      collect: "eventually_due",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: accountLink.url,
        accountId: account.id,
        object: "standard_account_link",
      }),
    };
  } catch (error) {
    console.error("Stripe Standard Account Error:", error);
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

// Create payment for a connected account
module.exports.createPayment = async (event) => {
  try {
    const {
      amount,
      currency,
      accountId,
      description,
      platformFeePercentage = 5, // Default platform fee is 5%
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

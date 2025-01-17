const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.createOnboardingLink = async (event) => {
  try {
    // Create or retrieve a connected account
    const account = await stripe.accounts.create({ type: "express" });

    // console.log("Account created:", account);

    // Create the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com/",
      return_url: "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com/",
      type: "account_onboarding",
    });

    console.log("Account link created:", accountLink);

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

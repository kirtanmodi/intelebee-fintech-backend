const stripe = require("./index");

const getAccount = async (accountId) => {
  if (!accountId) {
    throw new Error("accountId is required");
  }
  return await stripe.accounts.retrieve(accountId);
};

const deleteAccount = async (accountId) => {
  if (!accountId) {
    throw new Error("accountId is required");
  }
  return await stripe.accounts.del(accountId);
};

const getAllAccounts = async (limit = 100) => {
  return await stripe.accounts.list({ limit });
};

const updateAccountSettings = async (accountId) => {
  try {
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

const checkAccountStatus = async (accountId) => {
  if (!accountId) {
    throw new Error("Account ID is required");
  }

  const account = await stripe.accounts.retrieve(accountId);

  return {
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    requirements: {
      currently_due: account.requirements?.currently_due || [],
      eventually_due: account.requirements?.eventually_due || [],
      pending_verification: account.requirements?.pending_verification || [],
    },
  };
};

module.exports = {
  getAccount,
  deleteAccount,
  getAllAccounts,
  updateAccountSettings,
  checkAccountStatus,
};

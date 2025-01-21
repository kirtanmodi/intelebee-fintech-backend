const stripe = require("./index");
const { DEFAULT_PLATFORM_FEE_PERCENTAGE } = require("../../config/constants");

const createPayment = async ({
  amount,
  currency,
  accountId,
  description,
  platformFeePercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
  metadata = {},
}) => {
  // Input validation
  const validationErrors = [];
  if (!amount || amount <= 0) validationErrors.push("Amount must be greater than 0");
  if (!currency) validationErrors.push("Currency is required");
  if (!accountId) validationErrors.push("Connected account ID is required");

  const supportedCurrencies = ["usd", "eur", "gbp", "aud"];
  if (!supportedCurrencies.includes(currency?.toLowerCase())) {
    validationErrors.push(`Currency not supported. Supported currencies: ${supportedCurrencies.join(", ")}`);
  }

  if (validationErrors.length > 0) {
    throw new Error(JSON.stringify(validationErrors));
  }

  // Verify connected account exists and is enabled
  const account = await stripe.accounts.retrieve(accountId);
  if (!account || !account.charges_enabled) {
    throw new Error("Invalid account or account not fully onboarded");
  }

  // Calculate platform fee
  const platformFee = Math.max(
    Math.round(amount * (platformFeePercentage / 100) || 0),
    50 // Minimum fee of 50 cents
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: currency.toLowerCase(),
    description: description || `Payment to ${account.business_profile?.name || accountId}`,
    application_fee_amount: platformFee,
    automatic_payment_methods: { enabled: true },
    transfer_data: { destination: accountId },
    metadata: {
      ...metadata,
      platformFeePercentage,
      platformFeeAmount: platformFee,
      createdAt: new Date().toISOString(),
    },
    statement_descriptor: "INTELEBEE PAY",
    statement_descriptor_suffix: account.business_profile?.name?.slice(0, 12) || "",
    capture_method: "automatic",
    confirm: false,
    setup_future_usage: "off_session",
  });

  return {
    paymentIntent,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    platformFee,
    destinationAccount: accountId,
    status: paymentIntent.status,
  };
};

module.exports = {
  createPayment,
};

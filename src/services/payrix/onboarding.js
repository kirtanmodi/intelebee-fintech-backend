const makePayrixRequest = require("./index").makePayrixRequest;

const updateMerchantOnboarding = async (merchantId, onboardingData) => {
  if (!merchantId) {
    throw new Error("Merchant ID is required");
  }

  const { status, documents, bank_account, verification_details } = onboardingData;

  // Validate onboarding requirements
  const validationErrors = [];

  if (bank_account && (!bank_account.routing_number || !bank_account.account_number)) {
    validationErrors.push("Complete bank account information is required");
  }

  if (documents && (!documents.business_license || !documents.tax_document)) {
    validationErrors.push("Required documents are missing");
  }

  if (validationErrors.length > 0) {
    throw new Error(JSON.stringify(validationErrors));
  }

  // Update merchant onboarding status
  const payload = {
    type: "merchant",
    data: {
      status: status || "pending_review",
      verification: {
        documents: documents,
        bank_account: {
          type: bank_account?.type || "checking",
          routing_number: bank_account?.routing_number,
          account_number: bank_account?.account_number,
          bank_name: bank_account?.bank_name,
        },
        details: verification_details,
      },
      metadata: {
        updated_at: new Date().toISOString(),
        onboarding_step: status,
      },
    },
  };

  return makePayrixRequest("PUT", `/merchants/${merchantId}`, payload);
};

module.exports = { updateMerchantOnboarding };

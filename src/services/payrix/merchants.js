const makePayrixRequest = require("./index").makePayrixRequest;
const { validateEmail, validatePhoneNumber } = require("../../utils/validators");

const createMerchant = async (merchantData) => {
  // Validate required fields
  const validationErrors = [];
  const { name, email, phone, address, business_type, tax_id, website } = merchantData;

  if (!name) validationErrors.push("Business name is required");
  if (!email || !validateEmail(email)) validationErrors.push("Valid email is required");
  if (!phone || !validatePhoneNumber(phone)) validationErrors.push("Valid phone number is required");
  if (!address?.line1 || !address?.city || !address?.state || !address?.postal_code) {
    validationErrors.push("Complete address is required");
  }

  if (validationErrors.length > 0) {
    throw new Error(JSON.stringify(validationErrors));
  }

  // Prepare merchant data for Payrix API
  const payload = {
    type: "merchant",
    data: {
      name,
      email,
      phone,
      address: {
        line1: address.line1,
        line2: address.line2 || "",
        city: address.city,
        state: address.state,
        postal: address.postal_code,
        country: address.country || "US",
      },
      business: {
        type: business_type,
        tax_id: tax_id,
        website: website,
      },
      status: "pending",
      metadata: {
        created_at: new Date().toISOString(),
        platform: "intelebee",
      },
    },
  };

  return makePayrixRequest("POST", "/merchants", payload);
};

module.exports = { createMerchant };

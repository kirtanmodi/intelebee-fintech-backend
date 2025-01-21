const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePaymentInput = ({ amount, currency, accountId }) => {
  const validationErrors = [];
  if (!amount || amount <= 0) validationErrors.push("Amount must be greater than 0");
  if (!currency) validationErrors.push("Currency is required");
  if (!accountId) validationErrors.push("Connected account ID is required");
  return validationErrors;
};

module.exports = {
  validateEmail,
  validatePaymentInput,
};

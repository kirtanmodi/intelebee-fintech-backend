const SUPPORTED_BUSINESS_TYPES = ["individual", "company", "non_profit", "government_entity"];
const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5;
// const BASE_FRONTEND_URL = "http://intelebee-fintech-frontend.s3-website-us-east-1.amazonaws.com";
const BASE_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_MCC_CODE = "5734"; // Computer Software Stores
const SUPPORTED_CURRENCIES = ["usd", "eur", "gbp", "aud"];

module.exports = {
  SUPPORTED_BUSINESS_TYPES,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  BASE_FRONTEND_URL,
  DEFAULT_MCC_CODE,
  SUPPORTED_CURRENCIES,
};

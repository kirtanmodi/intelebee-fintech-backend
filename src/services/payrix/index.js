const axios = require("axios");

const PAYRIX_API_URL = "https://test-api.payrix.com";
const PAYRIX_API_KEY = process.env.PAYRIX_API_KEY;

const createMerchant = async (merchantData) => {
  try {
    const response = await axios.post(`${PAYRIX_API_URL}/entities`, merchantData, {
      headers: {
        APIKEY: `${PAYRIX_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("[Payrix Merchant Creation Response]:", response.data);

    return {
      success: true,
      merchantId: response.data.id,
      data: response.data,
    };
  } catch (error) {
    console.error("[Payrix Merchant Creation Error]:", {
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || "Failed to create merchant",
      details: error.response?.data,
    };
  }
};

const getMerchants = async (queryParams = {}) => {
  try {
    const response = await axios.get(`${PAYRIX_API_URL}/entities`, {
      params: queryParams,
      headers: {
        APIKEY: `${PAYRIX_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("[Payrix Get Merchants Response]:", response.data);

    return {
      success: true,
      merchants: response.data || [],
      pagination: response.data.pagination || {},
    };
  } catch (error) {
    console.error("[Payrix Get Merchants Error]:", {
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || "Failed to fetch merchants",
      details: error.response?.data,
    };
  }
};

const deleteMerchant = async (merchantId) => {
  try {
    const response = await axios.delete(`${PAYRIX_API_URL}/entities/${merchantId}`, {
      headers: {
        APIKEY: `${PAYRIX_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("[Payrix Merchant Deletion Response]:", response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("[Payrix Merchant Deletion Error]:", {
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || "Failed to delete merchant",
      details: error.response?.data,
    };
  }
};

module.exports = {
  createMerchant,
  getMerchants,
  deleteMerchant,
};

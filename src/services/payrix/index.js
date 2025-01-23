const axios = require("axios");

const PAYRIX_API_URL = "https://test-api.payrix.com";
const PAYRIX_API_KEY = process.env.PAYRIX_API_KEY;

const makePayrixRequest = async (method, endpoint, data = null, params = null) => {
  try {
    const config = {
      method,
      url: `${PAYRIX_API_URL}${endpoint}`,
      headers: {
        APIKEY: `${PAYRIX_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (data) config.data = data;
    if (params) config.params = params;

    const response = await axios(config);
    console.log(`[Payrix ${method} Response]:`, response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(`[Payrix ${method} Error]:`, {
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || `Failed to ${method.toLowerCase()} request`,
      details: error.response?.data,
    };
  }
};

const createMerchant = (merchantData) => makePayrixRequest("POST", "/entities", merchantData);

const getMerchants = (queryParams) => makePayrixRequest("GET", "/entities", null, queryParams);

const deleteMerchant = (merchantId) => makePayrixRequest("DELETE", `/entities/${merchantId}`);

module.exports = {
  createMerchant,
  getMerchants,
  deleteMerchant,
};

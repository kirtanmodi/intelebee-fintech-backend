const makePayrixRequest = require("./index").makePayrixRequest;

const getMerchantDashboard = async (merchantId) => {
  if (!merchantId) {
    throw new Error("Merchant ID is required");
  }

  try {
    // Fetch data in parallel for better performance
    const [merchantDetails, transactions, settlements, disputes] = await Promise.all([
      makePayrixRequest("GET", `/merchants/${merchantId}`),
      makePayrixRequest("GET", "/txns", { merchant: merchantId, limit: 10 }),
      makePayrixRequest("GET", "/settlements", { merchant: merchantId, limit: 5 }),
      makePayrixRequest("GET", "/disputes", { merchant: merchantId, status: "open" }),
    ]);

    // Validate response data
    if (!merchantDetails?.data) {
      throw new Error("Invalid merchant details response");
    }

    const transactionsData = Array.isArray(transactions?.data) ? transactions.data : [];
    const settlementsData = Array.isArray(settlements?.data) ? settlements.data : [];
    const disputesData = Array.isArray(disputes?.data) ? disputes.data : [];

    // Calculate key metrics with validated data
    const totalTransactions = transactionsData.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const pendingSettlements = settlementsData.filter((s) => s.status === "pending");
    const openDisputes = disputesData.length;

    return {
      merchant: merchantDetails.data,
      metrics: {
        total_transaction_volume: totalTransactions,
        pending_settlements: pendingSettlements.length,
        open_disputes: openDisputes,
        last_settlement_date: settlementsData[0]?.created_at || null,
      },
      recent_activity: {
        transactions: transactionsData,
        settlements: settlementsData,
      },
    };
  } catch (error) {
    console.error("[Merchant Dashboard Error]:", error);
    throw new Error(`Failed to get merchant dashboard: ${error.message}`);
  }
};

module.exports = { getMerchantDashboard };

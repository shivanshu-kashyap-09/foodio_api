const cron = require("node-cron");
const Database = require("../utils/Database");
const OrderTrackingService = require("../services/OrderTrackingService");

// 🔥 RUN EVERY 1 MINUTE
cron.schedule("* * * * *", async () => {
  console.log("⏳ Cron Running...");

  try {
    const orders = await Database.query(`
      SELECT order_id, status, created_at, delivery_partner_id
      FROM orders
      WHERE status NOT IN ('delivered','cancelled','refunded')
    `);

    const now = new Date();

    for (const order of orders) {
      let nextStatus = null;

      const created = new Date(order.created_at);
      const diff = (now - created) / 60000; // minutes

      // 🔥 realistic flow
      if (diff > 1 && order.status === "pending") nextStatus = "confirmed";
      else if (diff > 2 && order.status === "confirmed") nextStatus = "preparing";
      else if (diff > 4 && order.status === "preparing") nextStatus = "ready";
      else if (diff > 6 && order.status === "ready") nextStatus = "out_for_delivery";
      else if (diff > 10 && order.status === "out_for_delivery") nextStatus = "delivered";

      if (nextStatus) {
        await OrderTrackingService.updateOrderStatusWithTracking(
          order.order_id,
          nextStatus,
          {
            changeType: "system",
            reason: "Auto update via cron"
          }
        );

        console.log(`✅ Order ${order.order_id} → ${nextStatus}`);
      }

      // 🔥 fake live tracking
      if (order.status === "out_for_delivery" && order.delivery_partner_id) {
        await OrderTrackingService.updateDeliveryLocation(
          order.order_id,
          order.delivery_partner_id,
          {
            latitude: 29.9457 + Math.random() * 0.01,
            longitude: 78.1642 + Math.random() * 0.01
          }
        );
      }
    }

  } catch (err) {
    console.error("❌ Cron Error:", err.message);
  }
});
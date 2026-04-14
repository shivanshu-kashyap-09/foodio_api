const cron = require("node-cron");
const Database = require("../utils/Database");
const OrderTrackingService = require("../services/OrderTrackingService");

// 🔥 RUN EVERY 1 MINUTE
cron.schedule("* * * * *", async () => {
  console.log("⏳ Cron Running...");

  try {
    const orders = await Database.query(`
      SELECT order_id, status, created_at, delivery_partner_id, delivery_partner_name, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS diff_minutes
      FROM orders
      WHERE status NOT IN ('delivered','cancelled','refunded')
    `);

    for (const order of orders) {
      let nextStatus = null;
      const diffInMinutes = order.diff_minutes;

      // 🔥 1. HANDLE DUMMY ASSIGNMENT (Timeout after 2 mins if no partner)
      if (order.status === "pending" && !order.delivery_partner_id && diffInMinutes >= 2) {
        console.log(`🤖 Auto-assigning Dummy Partner to Order #${order.order_id}`);
        
        // Assign dummy partner details to order
        await Database.query(`
          UPDATE orders 
          SET delivery_partner_id = 1, 
              delivery_partner_name = 'Dummy Express Agent', 
              delivery_partner_phone = '7017592590'
          WHERE order_id = ?
        `, [order.order_id]);
        
        nextStatus = "confirmed";
      } 
      // 🔥 2. REGULAR FLOW (If partner is assigned or it's past pending)
      else if (order.delivery_partner_id || order.status !== "pending") {
        if (diffInMinutes > 1 && order.status === "pending") nextStatus = "confirmed";
        else if (diffInMinutes > 2 && order.status === "confirmed") nextStatus = "preparing";
        else if (diffInMinutes > 4 && order.status === "preparing") nextStatus = "ready";
        else if (diffInMinutes > 6 && order.status === "ready") nextStatus = "out_for_delivery";
        else if (diffInMinutes > 10 && order.status === "out_for_delivery") nextStatus = "delivered";
      }

      if (nextStatus) {
        await OrderTrackingService.updateOrderStatusWithTracking(
          order.order_id,
          nextStatus,
          {
            changeType: "system",
            reason: order.delivery_partner_id ? "Auto update via cron" : "Auto-assigned dummy partner after timeout"
          }
        );

        console.log(`✅ Order ${order.order_id} → ${nextStatus}`);
      }

      // 🔥 fake live tracking
      if (order.status === "out_for_delivery" && (order.delivery_partner_id || order.delivery_partner_name)) {
        await OrderTrackingService.updateDeliveryLocation(
          order.order_id,
          order.delivery_partner_id || 1,
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
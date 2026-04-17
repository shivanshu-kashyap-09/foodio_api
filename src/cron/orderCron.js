const cron = require("node-cron");
const Database = require("../utils/Database");
const OrderTrackingService = require("../services/OrderTrackingService");
const OrderService = require("../services/OrderService");

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
        
        await Database.query(`
          UPDATE orders 
          SET delivery_partner_id = 1, 
              delivery_partner_name = 'Dummy Express Agent', 
              delivery_partner_phone = '7017592590'
          WHERE order_id = ?
        `, [order.order_id]);
        
        nextStatus = "confirmed";
      } else if (order.status === "confirmed" && diffInMinutes > 5) {
        console.log(`⌛ Cancelling order #${order.order_id} due to no restaurant activity`);
        await OrderService.cancelOrder(order.order_id, 'system', null, 'No restaurant action within 5 minutes');
      } else if (order.status === "preparing" && diffInMinutes > 10) {
        console.log(`⌛ Cancelling order #${order.order_id} due to prolonged preparation inactivity`);
        await OrderService.cancelOrder(order.order_id, 'system', null, 'No preparation progress within 10 minutes');
      } else if (order.status === "ready" && diffInMinutes > 5) {
        console.log(`⌛ Cancelling order #${order.order_id} due to no pickup from delivery partner`);
        await OrderService.cancelOrder(order.order_id, 'system', null, 'No pickup after readiness within 5 minutes');
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
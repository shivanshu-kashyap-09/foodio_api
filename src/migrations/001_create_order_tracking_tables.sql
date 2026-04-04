-- Order Tracking Tables Migration
-- Created for production-level order tracking system

-- 1. Enhance orders table with tracking fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
    estimated_delivery_time DATETIME,
    actual_delivery_time DATETIME,
    delivery_partner_id INT,
    delivery_partner_name VARCHAR(100),
    delivery_partner_phone VARCHAR(15),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    delivery_distance_km DECIMAL(8, 2),
    delivery_completed_at DATETIME,
    cancellation_reason VARCHAR(255),
    refund_amount DECIMAL(10, 2),
    refund_status ENUM('pending', 'processed', 'failed') DEFAULT 'pending';

-- 2. Order Status History Table
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    previous_status VARCHAR(50),
    current_status VARCHAR(50) NOT NULL,
    changed_by INT,
    changed_by_type ENUM('user', 'admin', 'system', 'delivery_partner') DEFAULT 'system',
    reason VARCHAR(255),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- 3. Order Timeline Events Table (for detailed tracking)
CREATE TABLE IF NOT EXISTS order_timeline_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT,
    event_data JSON,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    created_by INT,
    created_by_type ENUM('user', 'admin', 'system', 'delivery_partner') DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- 4. Delivery Partner Tracking Table (Real-time location)
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    delivery_partner_id INT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(5, 2),
    speed INT,
    heading INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_delivery_partner_id (delivery_partner_id),
    INDEX idx_updated_at (updated_at)
);

-- 5. Order Notifications Table
CREATE TABLE IF NOT EXISTS order_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel ENUM('push', 'email', 'sms', 'in_app') DEFAULT 'push',
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_notification_type (notification_type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- 6. Order Metrics Table (for analytics)
CREATE TABLE IF NOT EXISTS order_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    total_time_minutes INT,
    preparation_time_minutes INT,
    delivery_time_minutes INT,
    distance_km DECIMAL(8, 2),
    rating INT,
    review TEXT,
    rating_created_at DATETIME,
    metrics_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_created_at (created_at)
);

-- 7. Webhooks Table (for third-party integrations)
CREATE TABLE IF NOT EXISTS order_webhooks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSON,
    response_status INT,
    response_body TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    is_delivered BOOLEAN DEFAULT FALSE,
    delivered_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_retry_at DATETIME,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_event_type (event_type),
    INDEX idx_is_delivered (is_delivered),
    INDEX idx_created_at (created_at)
);

-- 8. Create indexes for performance optimization
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_updated_at ON orders(updated_at);

-- Add tracking-related columns to orders table if they don't exist
ALTER TABLE orders MODIFY status ENUM('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending';

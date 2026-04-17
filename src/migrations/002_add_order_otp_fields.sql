-- Add order OTP and cancellation metadata fields for delivery handover and delivery verification

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS handover_otp VARCHAR(6) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS handover_otp_expires_at DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS handover_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS delivery_otp_expires_at DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS delivery_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) DEFAULT NULL;

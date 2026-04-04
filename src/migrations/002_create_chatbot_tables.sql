-- Foodio AI Chatbot Database Tables
-- Created for food recommendation chatbot powered by Groq AI

-- 1. Chatbot Messages Table
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    conversation_id VARCHAR(36),
    role ENUM('user', 'assistant', 'system') DEFAULT 'user',
    content LONGTEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at),
    INDEX idx_user_conversation (user_id, conversation_id)
);

-- 2. Chatbot Recommendations Table
CREATE TABLE IF NOT EXISTS chatbot_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preferences JSON,
    recommendations LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- 3. User Preferences Table (for personalization)
CREATE TABLE IF NOT EXISTS chatbot_user_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    favorite_cuisines JSON,
    dietary_restrictions JSON,
    budget_preference VARCHAR(50),
    spice_level INT DEFAULT 3,
    allergies JSON,
    preferences_data JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- 4. Chatbot Feedback Table
CREATE TABLE IF NOT EXISTS chatbot_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    message_id INT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at)
);

-- 5. Chatbot Analytics Table
CREATE TABLE IF NOT EXISTS chatbot_analytics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id VARCHAR(36),
    total_messages INT DEFAULT 0,
    conversation_duration_seconds INT DEFAULT 0,
    recommendations_given INT DEFAULT 0,
    orders_placed_after_chat INT DEFAULT 0,
    satisfaction_rating DECIMAL(3,2),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_started_at (started_at)
);

-- Create indexes for performance
CREATE INDEX idx_chatbot_messages_user_conv ON chatbot_messages(user_id, conversation_id, created_at);
CREATE INDEX idx_chatbot_messages_role ON chatbot_messages(role);

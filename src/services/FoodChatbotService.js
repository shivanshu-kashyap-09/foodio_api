/**
 * FOODIO API - Food Chatbot Service
 * AI-powered food recommendation chatbot using Groq AI
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const GroqClient = require('../utils/GroqConfig');

const logger = new Logger('FoodChatbotService');

class FoodChatbotService {
    // System prompt for food recommendations
    static SYSTEM_PROMPT = `You are a friendly and knowledgeable food recommendation assistant for Foodio, a food delivery platform.
Your role is to:
1. Understand user preferences (dietary restrictions, cuisine type, budget, mood, etc.)
2. Ask clarifying questions to better understand their needs
3. Recommend restaurants and dishes from available options
4. Consider factors like: cuisine type, health goals, budget, delivery time, ratings
5. Provide personalized suggestions based on conversation history
6. Maintain a friendly and conversational tone
7. Suggest dishes with brief descriptions

When recommending:
- Mention restaurant name and dish name
- Include approximate price
- Highlight key features (healthy, spicy, vegetarian, etc.)
- Suggest alternatives if available

Always respond in a conversational manner and never use JSON or technical language.`;

    /**
     * Send message and get AI recommendation
     * @param {number} userId - User ID
     * @param {string} message - User message
     * @param {Object} options - Additional options
     */
    static async sendMessage(userId = 2, message, options = {}) {
        try {
            if (!GroqClient.isInitialized()) {
                throw new Error('Groq AI is not initialized');
            }

            const { includeHistory = true, conversationId = null } = options;

            // Get conversation history
            let conversationHistory = [];
            if (includeHistory) {
                conversationHistory = await this.getConversationHistory(userId, conversationId);
            }

            // Build messages for Groq
            const messages = [
                ...conversationHistory,
                { role: 'user', content: message },
            ];

            logger.debug('Sending message to Groq', {
                userId,
                messageLength: message.length,
                historyLength: conversationHistory.length,
            });

            // Call Groq API
            const response = await GroqClient.getClient().chat.completions.create({
                messages: [
                    { role: 'system', content: this.SYSTEM_PROMPT },
                    ...messages,
                ],
                model: GroqClient.getCurrentModel(),
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                stop: null,
            });

            const aiResponse = response.choices[0]?.message?.content;

            if (!aiResponse) {
                throw new Error('No response from Groq API');
            }

            // Save conversation
            await this.saveMessage(userId, message, aiResponse, conversationId);

            logger.info('Message processed successfully', {
                userId,
                responseLength: aiResponse.length,
            });

            return {
                message: aiResponse,
                tokens: {
                    prompt: response.usage.prompt_tokens,
                    completion: response.usage.completion_tokens,
                    total: response.usage.total_tokens,
                },
            };
        } catch (error) {
            logger.error('sendMessage error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get personalized recommendations based on user preferences
     * @param {number} userId - User ID
     * @param {Object} preferences - User preferences
     */
    static async getRecommendations(userId, preferences = {}) {
        try {
            if (!GroqClient.isInitialized()) {
                throw new Error('Groq AI is not initialized');
            }

            const {
                cuisineType = 'any',
                budget = 'any',
                dietary = 'any',
                mood = 'any',
                deliveryTime = 'any',
            } = preferences;

            const preferenceText = `Based on these preferences:
- Cuisine: ${cuisineType}
- Budget: ${budget}
- Dietary: ${dietary}
- Mood/Occasion: ${mood}
- Delivery time: ${deliveryTime}

Provide 3-5 specific restaurant and dish recommendations for a food delivery platform.
For each recommendation:
1. Mention the restaurant type/name
2. Suggest a specific dish
3. Brief reason why it fits their preferences
Keep it conversational and friendly.`;

            const response = await GroqClient.getClient().chat.completions.create({
                messages: [
                    { role: 'system', content: this.SYSTEM_PROMPT },
                    { role: 'user', content: preferenceText },
                ],
                model: GroqClient.getCurrentModel(),
                temperature: 0.8,
                max_tokens: 1500,
                top_p: 1,
            });

            const recommendations = response.choices[0]?.message?.content;

            if (!recommendations) {
                throw new Error('No recommendations generated');
            }

            // Save recommendation request
            await this.saveRecommendationRequest(userId, preferences, recommendations);

            logger.info('Recommendations generated', { userId });

            return {
                recommendations,
                preferences,
            };
        } catch (error) {
            logger.error('getRecommendations error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Smart recommendation based on time of day
     * @param {number} userId - User ID
     */
    static async smartRecommendation(userId) {
        try {
            const hour = new Date().getHours();

            let mealType = 'snacks';
            if (hour >= 7 && hour < 11) {
                mealType = 'breakfast';
            } else if (hour >= 11 && hour < 14) {
                mealType = 'lunch';
            } else if (hour >= 14 && hour < 17) {
                mealType = 'snacks/beverages';
            } else if (hour >= 17 && hour < 21) {
                mealType = 'dinner';
            } else {
                mealType = 'late night snacks';
            }

            const message = `It's ${mealType} time! What kind of ${mealType} are you in the mood for? I can help you find something delicious!`;

            // Save as system message
            await this.saveMessage(userId, null, message, null, true);

            logger.info('Smart recommendation sent', { userId, mealType });

            return {
                message,
                mealType,
                timestamp: new Date(),
            };
        } catch (error) {
            logger.error('smartRecommendation error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get conversation history
     * @param {number} userId - User ID
     * @param {number} conversationId - Conversation ID (optional)
     */
    static async getConversationHistory(userId, conversationId = null, limit = 10) {
        try {
            let query = `
                SELECT role, content, created_at
                FROM chatbot_messages
                WHERE user_id = ?
            `;

            const params = [userId];

            if (conversationId) {
                query += ` AND conversation_id = ?`;
                params.push(conversationId);
            }

            query += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const messages = await Database.query(query, params);

            // Reverse to get chronological order
            return messages.reverse().map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
        } catch (error) {
            logger.error('getConversationHistory error', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Save message to database
     * @private
     */
    static async saveMessage(userId, userMessage, aiMessage, conversationId = null, isSystem = false) {
        try {
            const insertQuery = `
                INSERT INTO chatbot_messages (
                    user_id, conversation_id, role, content, is_system, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `;

            // Save user message if provided
            if (userMessage && !isSystem) {
                await Database.query(insertQuery, [
                    userId,
                    conversationId,
                    'user',
                    userMessage,
                    false,
                ]);
            }

            // Save AI response
            await Database.query(insertQuery, [
                userId,
                conversationId,
                isSystem ? 'system' : 'assistant',
                aiMessage,
                isSystem,
            ]);

            logger.debug('Message saved', { userId });
        } catch (error) {
            logger.error('saveMessage error', { error: error.message });
            // Don't throw - continue even if save fails
        }
    }

    /**
     * Save recommendation request
     * @private
     */
    static async saveRecommendationRequest(userId, preferences, recommendations) {
        try {
            const query = `
                INSERT INTO chatbot_recommendations (
                    user_id, preferences, recommendations, created_at
                ) VALUES (?, ?, ?, NOW())
            `;

            await Database.query(query, [
                userId,
                JSON.stringify(preferences),
                recommendations,
            ]);

            logger.debug('Recommendation saved', { userId });
        } catch (error) {
            logger.error('saveRecommendationRequest error', { error: error.message });
        }
    }

    /**
     * Get full conversation
     * @param {number} conversationId - Conversation ID
     */
    static async getFullConversation(conversationId) {
        try {
            const query = `
                SELECT id, user_id, role, content, is_system, created_at
                FROM chatbot_messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
            `;

            return await Database.query(query, [conversationId]);
        } catch (error) {
            logger.error('getFullConversation error', { conversationId, error: error.message });
            throw error;
        }
    }

    /**
     * Get user conversation list
     * @param {number} userId - User ID
     */
    static async getUserConversations(userId, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;

            const query = `
                SELECT
                    conversation_id,
                    MIN(created_at) as started_at,
                    MAX(created_at) as last_message_at,
                    COUNT(*) as message_count
                FROM chatbot_messages
                WHERE user_id = ?
                GROUP BY conversation_id
                ORDER BY last_message_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT DISTINCT conversation_id
                FROM chatbot_messages
                WHERE user_id = ?
            `;

            const [conversations, countResult] = await Promise.all([
                Database.query(query, [userId, limit, offset]),
                Database.query(countQuery, [userId]),
            ]);

            const total = countResult.length;

            return {
                conversations,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getUserConversations error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Clear conversation
     * @param {number} conversationId - Conversation ID
     */
    static async clearConversation(conversationId) {
        try {
            const query = `
                DELETE FROM chatbot_messages
                WHERE conversation_id = ?
            `;

            await Database.query(query, [conversationId]);
            logger.info('Conversation cleared', { conversationId });

            return { success: true };
        } catch (error) {
            logger.error('clearConversation error', { conversationId, error: error.message });
            throw error;
        }
    }

    /**
     * Get user statistics
     * @param {number} userId - User ID
     */
    static async getUserStats(userId) {
        try {
            const query = `
                SELECT
                    COUNT(DISTINCT conversation_id) as total_conversations,
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
                    COUNT(CASE WHEN role = 'assistant' THEN 1 END) as ai_responses,
                    MAX(created_at) as last_message_at
                FROM chatbot_messages
                WHERE user_id = ?
            `;

            return await Database.queryOne(query, [userId]);
        } catch (error) {
            logger.error('getUserStats error', { userId, error: error.message });
            throw error;
        }
    }
}

module.exports = FoodChatbotService;

/**
 * @file chatbotRoute.js
 * @description Food recommendation chatbot routes powered by Groq AI
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { authenticateToken } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const FoodChatbotService = require('../../services/FoodChatbotService');
const Logger = require('../../utils/Logger');

const logger = new Logger('ChatbotRoute');

/**
 * POST /api/chatbot/message
 * @description Send a message to the food recommendation chatbot
 * @access Private
 */
router.post('/message', asyncHandler(async (req, res) => {
    const { message, conversationId } = req.body;
    const userId = 2;

    // Validate input
    const errors = [];
    if (!message || !Validator.sanitizeString(message)) {
        errors.push('Message is required');
    }
    if (message && message.length > 2000) {
        errors.push('Message too long (max 2000 characters)');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const response = await FoodChatbotService.sendMessage(
            userId || 2,
            message,
            { conversationId: conversationId || uuidv4() }
        );

        logger.info('Chatbot message processed', {
            userId,
            messageLength: message.length,
            tokens: response.tokens.total,
        });

        return ResponseFormatter.success(res, 200, 'Message processed', {
            conversationId: conversationId || uuidv4(),
            response: response.message,
            tokens: response.tokens,
        });
    } catch (error) {
        if (error.message.includes('not initialized')) {
            logger.warn('Groq AI not initialized', { userId });
            return ResponseFormatter.error(
                res,
                503,
                'Chatbot service unavailable',
                ['Groq AI is not configured. Please check GROQ_API_KEY environment variable.']
            );
        }
        logger.error('Error processing chatbot message', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/chatbot/conversation/:conversationId
 * @description Get full conversation history
 * @access Private
 */
router.get('/conversation/:conversationId', authenticateToken, asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId) {
        return ResponseFormatter.error(res, 400, 'Conversation ID required');
    }

    try {
        const messages = await FoodChatbotService.getFullConversation(conversationId);

        logger.info('Conversation retrieved', { conversationId, userId });
        return ResponseFormatter.success(res, 200, 'Conversation retrieved', { messages });
    } catch (error) {
        logger.error('Error retrieving conversation', { conversationId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/chatbot/conversations
 * @description Get user's conversation list
 * @access Private
 */
router.get('/conversations', authenticateToken, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', paginationErrors);
    }

    try {
        const result = await FoodChatbotService.getUserConversations(
            userId,
            parseInt(page),
            parseInt(limit)
        );

        logger.info('User conversations retrieved', { userId, count: result.conversations.length });
        return ResponseFormatter.paginated(
            res,
            200,
            'Conversations retrieved',
            result.conversations,
            result.total,
            page,
            limit
        );
    } catch (error) {
        logger.error('Error retrieving conversations', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/chatbot/recommendations
 * @description Get personalized food recommendations
 * @access Private
 */
router.get('/recommendations', authenticateToken, asyncHandler(async (req, res) => {
    const {
        cuisineType = 'any',
        budget = 'any',
        dietary = 'any',
        mood = 'any',
        deliveryTime = 'any',
    } = req.query;

    const userId = req.user.id;

    try {
        const result = await FoodChatbotService.getRecommendations(userId, {
            cuisineType,
            budget,
            dietary,
            mood,
            deliveryTime,
        });

        logger.info('Recommendations generated', {
            userId,
            preferences: { cuisineType, budget, dietary, mood, deliveryTime },
        });

        return ResponseFormatter.success(res, 200, 'Recommendations generated', result);
    } catch (error) {
        logger.error('Error generating recommendations', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/chatbot/smart-recommendation
 * @description Get smart recommendation based on time of day
 * @access Private
 */
router.get('/smart-recommendation', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await FoodChatbotService.smartRecommendation(userId);

        logger.info('Smart recommendation generated', { userId, mealType: result.mealType });
        return ResponseFormatter.success(res, 200, 'Smart recommendation', result);
    } catch (error) {
        logger.error('Error generating smart recommendation', { userId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/chatbot/conversation/:conversationId
 * @description Clear conversation history
 * @access Private
 */
router.delete('/conversation/:conversationId', authenticateToken, asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId) {
        return ResponseFormatter.error(res, 400, 'Conversation ID required');
    }

    try {
        await FoodChatbotService.clearConversation(conversationId);

        logger.info('Conversation cleared', { conversationId, userId });
        return ResponseFormatter.success(res, 200, 'Conversation cleared');
    } catch (error) {
        logger.error('Error clearing conversation', { conversationId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/chatbot/stats
 * @description Get user chatbot statistics
 * @access Private
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        const stats = await FoodChatbotService.getUserStats(userId);

        logger.info('User stats retrieved', { userId });
        return ResponseFormatter.success(res, 200, 'User statistics', stats);
    } catch (error) {
        logger.error('Error retrieving stats', { userId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/chatbot/feedback
 * @description Submit feedback for chatbot response (for future improvements)
 * @access Private
 */
router.post('/feedback', authenticateToken, asyncHandler(async (req, res) => {
    const { messageId, rating, feedbackText, feedbackType } = req.body;
    const userId = req.user.id;

    const errors = [];
    if (!rating || rating < 1 || rating > 5) {
        errors.push('Rating must be between 1 and 5');
    }
    if (feedbackText && feedbackText.length > 500) {
        errors.push('Feedback text too long (max 500 characters)');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const query = `
            INSERT INTO chatbot_feedback (
                user_id, message_id, rating, feedback_text, feedback_type, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        `;

        const Database = require('../../utils/Database');
        await Database.query(query, [userId, messageId || null, rating, feedbackText || null, feedbackType || null]);

        logger.info('Feedback submitted', { userId, rating });
        return ResponseFormatter.success(res, 201, 'Feedback submitted successfully');
    } catch (error) {
        logger.error('Error submitting feedback', { userId, error: error.message });
        throw error;
    }
}));

module.exports = router;

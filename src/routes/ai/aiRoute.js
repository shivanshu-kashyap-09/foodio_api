const express = require('express');
const route = express.Router();
const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const aiService = require('../../services/AIService');
const Logger = require('../../utils/Logger');

const logger = new Logger('AIRoute');

/**
 * GET /api/ai/recommend
 * Get dish recommendations for the user
 */
route.get('/recommend', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const recommendations = await aiService.getRecommendations(userId);
        return res.status(200).json({
            success: true,
            data: recommendations,
            message: 'Recommendations fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch recommendations', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch recommendations'
        });
    }
});

/**
 * POST /api/ai/smart-search
 * Smart search for dishes/restaurants
 */
route.post('/smart-search', async (req, res) => {
    try {
        const { query } = req.body;
        const results = await aiService.smartSearch(query);
        return res.status(200).json({
            success: true,
            data: results,
            message: 'Search completed successfully'
        });
    } catch (error) {
        logger.error('Smart search failed', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Smart search failed'
        });
    }
});

/**
 * POST /api/ai/chatbot
 * Input: user query
 * Output: response from chatbot
 */
route.post('/chatbot', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { query } = req.body;
        const response = await aiService.chat(userId, query);
        return res.status(200).json({
            success: true,
            data: response,
            message: 'Chat completed'
        });
    } catch (error) {
        logger.error('Chatbot request failed', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Chatbot service unavailable'
        });
    }
});

/**
 * GET /api/ai/insights/:resId
 * Get AI insights for a restaurant
 */
route.get('/insights', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const insights = await aiService.getRestaurantInsights(userId);
        return res.status(200).json({
            success: true,
            data: insights,
            message: 'Insights fetched successfully'
        });
    } catch (error) {
        logger.error('Insights fetch failed', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Insights fetch failed'
        });
    }
});

module.exports = route;

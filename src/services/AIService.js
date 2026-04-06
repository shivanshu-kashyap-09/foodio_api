const axios = require('axios');
const Database = require('../utils/Database');
const Logger = require('../utils/Logger');

const logger = new Logger('AIService');

class AIService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async callGroq(prompt, systemPrompt = "You are a helpful food delivery assistant for Foodio.") {
        try {
            const response = await axios.post(this.apiUrl, {
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            logger.error('Groq API call failed', { error: error.response ? error.response.data : error.message });
            throw error;
        }
    }

    async getRecommendations(userId) {
        try {
            const pastOrders = await Database.query(
                "SELECT items FROM orders WHERE user_id = ? LIMIT 5", 
                [userId]
            );
            
            const prompt = `Based on these past orders: ${JSON.stringify(pastOrders)}. Recommend 5 popular Indian dishes. Return only a JSON array of objects with 'name' and 'reason' fields.`;
            const result = await this.callGroq(prompt, "You are an expert food recommender. Return ONLY valid JSON.");
            
            // Extract JSON from response (Groq might return markdown)
            const jsonMatch = result.match(/\[.*\]/s);
            const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

            // Enrich with dummy images for UI excellence
            return recommendations.map(r => ({
                ...r,
                img: `https://loremflickr.com/320/240/food,${r.name.replace(/ /g, ',')}`,
                match: Math.floor(85 + Math.random() * 14)
            }));
        } catch (error) {
            logger.error('Failed to get recommendations', { error: error.message });
            return [];
        }
    }

    async smartSearch(query) {
        try {
            const prompt = `The user is searching for: "${query}". Identify the key food categories or dishes they might be interested in. Return a comma-separated list of keywords.`;
            const keywordsRaw = await this.callGroq(prompt, "Return ONLY keywords.");
            const keywords = keywordsRaw.split(',').map(k => k.trim());

            // Simple search based on first keyword for now
            const searchPattern = `%${keywords[0]}%`;
            const veg = await Database.query("SELECT *, 'veg' as type FROM vegmenu WHERE dish_name LIKE ?", [searchPattern]);
            const nonveg = await Database.query("SELECT *, 'nonveg' as type FROM nonvegmenu WHERE dish_name LIKE ?", [searchPattern]);

            return [...veg, ...nonveg].slice(0, 5);
        } catch (error) {
            logger.error('Smart search failed', { error: error.message });
            return [];
        }
    }

    async chat(userId, query) {
        try {
            const systemPrompt = "You are Foodio AI, a friendly assistant for a food delivery platform. Help users find dishes, track orders, and provide general info. Be concise.";
            const response = await this.callGroq(query, systemPrompt);
            return { response };
        } catch (error) {
            logger.error('Chat failed', { error: error.message });
            return { response: "I'm currently updating my taste buds. Ask me again in a moment!" };
        }
    }

    async getSentiment(text) {
        try {
            const prompt = `Analyze the sentiment of this review: "${text}". Reply with only one word: positive, negative, or neutral.`;
            const sentiment = await this.callGroq(prompt, "Respond with only one word.");
            return sentiment.toLowerCase().trim();
        } catch (error) {
            return 'neutral';
        }
    }

    async getRestaurantInsights(resId) {
        try {
            const orders = await Database.query(
                "SELECT dish_name, total FROM orderdishes od JOIN orders o ON od.order_id = o.order_id WHERE o.restaurant_id = ? LIMIT 20",
                [resId]
            );
            const prompt = `Analyze these orders for restaurant #${resId}: ${JSON.stringify(orders)}. Provide 3 bullet points on top performance, low performance, and price optimization.`;
            const insights = await this.callGroq(prompt, "You are a business consultant for restaurants.");
            return { insights };
        } catch (error) {
            return { insights: "Not enough data for insights yet." };
        }
    }
}

module.exports = new AIService();

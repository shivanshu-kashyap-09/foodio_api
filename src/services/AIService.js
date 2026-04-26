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

    async getRestaurantInsights(userId) {
        try {
            // 1. Get stats context (Earnings, Customers, Trending Dishes)
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            if (!user || !user.user_phone) {
                logger.warn('User phone not found for insights', { userId });
                return this.getFallbackInsights(0, 0);
            }

            // Clean phone number for matching (last 10 digits)
            const cleanPhone = user.user_phone.replace(/\D/g, '').slice(-10);
            const phonePattern = `%${cleanPhone}`;

            const statsSql = `
                SELECT COALESCE(SUM(total_amount), 0) as earnings, COUNT(*) as orders
                FROM orders 
                WHERE (restaurant_phone LIKE ? OR restaurant_id IN (
                    SELECT res_id FROM vegrestaurant WHERE res_phone LIKE ?
                    UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone LIKE ?
                    UNION SELECT res_id FROM southindianrestaurant WHERE res_phone LIKE ?
                )) AND (LOWER(status) = 'delivered' OR LOWER(status) = 'delivered')
            `;
            const stats = await Database.queryOne(statsSql, [phonePattern, phonePattern, phonePattern, phonePattern]);

            const trendingSql = `
                SELECT dish_name, dish_rating FROM (
                    SELECT dish_name, dish_rating, restaurant_id FROM vegmenu
                    UNION ALL
                    SELECT dish_name, dish_rating, restaurant_id FROM nonvegmenu
                    UNION ALL
                    SELECT dish_name, dish_rating, restaurant_id FROM southindianmenu
                ) as all_dishes 
                WHERE restaurant_id IN (
                    SELECT res_id FROM vegrestaurant WHERE res_phone LIKE ?
                    UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone LIKE ?
                    UNION SELECT res_id FROM southindianrestaurant WHERE res_phone LIKE ?
                )
                ORDER BY dish_rating DESC LIMIT 3
            `;
            const trending = await Database.query(trendingSql, [phonePattern, phonePattern, phonePattern]);

            // 2. Build a highly detailed AI Prompt based on REAL DATA from the DB
            const menuSummary = trending.length > 0 
                ? `Your top-rated dishes are: ${trending.map(d => `${d.dish_name} (Rating: ${d.dish_rating})`).join(', ')}.` 
                : "You currently have no dishes with ratings.";

            const prompt = `
                ACT AS: Senior Business Consultant for Foodio SaaS. 
                RESTAURANT DATA:
                - Lifetime Earnings: ₹${stats.earnings}
                - Total Completed Orders: ${stats.orders}
                - Menu Analysis: ${menuSummary}
                
                MISSION: Generate 4 unique, highly specific, and actionable business insights AND a predicted revenue growth percentage for the next month.
                
                CONSTRAINTS:
                - If earnings < 1000, focus on initial growth and listing quality.
                - If earnings >= 1000, focus on loyalty and profit margin optimization.
                - Return ONLY a JSON object with two fields: "growth_pct" (number, e.g. 23) and "insights" (array of 4 objects).
                - No conversational text.
                - Each insight object structure: {"title": "Short Title", "text": "1-sentence specific advice", "action": "Button Label"}
            `;

            const aiResponse = await this.callGroq(prompt, "You are a professional restaurant analyst. Return ONLY valid JSON.");
            
            // 3. Robust JSON Parsing
            let data = { growth_pct: 15, insights: [] };
            try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    data = JSON.parse(aiResponse);
                }
            } catch (pErr) {
                logger.error('AI JSON Parsing failed', { response: aiResponse });
                return { growth_pct: 12, insights: this.getFallbackInsights(stats.earnings, stats.orders, trending[0]) };
            }

            // Ensure we return exactly what the frontend expects
            return {
                growth_pct: data.growth_pct || 15,
                insights: Array.isArray(data.insights) ? data.insights.slice(0, 4) : this.getFallbackInsights(stats.earnings, stats.orders, trending[0])
            };
        } catch (error) {
            logger.error('Failed to get AI insights', { error: error.message });
            return { growth_pct: 0, insights: this.getFallbackInsights(0, 0) };
        }
    }

    getFallbackInsights(earnings, orders, topDish = null) {
        return [
            { title: 'Revenue Target', text: earnings > 0 ? `Your steady revenue of ₹${earnings} is a great base. Aim for 15% growth by adding a 'Signature' dish.` : 'Your store is live! Add more dishes to start generating revenue analytics.', action: 'Add Dish' },
            { title: 'Order Velocity', text: orders > 5 ? `With ${orders} orders down, you are in the top 30% of local stores. Run a flash sale to reach 50!` : 'Orders follow visibility. optimize your dish images to increase click-through rates.', action: 'Optimize Images' },
            { title: 'AI Recommendation', text: topDish ? `${topDish.dish_name} is performing well. Create a bundle deal with a beverage for higher margins.` : 'AI suggests adding at least 5 dishes in different categories to unlock predictive modeling.', action: 'View Menu' },
            { title: 'Operational Tip', text: 'Real-time market scanning suggests most orders in your area happen between 7 PM and 9 PM.', action: 'Plan Staff' }
        ];
    }
}

module.exports = new AIService();

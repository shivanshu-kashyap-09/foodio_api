/**
 * FOODIO API - Groq AI Configuration
 * Groq AI client setup for food recommendation chatbot
 */

const Groq = require('groq-sdk');
const Logger = require('./Logger');

const logger = new Logger('GroqConfig');

class GroqClient {
    constructor() {
        this.client = null;
        this.model = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';
        this.apiKey = process.env.GROQ_API_KEY;
        this.initialized = false;

        if (!this.apiKey) {
            logger.warn('Groq API key not found. Chatbot will not work.');
            return;
        }

        this.initialize();
    }

    /**
     * Initialize Groq client
     */
    initialize() {
        try {
            this.client = new Groq({
                apiKey: this.apiKey,
            });

            this.initialized = true;
            logger.info('Groq AI client initialized successfully', {
                model: this.model,
            });
        } catch (error) {
            logger.error('Failed to initialize Groq client', {
                error: error.message,
            });
            this.initialized = false;
        }
    }

    /**
     * Check if client is initialized
     */
    isInitialized() {
        return this.initialized && this.client !== null;
    }

    /**
     * Get the client instance
     */
    getClient() {
        if (!this.isInitialized()) {
            throw new Error('Groq AI client not initialized. Check GROQ_API_KEY in environment variables.');
        }
        return this.client;
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return {
            'mixtral-8x7b-32768': 'Fast, multi-lingual model',
            'llama2-70b-4096': 'Larger, more capable model',
        };
    }

    /**
     * Get current model
     */
    getCurrentModel() {
        return this.model;
    }
}

module.exports = new GroqClient();

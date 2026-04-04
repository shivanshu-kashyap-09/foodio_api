const config = require('./config');

module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'FOODIO API',
    description: 'FOODIO API Swagger documentation for the food delivery platform.',
    version: config.app.version,
    contact: {
      name: 'FOODIO API Team',
      email: 'support@foodio.example',
    },
  },
  servers: [
    {
      url: config.app.url || 'http://localhost:3000',
      description: 'Primary server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
        },
      },
      UserCredentials: {
        type: 'object',
        properties: {
          user: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
        required: ['email', 'password'],
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Shivanshu' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', example: 'user' },
        },
      },
      Restaurant: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Veg Delight' },
          cuisine: { type: 'string', example: 'South Indian' },
          address: { type: 'string', example: '123 Food St.' },
          rating: { type: 'number', example: 4.7 },
        },
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          name: { type: 'string', example: 'Paneer Butter Masala' },
          price: { type: 'number', example: 250 },
          rating: { type: 'number', example: 4.9 },
          category: { type: 'string', example: 'veg' },
          image: { type: 'string', example: 'https://example.com/dish.jpg' },
        },
      },
      Thali: {
        type: 'object',
        properties: {
          thali_id: { type: 'integer', example: 1 },
          thali_name: { type: 'string', example: 'Deluxe Thali' },
          price: { type: 'number', example: 299 },
          description: { type: 'string', example: 'Complete meal with rice and curries' },
        },
      },
      ContactRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', format: 'email' },
          subject: { type: 'string', example: 'Order issue' },
          message: { type: 'string', example: 'I need help with my order.' },
        },
        required: ['name', 'email', 'subject', 'message'],
      },
      // Order Tracking Schemas
      OrderTracking: {
        type: 'object',
        properties: {
          order: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 123 },
              status: { type: 'string', example: 'out_for_delivery', enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] },
              totalAmount: { type: 'number', example: 599 },
              itemCount: { type: 'integer', example: 3 },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          restaurant: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 5 },
              name: { type: 'string', example: 'Pizza Palace' },
              phone: { type: 'string', example: '9876543210' },
              address: { type: 'string', example: '123 Food Street' },
            },
          },
          delivery: {
            type: 'object',
            properties: {
              partnerName: { type: 'string', example: 'Raj Kumar' },
              partnerPhone: { type: 'string', example: '9988776655' },
              estimatedDeliveryTime: { type: 'string', format: 'date-time' },
              actualDeliveryTime: { type: 'string', format: 'date-time' },
              distance: { type: 'number', example: 2.5 },
              currentLocation: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', example: 28.6139 },
                  longitude: { type: 'number', example: 77.2090 },
                },
              },
            },
          },
        },
      },
      OrderStatusHistory: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          previous_status: { type: 'string', example: 'pending' },
          current_status: { type: 'string', example: 'confirmed' },
          changed_by_type: { type: 'string', example: 'admin' },
          reason: { type: 'string', example: 'Manual confirmation' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      // Chatbot Schemas
      ChatMessage: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'I want pizza for dinner', minLength: 1, maxLength: 2000 },
          conversationId: { type: 'string', example: 'uuid-123', description: 'Optional: continue existing conversation' },
        },
        required: ['message'],
      },
      ChatResponse: {
        type: 'object',
        properties: {
          conversationId: { type: 'string', example: 'uuid-123' },
          response: { type: 'string', example: 'Great! I can help you find delicious pizza...' },
          tokens: {
            type: 'object',
            properties: {
              prompt: { type: 'integer', example: 156 },
              completion: { type: 'integer', example: 45 },
              total: { type: 'integer', example: 201 },
            },
          },
        },
      },
      ChatFeedback: {
        type: 'object',
        properties: {
          messageId: { type: 'integer', example: 123, description: 'Optional message reference' },
          rating: { type: 'integer', example: 5, minimum: 1, maximum: 5 },
          feedbackText: { type: 'string', example: 'Great recommendation!', maxLength: 500 },
          feedbackType: { type: 'string', example: 'recommendation' },
        },
        required: ['rating'],
      },
      ChatRecommendations: {
        type: 'object',
        properties: {
          recommendations: { type: 'string', example: 'Based on your preferences for Indian vegetarian food...' },
          preferences: {
            type: 'object',
            properties: {
              cuisineType: { type: 'string', example: 'indian' },
              budget: { type: 'string', example: 'moderate' },
              dietary: { type: 'string', example: 'vegetarian' },
              mood: { type: 'string', example: 'casual' },
            },
          },
        },
      },
      ChatConversation: {
        type: 'object',
        properties: {
          conversation_id: { type: 'string', example: 'uuid-123' },
          started_at: { type: 'string', format: 'date-time' },
          last_message_at: { type: 'string', format: 'date-time' },
          message_count: { type: 'integer', example: 5 },
        },
      },
      ChatStats: {
        type: 'object',
        properties: {
          total_conversations: { type: 'integer', example: 5 },
          total_messages: { type: 'integer', example: 45 },
          user_messages: { type: 'integer', example: 23 },
          ai_responses: { type: 'integer', example: 22 },
          last_message_at: { type: 'string', format: 'date-time' },
        },
      },
      // Search & Filter Schemas
      DishSearchResult: {
        type: 'object',
        properties: {
          dish_id: { type: 'integer', example: 1 },
          dish_name: { type: 'string', example: 'Paneer Tikka' },
          dish_price: { type: 'string', example: '299' },
          dish_rating: { type: 'number', format: 'decimal', example: 4.5 },
          dish_description: { type: 'string', example: 'Marinated cottage cheese cubes...' },
          dish_image: { type: 'string', example: 'https://example.com/image.jpg' },
          restaurant_id: { type: 'integer', example: 5 },
          cuisine_type: { type: 'string', enum: ['veg', 'nonveg', 'southindian'], example: 'veg' },
        },
      },
      SearchFilters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search term (optional)', example: 'biryani' },
          cuisineTypes: { type: 'string', description: 'Comma-separated cuisine types', example: 'veg,nonveg' },
          minPrice: { type: 'number', description: 'Minimum price', example: 100 },
          maxPrice: { type: 'number', description: 'Maximum price', example: 500 },
          minRating: { type: 'number', description: 'Minimum rating (0-5)', example: 3.5 },
          restaurantId: { type: 'integer', description: 'Restaurant ID', example: 5 },
          page: { type: 'integer', description: 'Page number', example: 1 },
          limit: { type: 'integer', description: 'Items per page (max 100)', example: 20 },
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Search completed' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/DishSearchResult' },
          },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 45 },
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              pages: { type: 'integer', example: 3 },
              hasNext: { type: 'boolean', example: true },
              hasPrev: { type: 'boolean', example: false },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/user/login': {
      post: {
        tags: ['User'],
        summary: 'Log in a registered user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserCredentials' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJI...' },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/user/signup': {
      post: {
        tags: ['User'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Shivanshu' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created successfully' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/user/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get current user cart',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Cart retrieved successfully' },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/user/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Fetch user order history',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Order list returned successfully' },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create a new order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cartId: { type: 'integer', example: 1 },
                  paymentMethod: { type: 'string', example: 'online' },
                },
                required: ['cartId', 'paymentMethod'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Order created successfully' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Submit a contact request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Contact request submitted' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    // ============ ORDER TRACKING ENDPOINTS ============
    '/api/orders/{orderId}/tracking': {
      get: {
        tags: ['Order Tracking'],
        summary: 'Get real-time order tracking status',
        description: 'Retrieve comprehensive real-time tracking information for an order including status, location, and delivery estimates',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Order ID to track',
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Order tracking data retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderTracking' },
              },
            },
          },
          '404': { description: 'Order not found' },
          '403': { description: 'Unauthorized access' },
        },
      },
    },
    '/api/orders/{orderId}/tracking/history': {
      get: {
        tags: ['Order Tracking'],
        summary: 'Get order status history',
        description: 'Retrieve all status transitions for an order with metadata',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Status history retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/OrderStatusHistory' },
                },
              },
            },
          },
        },
      },
    },
    '/api/orders/{orderId}/tracking/delivery': {
      get: {
        tags: ['Order Tracking'],
        summary: 'Get delivery tracking history',
        description: 'Retrieve real-time delivery partner location history with GPS coordinates',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Delivery tracking history retrieved' },
        },
      },
    },
    '/api/orders/{orderId}/tracking/status': {
      put: {
        tags: ['Order Tracking'],
        summary: 'Update order status with tracking',
        description: 'Update order status and automatically create status history record and notifications',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] },
                  reason: { type: 'string', example: 'Order ready for pickup' },
                },
                required: ['status'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order status updated successfully' },
          '400': { description: 'Invalid status transition' },
        },
      },
    },
    '/api/orders/{orderId}/tracking/delivery-location': {
      post: {
        tags: ['Order Tracking'],
        summary: 'Update delivery partner location',
        description: 'Send real-time GPS coordinates for delivery tracking',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', example: 28.6139 },
                  longitude: { type: 'number', example: 77.2090 },
                  accuracy: { type: 'number', example: 5 },
                  speed: { type: 'integer', example: 45 },
                  heading: { type: 'integer', example: 180 },
                },
                required: ['latitude', 'longitude'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Location updated successfully' },
        },
      },
    },
    '/api/orders/{orderId}/rating': {
      post: {
        tags: ['Order Tracking'],
        summary: 'Submit order rating and review',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                  review: { type: 'string', example: 'Great food and fast delivery!' },
                },
                required: ['rating'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Review submitted successfully' },
        },
      },
    },
    '/api/orders/{orderId}/notifications': {
      get: {
        tags: ['Order Tracking'],
        summary: 'Get order-related notifications',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Notifications retrieved successfully' },
        },
      },
    },
    '/api/admin/analytics/dashboard': {
      get: {
        tags: ['Order Analytics'],
        summary: 'Get analytics dashboard (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Dashboard analytics retrieved successfully' },
          '403': { description: 'Admin access required' },
        },
      },
    },
    // ============ CHATBOT ENDPOINTS ============
    '/api/chatbot/message': {
      post: {
        tags: ['Chatbot'],
        summary: 'Send message to AI chatbot',
        description: 'Send a message to the AI-powered food recommendation chatbot and get personalized responses',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatMessage' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Message processed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatResponse' },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '503': { description: 'Chatbot service unavailable' },
        },
      },
    },
    '/api/chatbot/recommendations': {
      get: {
        tags: ['Chatbot'],
        summary: 'Get personalized food recommendations',
        description: 'Get AI-powered personalized food recommendations based on preferences like cuisine, budget, dietary restrictions, and mood',
        parameters: [
          {
            name: 'cuisineType',
            in: 'query',
            schema: { type: 'string', default: 'any' },
            description: 'Type of cuisine (indian, chinese, italian, fast-food, etc.)',
          },
          {
            name: 'budget',
            in: 'query',
            schema: { type: 'string', default: 'any' },
            description: 'Budget level (budget, moderate, premium)',
          },
          {
            name: 'dietary',
            in: 'query',
            schema: { type: 'string', default: 'any' },
            description: 'Dietary preferences (vegetarian, vegan, no-gluten, halal, etc.)',
          },
          {
            name: 'mood',
            in: 'query',
            schema: { type: 'string', default: 'any' },
            description: 'Mood or occasion (romantic, casual, celebration, quick, healthy)',
          },
          {
            name: 'deliveryTime',
            in: 'query',
            schema: { type: 'string', default: 'any' },
            description: 'Desired delivery time (15min, 30min, 45min, any)',
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Recommendations generated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatRecommendations' },
              },
            },
          },
        },
      },
    },
    '/api/chatbot/smart-recommendation': {
      get: {
        tags: ['Chatbot'],
        summary: 'Get time-aware smart recommendation',
        description: 'Get intelligent food recommendation based on current time of day (breakfast, lunch, dinner, or snacks)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Smart recommendation generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    mealType: { type: 'string', enum: ['breakfast', 'lunch', 'snacks/beverages', 'dinner', 'late night snacks'] },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/chatbot/conversation/{conversationId}': {
      get: {
        tags: ['Chatbot'],
        summary: 'Get full conversation history',
        description: 'Retrieve complete conversation history between user and chatbot',
        parameters: [
          {
            name: 'conversationId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Conversation retrieved successfully' },
        },
      },
      delete: {
        tags: ['Chatbot'],
        summary: 'Clear conversation history',
        description: 'Delete all messages in a conversation',
        parameters: [
          {
            name: 'conversationId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Conversation cleared successfully' },
        },
      },
    },
    '/api/chatbot/conversations': {
      get: {
        tags: ['Chatbot'],
        summary: 'Get user conversation list',
        description: 'Retrieve all conversations for the current user with pagination',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Conversations retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ChatConversation' },
                },
              },
            },
          },
        },
      },
    },
    '/api/chatbot/feedback': {
      post: {
        tags: ['Chatbot'],
        summary: 'Submit chatbot feedback',
        description: 'Submit rating and feedback for chatbot responses to help improve recommendations',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatFeedback' },
            },
          },
        },
        responses: {
          '201': { description: 'Feedback submitted successfully' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/api/chatbot/stats': {
      get: {
        tags: ['Chatbot'],
        summary: 'Get user chatbot statistics',
        description: 'Retrieve user statistics including total conversations, messages, and usage patterns',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User statistics retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatStats' },
              },
            },
          },
        },
      },
    },
    '/api/restaurants/veg': {
      get: {
        tags: ['Restaurants'],
        summary: 'List vegetarian restaurants',
        responses: {
          '200': { description: 'Vegetarian restaurants listed successfully' },
        },
      },
    },
    '/api/restaurants/nonveg': {
      get: {
        tags: ['Restaurants'],
        summary: 'List non-vegetarian restaurants',
        responses: {
          '200': { description: 'Non-vegetarian restaurants listed successfully' },
        },
      },
    },
    '/api/menus/veg': {
      get: {
        tags: ['Menu'],
        summary: 'List vegetarian menu items',
        responses: {
          '200': { description: 'Vegetarian menu items listed successfully' },
        },
      },
    },
    '/api/menus/nonveg': {
      get: {
        tags: ['Menu'],
        summary: 'List non-vegetarian menu items',
        responses: {
          '200': { description: 'Non-vegetarian menu items listed successfully' },
        },
      },
    },
    '/api/thali': {
      get: {
        tags: ['Thali'],
        summary: 'List all thali meals',
        responses: {
          '200': { description: 'Thali items listed successfully' },
        },
      },
    },
    '/api/thali/dishes': {
      get: {
        tags: ['Thali'],
        summary: 'List all thali dishes',
        responses: {
          '200': { description: 'Thali dishes listed successfully' },
        },
      },
    },
    // ============ SEARCH & FILTER ENDPOINTS ============
    '/api/search': {
      get: {
        tags: ['Search & Filter'],
        summary: 'Global search across all menu types',
        description: 'Search for dishes across all menu types (veg, nonveg, southindian) with pagination',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2, maxLength: 100 },
            description: 'Search term (minimum 2 characters)',
            example: 'pizza',
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
            description: 'Page number for pagination',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            description: 'Number of items per page (max 100)',
          },
        ],
        responses: {
          '200': {
            description: 'Search completed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/search/filter': {
      get: {
        tags: ['Search & Filter'],
        summary: 'Advanced filter with optional search',
        description: 'Filter dishes by price, rating, cuisine type, restaurant, and optionally search term',
        parameters: [
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string', minLength: 2 },
            description: 'Search term (optional)',
          },
          {
            name: 'cuisineTypes',
            in: 'query',
            schema: { type: 'string', default: 'veg,nonveg,southindian' },
            description: 'Comma-separated cuisine types (veg, nonveg, southindian)',
            example: 'veg,nonveg',
          },
          {
            name: 'minPrice',
            in: 'query',
            schema: { type: 'number', minimum: 0 },
            description: 'Minimum price (optional)',
          },
          {
            name: 'maxPrice',
            in: 'query',
            schema: { type: 'number', minimum: 0 },
            description: 'Maximum price (optional)',
          },
          {
            name: 'minRating',
            in: 'query',
            schema: { type: 'number', minimum: 0, maximum: 5 },
            description: 'Minimum rating 0-5 (optional)',
          },
          {
            name: 'restaurantId',
            in: 'query',
            schema: { type: 'integer', minimum: 1 },
            description: 'Filter by restaurant ID (optional)',
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
            description: 'Page number',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            description: 'Items per page (max 100)',
          },
        ],
        responses: {
          '200': {
            description: 'Filter completed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/search/suggestions': {
      get: {
        tags: ['Search & Filter'],
        summary: 'Get search suggestions',
        description: 'Get autocomplete suggestions for search based on prefix',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2, maxLength: 100 },
            description: 'Search prefix (minimum 2 characters)',
            example: 'bi',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
            description: 'Number of suggestions (max 50)',
          },
        ],
        responses: {
          '200': {
            description: 'Suggestions retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Suggestions retrieved' },
                    data: {
                      type: 'object',
                      properties: {
                        suggestions: {
                          type: 'array',
                          items: { type: 'string' },
                          example: ['Biryani', 'Biriyani Rice', 'Biriyan Special'],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/search/trending': {
      get: {
        tags: ['Search & Filter'],
        summary: 'Get trending dishes',
        description: 'Get trending (highest rated) dishes across all menu types',
        parameters: [
          {
            name: 'cuisineTypes',
            in: 'query',
            schema: { type: 'string', default: 'veg,nonveg,southindian' },
            description: 'Comma-separated cuisine types',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
            description: 'Number of results (max 50)',
          },
        ],
        responses: {
          '200': {
            description: 'Trending dishes retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Trending dishes retrieved' },
                    data: {
                      type: 'object',
                      properties: {
                        dishes: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/DishSearchResult' },
                        },
                        count: { type: 'integer', example: 10 },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
};

# 🌟 Foodio API - Features Guide

This document provides a comprehensive guide to all the features implemented in the **Foodio API**, including the AI Chatbot, Order Tracking, and Advanced Search systems.

---

## 📖 Table of Contents
1. [AI Chatbot Guide](#ai-chatbot-guide)
2. [Order Tracking System](#order-tracking-system)
3. [Advanced Search & Filter](#advanced-search--filter)
4. [Authentication System](#authentication-system)
5. [Implementation Roadmap](#implementation-roadmap)

---

## 🤖 AI Chatbot Guide

The Foodio AI Chatbot is a production-ready system powered by **Groq AI** for intelligent, conversational food suggestions.

### Key Capabilities
- **Conversational AI**: Multi-turn chat with context and memory.
- **Smart Recommendations**: Personalized suggestions based on preferences (cuisine, budget, dietary, mood).
- **Time-Awareness**: Intelligent meal suggestions based on the current time (Breakfast/Lunch/Dinner).
- **User Preference Learning**: Remembers previous interactions to refine future recommendations.

### Core Endpoints
- `POST /api/chatbot/message`: Send a message and get a response.
- `GET /api/chatbot/recommendations`: Get personalized food suggestions.
- `GET /api/chatbot/smart-recommendation`: Get time-based suggestions.

---

## 📦 Order Tracking System

A real-time order tracking system with status updates, delivery partner GPS location, and multi-channel notifications.

### Features
- **Real-Time Updates**: Status updates sent instantly via WebSockets (`socket.io`).
- **GPS Location Tracking**: Real-time delivery partner location and movement.
- **Order Timeline**: Detailed event history for each order.
- **Multi-Channel Notifications**: Email, SMS, Push, and In-app alerts.

### Order Status Flow
`pending` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`
(An order can also be `cancelled` at any time).

### Tracking Endpoints
- `GET /api/orders/:orderId/tracking`: Get status, delivery, and restaurant details.
- `GET /api/orders/:orderId/tracking/history`: Get status transition records.
- `PUT /api/orders/:orderId/tracking/status`: Update order status (Admin/Restaurant).
- `POST /api/orders/:orderId/tracking/delivery-location`: Update GPS coordinates (Delivery Partner).

---

## 🔍 Advanced Search & Filter

A powerful global search system to discover dishes across all menu types (Vegetarian, Non-Vegetarian, South Indian).

### Search Capabilities
- **Global Search**: Search by name or description across all menus.
- **Advanced Filters**: Filter by price range, minimum rating, cuisine types, and restaurant ID.
- **Autocomplete Suggestions**: Instant feedback for search inputs.
- **Trending Dishes**: Most popular and highest-rated dishes.

### Endpoints
- `GET /api/search`: Global search.
- `GET /api/search/filter`: Advanced filtering.
- `GET /api/search/suggestions`: Search autocomplete.
- `GET /api/search/trending`: Top dishes.

---

## 🔑 Authentication System

A secure, production-ready authentication system with:
- **JWT Authentication**: Secure token-based access.
- **Bcrypt Hashing**: Secure password storage (10 salt rounds).
- **Rate Limiting**: Protection against brute-force attacks.
- **Email Verification**: Secure link-based email confirmation.
- **OTP Password Reset**: 6-digit OTP combined with secure reset tokens.

---

## 🗺️ Implementation Roadmap

### Completed ✅
- Core Auth System with security enhancements.
- AI Chatbot with Groq AI integration.
- Real-time Order Tracking with WebSockets.
- Global Search & Advanced Filtering.
- Comprehensive Swagger Documentation.

### Upcoming 🚀
- **SMS Integration**: Twilio setup for mobile alerts.
- **Push Notifications**: Firebase Cloud Messaging (FCM).
- **ML ETA Prediction**: Machine-learning based delivery time estimates.
- **Multi-Language Support**: Support for regional languages.

---
**Status**: FEATURE COMPLETE 🚀

# 🏢 Foodio API - Core Documentation

Welcome to the **Foodio API** core documentation. This document provides a high-level overview of the project, setup instructions, deployment guides, and codebase structure.

---

## 📖 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Setup and Installation](#setup-and-installation)
4. [Environment Configuration](#environment-configuration)
5. [Codebase Overview](#codebase-overview)
6. [Production Deployment](#production-deployment)
7. [Dependencies](#dependencies)

---

## 🚀 Project Overview

Foodio API is a robust, production-ready backend for a restaurant and food delivery platform. It features real-time order tracking, an AI-powered food chatbot, advanced search and filtering, and a secure authentication system.

---

## 🛠️ Technology Stack

- **Core**: Node.js, Express.js
- **Database**: MySQL (Primary), Redis (Caching)
- **Real-time**: Socket.io (WebSockets)
- **AI**: Groq AI (Llama/Mixtral models)
- **Authentication**: JWT, bcryptjs
- **Email**: Nodemailer
- **Documentation**: Swagger/OpenAPI 3.0

---

## ⚙️ Setup and Installation

### Prerequisites
- Node.js (v14+)
- MySQL (v5.7+)
- Redis Server (Optional, but recommended)
- npm or yarn

### Installation Steps
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd foodio_api
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Database Setup**:
   Create a MySQL database named `foodio` and run the migration scripts:
   ```bash
   mysql -u root -p foodio < src/migrations/001_create_order_tracking_tables.sql
   mysql -u root -p foodio < src/migrations/002_create_chatbot_tables.sql
   ```

4. **Environment Configuration**:
   Copy `.env.example` to `.env` and fill in your credentials.

5. **Start the server**:
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

---

## 🔑 Environment Configuration

Required environment variables in `.env`:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=foodio

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_key

# Groq AI
GROQ_API_KEY=your_groq_api_key

# Email (Gmail)
MAIL=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password

# Payment (Razorpay)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

---

## 📂 Codebase Overview

### Directory Structure
```
foodio_api/
├── src/
│   ├── config/         # Configuration (Swagger, DB, Groq)
│   ├── middleware/     # Custom Express middleware (Auth, Validation)
│   ├── migrations/     # SQL migration scripts
│   ├── routes/         # API Route definitions
│   │   ├── chatbot/    # Chatbot endpoints
│   │   ├── search/     # Search & Filter endpoints
│   │   ├── tracking/   # Order Tracking endpoints
│   │   └── user/       # Auth & Profile endpoints
│   ├── services/       # Core business logic
│   └── utils/          # Utility functions (DB, Cache, WebSocket)
├── uploads/            # User uploads (profile images)
├── index.js            # Entry point
└── package.json        # Dependencies and scripts
```

---

## 🚢 Production Deployment

### Deployment Options
- **Traditional VPS**: Use PM2 for process management and Nginx as a reverse proxy.
- **Docker**: Use the provided `Dockerfile` and `docker-compose.yml`.
- **Cloud Hosting**: Compatible with AWS Elastic Beanstalk, Heroku, and DigitalOcean App Platform.

### Production Best Practices
1. Set `NODE_ENV=production`.
2. Use HTTPS for all communications.
3. Enable CORS with specific allowed origins.
4. Set up persistent logging (Winston/Morgan).
5. Configure database connection pooling.

---

## 📦 Dependencies

Major dependencies used in the project:

| Package | Purpose |
|---------|---------|
| `express` | Core framework |
| `mysql2` | Database driver |
| `redis` | Caching layer |
| `socket.io` | WebSocket support |
| `jsonwebtoken` | Token authentication |
| `bcryptjs` | Password hashing |
| `groq-sdk` | AI Chatbot integration |
| `nodemailer` | Email services |
| `swagger-ui-express` | API Documentation UI |

For a full list, see [package.json](file:///p:/projects/foodio/foodio_api/package.json).

---
**Status**: ACTIVE 🛠️

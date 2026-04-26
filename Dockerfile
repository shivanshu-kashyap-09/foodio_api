# Use Node.js 20 base image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Create logs and uploads directory
RUN mkdir -p logs uploads

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD [ "node", "index.js" ]

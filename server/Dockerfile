# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install tini for proper PID 1 handling (optional)
RUN apk add --no-cache tini

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install deps
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Use tini to handle signals cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]


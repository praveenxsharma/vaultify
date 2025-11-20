# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# tini for PID1 signal handling
RUN apk add --no-cache tini

# Copy package files from repo's server/ folder (build context is repo root)
COPY ./server/package*.json ./

# Install production dependencies (omit dev)
RUN npm install --omit=dev

# Copy server source code into image
COPY ./server ./

# Expose port, set entrypoint + command
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]


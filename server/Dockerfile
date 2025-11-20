# server/Dockerfile (option A - quick)
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache tini

COPY package*.json ./

# Use npm install and omit devDependencies for smaller image
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]


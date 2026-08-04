# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend source files
COPY . .

# Ensure db directory exists
RUN mkdir -p db

# Expose backend API port
EXPOSE 3001

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Entry command
CMD ["node", "server.js"]

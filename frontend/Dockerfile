# Stage 1: Development (used by docker-compose.dev.yml)
FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 2: Production Builder
FROM dev AS builder
RUN npm run build

# Stage 3: Serve static files with Nginx (used by docker-compose.yml)
FROM nginx:alpine AS prod

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

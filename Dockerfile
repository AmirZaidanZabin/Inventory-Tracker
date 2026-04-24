# Stage 1: Build the static application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install (optimizes Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source
COPY . .

# Accept build arguments for environment variables
ARG VITE_DB_PROVIDER
ARG VITE_API_URL
ARG VITE_SUPABASE_KEY

# Expose them to the build process
ENV VITE_DB_PROVIDER=$VITE_DB_PROVIDER
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_KEY=$VITE_SUPABASE_KEY

# Build the frontend application
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

# Multi-stage Dockerfile for Rust backend + Node.js frontend

# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client

# Copy package files and install dependencies
# Use --legacy-peer-deps to handle peer dependency conflicts (Vue 3.6 alpha + Vuetify)
COPY client/package.json client/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy client source and build
COPY client/ ./
RUN npm run build

# Stage 2: Build Rust backend
# Use latest Rust version to support edition2024 required by datastar 0.3
FROM rust:latest-alpine AS backend
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy workspace Cargo.toml first
COPY server/Cargo.toml ./server/

# Copy individual crate Cargo.toml files
COPY server/api/Cargo.toml ./server/api/
COPY server/game_core/Cargo.toml ./server/game_core/

# Copy all source code (simpler approach - dependency caching will still work for Cargo deps)
COPY server/api/src ./server/api/src
COPY server/game_core/src ./server/game_core/src

# Generate Cargo.lock and build
WORKDIR /app/server
RUN cargo generate-lockfile && \
    cargo build --release

# Stage 3: Runtime
FROM debian:bookworm-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy built binary from backend stage
COPY --from=backend /app/server/target/release/api /usr/local/bin/api

# Copy built frontend from frontend stage
COPY --from=frontend /app/client/dist ./client/dist

# Expose port (Render.com sets PORT env var)
EXPOSE 3000

# Run the server
CMD ["/usr/local/bin/api"]


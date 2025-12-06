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
FROM rust:1.75-alpine AS backend
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy workspace Cargo.toml first
COPY server/Cargo.toml ./server/

# Copy individual crate Cargo.toml files
COPY server/api/Cargo.toml ./server/api/
COPY server/game_core/Cargo.toml ./server/game_core/

# Create dummy source files to cache dependencies
# Generate Cargo.lock (it may be gitignored, so we always generate it for reproducible builds)
RUN cd server && \
    cargo generate-lockfile && \
    mkdir -p api/src game_core/src && \
    echo "fn main() {}" > api/src/main.rs && \
    echo "pub fn dummy() {}" > game_core/src/lib.rs && \
    cargo build --release && \
    rm -rf api/src game_core/src target/release/deps/api* target/release/deps/game_core*

# Copy actual source code
COPY server/api/src ./server/api/src
COPY server/game_core/src ./server/game_core/src

# Build the release binary
WORKDIR /app/server
RUN cargo build --release

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


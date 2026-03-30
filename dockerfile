# Dockerfile

# --- Stage 1: Builder ---
# Use a specific, stable Node version for builds.
FROM node:20-slim AS builder

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker layer caching
COPY package*.json ./

# Install dependencies (including devDependencies if needed for build/testing, though we rely on --production for final image)
RUN npm install

# Copy all source code
COPY . .

# --- Stage 2: Production/Runtime ---
# Use a minimal production-ready image
FROM node:20-slim AS production

# Create and set the working directory
WORKDIR /usr/src/app

# Set non-root user for security (best practice for Cloud Run)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy only the necessary production files from the builder stage
# This includes package.json and node_modules (production only)
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/index.js ./index.js
COPY --from=builder /usr/src/app/ajv_config.js ./ajv_config.js
COPY --from=builder /usr/src/app/RuleSetSchema.json ./RuleSetSchema.json
COPY --from=builder /usr/src/app/LeadSchema.json ./LeadSchema.json
COPY --from=builder /usr/src/app/briefs ./briefs

# Cloud Run expects the application to listen on the port specified by the PORT environment variable.
ENV PORT 8080
EXPOSE 8080

# Command to run the application
CMD ["node", "index.js"]

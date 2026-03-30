# STAGE 1: Build
# We use the hash you found: 330fc...
FROM node@sha256:330fc735268c38d88788c3469a8dff2d0ad834af58569a42c61c47e4578d953b AS build

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies
RUN npm ci

# STAGE 2: Runtime
FROM node@sha256:330fc735268c38d88788c3469a8dff2d0ad834af58569a42c61c47e4578d953b

WORKDIR /usr/src/app

# Copy dependencies and code
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY . .

# Security: Run as non-root
USER node

# Start
CMD ["node", "server.js"]

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package management files and Prisma directory
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for building and Prisma generation)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client and build the NestJS application
RUN npm run prisma:generate
RUN npm run build

# Remove development dependencies to optimize image size
RUN npm prune --production

# Stage 2: Run the application
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy built application and pruned node_modules from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Expose port (default NestJS / env configuration)
EXPOSE 5000

# Start the NestJS server in production mode
CMD ["node", "dist/main"]

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN ln -s /app/dist/shared /app/node_modules/@shared \
    && ln -s /app/dist/domain /app/node_modules/@domain \
    && ln -s /app/dist/application /app/node_modules/@application \
    && ln -s /app/dist/infrastructure /app/node_modules/@infrastructure
EXPOSE 3007
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/index.js"]

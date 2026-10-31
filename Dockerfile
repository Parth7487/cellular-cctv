FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server code and web dashboard assets
COPY server/src/ ./src/
COPY server/public/ ./public/

ENV PORT=10000
ENV NODE_ENV=production

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-10000}/api/health || exit 1

CMD ["node", "src/index.js"]

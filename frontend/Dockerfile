FROM node:20-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --prefer-offline --no-audit --progress=false

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]

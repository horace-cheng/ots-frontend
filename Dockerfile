FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_FIREBASE_API_KEY=dummy
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dummy
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=dummy
ENV NEXT_PUBLIC_FIREBASE_APP_ID=dummy
ENV PORT=8080

#COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080
CMD ["node", "server.js"]

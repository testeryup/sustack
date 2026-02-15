# === STAGE 1: BUILDER ===
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# DATABASE_URL giả để prisma generate không lỗi
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/fake_db"

RUN npx prisma generate

COPY . .
RUN npm run build

# === STAGE 2: RUNNER ===
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Ghi đè dist/generated/ bằng file .ts gốc (Prisma 7 generate .ts với .ts imports,
# tsc không rewrite extensions → tsx cần file .ts gốc)
COPY --from=builder /app/generated ./dist/generated

ENV NODE_ENV=production
RUN npm ci --omit=dev
RUN npm install -g tsx

ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && tsx dist/server.js"]
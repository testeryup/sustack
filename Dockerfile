# ===== STAGE 1: BUILDER =====
FROM node:24.12-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Lớp 1: Dependencies (Ít thay đổi nhất)
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
# Tận dụng cache của npm install
RUN npm ci 

# Lớp 2: Prisma (Chỉ thay đổi khi sửa schema.prisma)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/fake"
RUN npx prisma generate

# Lớp 3: Source Code (Thay đổi thường xuyên nhất)
COPY . .
RUN npm run build

# ===== STAGE 2: RUNNER =====
FROM node:24.12-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Tối ưu Stage 2: Chỉ lấy node_modules đã prune (nhẹ và nhanh hơn)
COPY --from=builder /app/package*.json ./
# Chỉ cài production dependencies
RUN npm ci --omit=dev && rm -rf /root/.npm

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts    

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
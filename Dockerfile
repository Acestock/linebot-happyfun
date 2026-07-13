FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI phones home to checkpoint.prisma.io on every run; in restricted
# networks that call can stall the process after its real work is done.
ENV CHECKPOINT_DISABLE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate

EXPOSE 3000
# timeout: even if the migrate CLI finishes its work but never exits, the
# server must still come up. exec: node becomes PID 1 and receives signals.
CMD ["sh", "-c", "timeout 60 node_modules/.bin/prisma migrate deploy; echo \"[boot] prisma migrate deploy exit code: $?\"; exec node dist/index.js"]

# --- Stage 1: Install dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
# The lockfile is generated on the dev machine (often win32), so it lacks the
# linux-musl sharp binary that node:22-alpine needs. Force-install it here so
# image optimization works in production instead of silently falling back.
RUN npm install --no-save --include=optional --os=linux --libc=musl --cpu=x64 sharp

# --- Stage 2: Build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/start.mjs ./start.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/db/migrations ./migrations
EXPOSE 4321
CMD ["node", "./start.mjs"]

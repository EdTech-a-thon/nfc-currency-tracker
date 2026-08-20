FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
# The address of PocketBase is baked into the browser bundle at build time.
ARG PUBLIC_POCKETBASE_URL
ARG PUBLIC_CARD_BASE_URL
ENV PUBLIC_POCKETBASE_URL=$PUBLIC_POCKETBASE_URL
ENV PUBLIC_CARD_BASE_URL=$PUBLIC_CARD_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs sveltekit
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./package.json
USER sveltekit
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "build/index.js"]

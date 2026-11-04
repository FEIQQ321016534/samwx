FROM node:24-bookworm-slim
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY apps/api/src ./src
COPY apps/api/scripts ./scripts
COPY packages/domain /app/packages/domain
COPY tools /app/tools
RUN mkdir -p /data/media /backups && chown -R node:node /data /backups
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/data/sam.sqlite MEDIA_DIRECTORY=/data/media DEV_AUTH_ENABLED=false DEV_PAYMENTS_ENABLED=false
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=3 CMD ["node", "/app/tools/healthcheck.mjs", "--url", "http://127.0.0.1:8787/api", "--production"]
CMD ["node", "--import", "tsx", "src/server.ts"]

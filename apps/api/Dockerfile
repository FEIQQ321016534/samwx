# Build from the repository root:
# docker build -f apps/api/Dockerfile -t sam-api:local .
FROM node:24-alpine
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false && npm cache clean --force
COPY apps/api/src ./src
COPY packages/domain /app/packages/domain
RUN mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production \
    DEV_AUTH_ENABLED=false \
    DEV_PAYMENTS_ENABLED=false \
    DATABASE_PATH=/app/data/sam-production.sqlite \
    HOST=0.0.0.0 \
    PORT=8787
USER node
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server.ts"]

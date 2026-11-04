FROM node:24-bookworm-slim AS build
WORKDIR /app/apps/admin
COPY apps/admin/package.json apps/admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/admin ./
COPY packages/domain /app/packages/domain
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

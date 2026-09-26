# Build stage: compile the Vite app (Vite bakes committed .env.production)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Sentry, for the production image only: docker-compose.yml passes the DSN and environment, and
# the deploy script passes the commit (.git is not in the build context). Declared after
# `npm ci` so a new commit does not invalidate the dependency layer. Empty by default, and an
# empty DSN leaves Sentry off (plain `docker build` in CI, local builds).
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT=""
ARG VITE_SENTRY_RELEASE=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE
RUN npm run build

# Serve stage: static files via nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

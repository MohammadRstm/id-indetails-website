# The website as a container: built with Node, served by an unprivileged nginx on port 8080.
#
#   check    type-checks, lints and runs the unit tests (CI builds this stage; nothing from it is kept)
#   runtime  the static build behind nginx (deploy/nginx.conf), which also proxies the public website API
#
# Build: docker build -t id-indetails-website .
# Run:   docker run --rm -p 8080:8080 --read-only --tmpfs /tmp id-indetails-website

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS check
COPY . .
RUN npm run typecheck && npm run lint && npm test

FROM deps AS build
COPY . .
# Where the browser calls the API; empty keeps the same-origin default (/api/public/website, proxied by nginx).
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# The Google Analytics measurement ID (G-…), given only by the Publish workflow: empty, nothing is tracked.
ARG VITE_GA_MEASUREMENT_ID=
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
# The base image can trail Alpine's security fixes by days, so the packages with fixed high-severity CVEs are upgraded
# until it ships them, as the internal app's image does: pcre2 (CVE-2026-103111), brotli-libs (CVE-2026-111497), curl and
# libcurl (CVE-2026-92392), libexpat (CVE-2026-113351, CVE-2026-117610, CVE-2026-118370), zlib (CVE-2026-85091). Only
# those: a full upgrade could replace nginx.org's nginx with Alpine's. Then back to the image's unprivileged user.
USER root
RUN apk upgrade --no-cache pcre2 brotli-libs curl libcurl libexpat zlib
USER 101
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

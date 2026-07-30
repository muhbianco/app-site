# syntax=docker/dockerfile:1

FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/site.conf
COPY public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

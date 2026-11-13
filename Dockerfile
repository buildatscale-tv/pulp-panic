# Static hosting for the game on Fly.io. Serves at / and at /pulp/ (for a later buildatscale.tv/pulp proxy).
# --chmod makes the files readable for nginx (some source files are owner-only on the Mac).
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 public/ /usr/share/nginx/html/
COPY --chmod=755 public/ /usr/share/nginx/html/pulp/

FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf

# Create the heroku-clone config dir with a default server so nginx
# can start even when the shared volume is empty.
RUN mkdir -p /etc/nginx/heroku-clone && \
    printf 'server {\n  listen 80 default_server;\n  server_name _;\n  return 503 "No apps deployed";\n}\n' \
    > /etc/nginx/heroku-clone/00-default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=backend /tmp/nginx-heroku-clone /etc/nginx/heroku-clone
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

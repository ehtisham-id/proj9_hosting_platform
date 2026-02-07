FROM node:20-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY src/package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

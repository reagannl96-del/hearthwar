# Hearthwar game server (deploy on Railway, Fly.io, Render, ...)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run server:build
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server-dist/index.js"]

# Hearthwar game server (deploy on Railway, Fly.io, Render, ...)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run server:build
ENV NODE_ENV=production
EXPOSE 8787
# a free instance has 512 MB: let the JS heap use most of it (the default stops near 250 MB)
CMD ["node", "--max-old-space-size=400", "server-dist/index.js"]

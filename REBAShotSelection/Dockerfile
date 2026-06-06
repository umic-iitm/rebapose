FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY tsconfig*.json ./
EXPOSE 8080
ENV PORT=8080 NODE_ENV=production
CMD ["node", "--import", "tsx", "server/index.ts"]

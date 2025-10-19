FROM node:22-alpine3.21

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm ci --only=production

ENTRYPOINT ["node", "--disable-wasm-trap-handler", "/app/dist/index.js"]

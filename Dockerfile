FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
USER node
EXPOSE 8402
CMD ["npx", "tsx", "src/server.ts"]

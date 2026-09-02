FROM node:22-alpine

WORKDIR /app

# Устанавливаем pnpm
RUN corepack enable && corepack prepare pnpm@11 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY src ./src

# Папка для state.json (последний обработанный ID сообщения)
RUN mkdir -p /app/data

CMD ["node", "src/listener.js"]

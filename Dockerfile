FROM oven/bun:latest


WORKDIR /app
COPY package.json package.json
COPY bun.lock bun.lock

RUN bun i

COPY . .

CMD bun run start

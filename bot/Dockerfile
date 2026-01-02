FROM node:22

WORKDIR /bot

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm install

COPY . .

CMD node bot.js

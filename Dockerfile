FROM node:22-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install --production

EXPOSE 3000

CMD ["node", "src/index.js"]
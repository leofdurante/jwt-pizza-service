FROM node:22-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install --omit=dev

ENV PORT=80

EXPOSE 80

CMD ["node","src/index.js"]
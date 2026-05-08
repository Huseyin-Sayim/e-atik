FROM node:20-alpine
WORKDIR /home/node/eAtik

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

CMD npm run dev
EXPOSE 2001
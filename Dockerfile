FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV EPOCH_DB=/var/lib/epoch/epoch.sqlite
ENV EPOCH_SEED_DEMO=0

RUN mkdir -p /var/lib/epoch
VOLUME /var/lib/epoch

EXPOSE 4317

CMD ["npm", "start"]

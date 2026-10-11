FROM node:24-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    PARTIES_DIR=/parties

RUN mkdir -p /data /parties

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/config || exit 1

CMD ["node", "src/server/server.js"]

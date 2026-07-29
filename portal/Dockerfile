FROM node:24-alpine

RUN apk add --no-cache font-dejavu

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build \
  && mkdir -p /app/data/uploads \
  && chown -R node:node /app/.next /app/data

EXPOSE 3000
USER node
CMD ["npm", "start"]

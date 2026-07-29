ARG NODE_IMAGE=node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache font-dejavu
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
EXPOSE 3000
USER node
CMD ["node", "server.js"]

FROM dependencies AS migrator
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
CMD ["npm", "run", "db:setup"]

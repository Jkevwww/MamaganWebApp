FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public/uploads/facilities public/uploads/reviews \
  && chown -R node:node /app

USER node

EXPOSE 10000

CMD ["npm", "start"]

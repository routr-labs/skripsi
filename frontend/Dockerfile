FROM oven/bun:1 AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY frontend ./
COPY app/static/vendor /app/app/static/vendor
RUN bun run build

FROM oven/bun:1
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=build /app/frontend/.output ./.output
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]

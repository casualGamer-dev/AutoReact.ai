# Build context is the repo root (see docker-compose.yml) because this service
# requires ../auto-layout/lib/{layoutSort,codeGen}.js directly - single source
# of truth for the sort/codegen logic, shared with the offline mobile path.
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/src ./src
COPY server/scripts ./scripts
COPY auto-layout/lib ../auto-layout/lib
EXPOSE 3000
CMD ["node", "src/index.js"]

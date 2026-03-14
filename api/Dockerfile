FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json .npmrc ./

# Install all deps (need prisma CLI from devDeps)
RUN npm install --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy pre-built dist and shared package
COPY dist ./dist
COPY packages ./packages

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD sh -c "npx prisma migrate deploy && node dist/main"

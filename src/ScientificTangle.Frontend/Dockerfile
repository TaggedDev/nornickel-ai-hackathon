FROM node:20-alpine AS build
WORKDIR /app
COPY src/ScientificTangle.Frontend/package.json src/ScientificTangle.Frontend/package-lock.json ./src/ScientificTangle.Frontend/
WORKDIR /app/src/ScientificTangle.Frontend
RUN npm ci
WORKDIR /app
COPY src/ ./src/
COPY mock-data/ ./mock-data/
WORKDIR /app/src/ScientificTangle.Frontend
RUN npm run build

FROM nginx:alpine AS runtime
COPY src/ScientificTangle.Frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/ScientificTangle.Frontend/dist /usr/share/nginx/html
EXPOSE 80

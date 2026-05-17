FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json ./
RUN npm ci
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SOCKET_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_BASE_URL=$VITE_SOCKET_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

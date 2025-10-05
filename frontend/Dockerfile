FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
EXPOSE 5173 
CMD ["npm", "run", "dev", "--", "--host"]

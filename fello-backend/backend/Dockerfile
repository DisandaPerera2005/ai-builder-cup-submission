FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Standard npm install creates flat node_modules
RUN npm install

# Copy source
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]

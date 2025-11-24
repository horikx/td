FROM node:20-alpine

# Install git for pulling updates
RUN apk add --no-cache git

WORKDIR /app

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

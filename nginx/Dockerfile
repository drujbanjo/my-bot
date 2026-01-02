FROM nginx:alpine

# Устанавливаем модуль dav
RUN apk add --no-cache nginx-mod-http-dav-ext

# Удаляем дефолтную конфигурацию
RUN rm /etc/nginx/conf.d/default.conf

# Копируем кастомную конфигурацию
COPY nginx.conf /etc/nginx/nginx.conf

# Копируем скрипт инициализации
COPY init-storage.sh /docker-entrypoint.d/40-init-storage.sh
RUN chmod +x /docker-entrypoint.d/40-init-storage.sh

# Создаём директорию для данных
RUN mkdir -p /app/data && \
  chown -R nginx:nginx /app && \
  chmod -R 755 /app

WORKDIR /app

EXPOSE 9090

CMD ["nginx", "-g", "daemon off;"]

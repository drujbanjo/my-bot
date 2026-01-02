#!/bin/sh
DATA_DIR="/app/data"
mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/homework.json" ] || [ ! -s "$DATA_DIR/homework.json" ]; then
    echo "{}" > "$DATA_DIR/homework.json"
    echo "✅ Создан homework.json"
fi

if [ ! -f "$DATA_DIR/last_schedule.json" ] || [ ! -s "$DATA_DIR/last_schedule.json" ]; then
    echo "{}" > "$DATA_DIR/last_schedule.json"
    echo "✅ Создан last_schedule.json"
fi

chown -R nginx:nginx "$DATA_DIR"
chmod -R 755 "$DATA_DIR"
chmod 644 "$DATA_DIR"/*.json
echo "✅ Инициализация хранилища завершена"

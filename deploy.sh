#!/bin/bash

# 检查参数
if [ "$1" != "test" ] && [ "$1" != "prod" ]; then
  echo "使用方法: ./deploy.sh [test|prod]"
  exit 1
fi

ENV_TYPE=$1
ENV_FILE=".env.$ENV_TYPE"

if [ ! -f "$ENV_FILE" ]; then
  echo "错误: 找不到配置文件 $ENV_FILE"
  exit 1
fi

echo "正在启动 $ENV_TYPE 环境..."
echo "配置文件: $ENV_FILE"

# 使用指定的 .env 文件启动 docker-compose
# --project-name 用于区分不同的部署实例（容器名会带上后缀）
docker-compose --env-file "$ENV_FILE" -p "mano-viewer-$ENV_TYPE" up -d --build

echo "部署完成！"
docker ps | grep "mano-viewer-$ENV_TYPE"

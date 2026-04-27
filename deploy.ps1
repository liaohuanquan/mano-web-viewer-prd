param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("test", "prod")]
    $EnvType
)

$EnvFile = ".env.$EnvType"

if (-not (Test-Path $EnvFile)) {
    Write-Error "错误: 找不到配置文件 $EnvFile"
    exit
}

Write-Host "正在启动 $EnvType 环境..." -ForegroundColor Cyan
Write-Host "配置文件: $EnvFile"

# 使用指定的 .env 文件启动 docker-compose
docker-compose --env-file $EnvFile -p "mano-viewer-$EnvType" up -d --build

Write-Host "部署完成！" -ForegroundColor Green
docker ps | Select-String "mano-viewer-$EnvType"

# MANO Web Viewer

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&style=flat-square)
![Three.js](https://img.shields.io/badge/Three.js-R3F-black?logo=three.js&style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&style=flat-square)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&style=flat-square)

Web 端 MANO PKL 手部模型可视化检查工具。

![1776829484635](image/README/1776829484635.gif)

## 项目结构

```
├── apps/
│   ├── frontend/  # Next.js 前端 (TypeScript + React Three Fiber)
│   └── backend/   # FastAPI 后端 (Python)
├── public/mock/   # 测试数据
└── docs/          # PRD 文档
```

## 快速开始

### 本地开发

#### 前端

```bash
cd apps/frontend
npm install
npm run dev
```

#### 后端

```bash
cd apps/backend
pip install -r requirements.txt```bash
uvicorn main:app --reload --port 8000
```

```

```

### Docker 部署

1. **配置环境变量**：复制并修改 `.env` 文件中的 `HOST_IP` 和端口配置。
2. **启动服务**：在项目根目录下执行：

```bash
docker-compose up -d --build
```

#### 访问方式

根据 `.env` 中的配置，默认访问地址为：

- **前端界面**：`http://${HOST_IP}:${FRONTEND_PORT}` (例如：http://10.60.202.97:18080)
- **后端 API**：`http://${HOST_IP}:${BACKEND_PORT}` (例如：http://10.60.202.97:18000)
- **API 文档**：`http://${HOST_IP}:${BACKEND_PORT}/docs`

#### 远程访问提示 (SSH Tunnel)

如果服务器防火墙限制了端口访问，可以在本地终端使用 SSH 隧道映射端口：

```bash
# 在本地电脑执行
ssh -L 18080:localhost:18080 -L 18000:localhost:18000 ubuntu@10.60.202.97
```

映射后，即可通过 [http://localhost:18080](http://localhost:18080) 访问。

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

在项目根目录下执行：

```bash
docker-compose up --build
```

- 前端：http://localhost:3000
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs

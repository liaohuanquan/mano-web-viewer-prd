# MANO Web Viewer

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&style=flat-square)
![Three.js](https://img.shields.io/badge/Three.js-R3F-black?logo=three.js&style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&style=flat-square)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&style=flat-square)

Web 端 MANO PKL 手部模型可视化检查工具。

## 项目结构

```
├── frontend/      # Next.js 前端 (TypeScript + React Three Fiber)
├── backend/       # FastAPI 后端 (Python)
├── public/mock/   # 测试数据
└── doc/           # PRD 文档
```

## 快速开始

### 前端

需要进入 `frontend` 目录运行相关命令：

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 后端

需要进入 `backend` 目录运行相关命令：

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

## 功能

- 📦 上传 PKL + MP4 文件
- 🖥️ 左侧 2D 视频叠加手部 mesh
- 🎮 右侧 3D 手部 mesh 交互查看
- ⏯️ 播放控制（播放/暂停/逐帧/进度条）
- ✅ 完整的输入校验（V1-V20）

"""
MANO Web Viewer 后端服务入口
提供 PKL 文件解析、校验和数据返回的 API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.pkl_router import router as pkl_router

app = FastAPI(
    title="MANO Web Viewer API",
    description="PKL 文件解析与 MANO 数据处理服务",
    version="0.1.0",
)

# 跨域配置（开发环境允许前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(pkl_router, prefix="/api")


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok"}

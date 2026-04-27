import os
import torch
import numpy as np

np.bool = bool
np.int = int
np.float = float
np.complex = complex
np.object = object
np.unicode = str
np.str = str

import smplx
# 设置 MANO 模型权重所在的目录
MODEL_ROOT = os.environ.get("MANO_MODEL_PATH", "/app/model")

class ManoBuilder:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"[ManoBuilder] 初始化 MANO 模型，使用设备: {self.device}")
        
        # 加载左手和右手模型
        # use_pca=False 是为了直接使用完整的 45 维姿态输入（Hamer 格式）而不是 10 维的 PCA 系数
        try:
            self.mano_right = smplx.MANO(
                model_path=MODEL_ROOT,
                is_rhand=True,
                use_pca=False,
                flat_hand_mean=True
            ).to(self.device)
            
            self.mano_left = smplx.MANO(
                model_path=MODEL_ROOT,
                is_rhand=False,
                use_pca=False,
                flat_hand_mean=True
            ).to(self.device)
            
            self.faces = self.mano_right.faces
            self.is_ready = True
            print("[ManoBuilder] 模型加载成功")
        except Exception as e:
            print(f"[ManoBuilder] 模型加载失败: {e}")
            self.is_ready = False

    def build_verts(self, is_right: bool, body_pose, betas, global_orient=None):
        """
        根据姿态参数构建顶点
        """
        if not self.is_ready:
            return None
            
        model = self.mano_right
        
        # 将 numpy array 转为 torch tensor
        # body_pose 应该是 (1, 15, 3) -> 展平为 (1, 45)
        # Hamer / dyn-hamr 中传入的 body_pose 已经是 axis-angle 格式
        
        try:
            pose_tensor = torch.tensor(body_pose, dtype=torch.float32).reshape(-1, 45).to(self.device)
            betas_tensor = torch.tensor(betas, dtype=torch.float32).reshape(-1, 10).to(self.device)
            
            # 这里的 global_orient 影响全局旋转，如果提供的话
            if global_orient is not None:
                gorient_tensor = torch.tensor(global_orient, dtype=torch.float32).reshape(-1, 3).to(self.device)
            else:
                gorient_tensor = torch.zeros(pose_tensor.shape[0], 3, device=self.device)
            
            with torch.no_grad():
                output = model(
                    global_orient=gorient_tensor,
                    hand_pose=pose_tensor,
                    betas=betas_tensor
                )
                
            # 返回 (顶点, 关节点) 元组
            # vertices: (778, 3), joints: (16, 3)
            verts = output.vertices.cpu().numpy()[0]
            joints = output.joints.cpu().numpy()[0]
            return verts, joints
        except Exception as e:
            print(f"[ManoBuilder] 重建失败: {e}")
            return None

# 单例模式，避免重复加载
mano_builder = ManoBuilder()

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import styles from './FileUpload.module.css';

interface FileNode {
  id: string;
  name: string;
  type: 'directory' | 'file';
  children?: FileNode[];
  pkl_path?: string;
  mp4_path?: string;
  isLoaded?: boolean;
}

interface FileUploadProps {
  onLocalFilesSelected: (pkl: File, mp4: File) => void;
  onServerFileSelected: (pklPath: string, mp4Path: string) => void;
  isLoading?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onLocalFilesSelected, 
  onServerFileSelected,
  isLoading = false 
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'server'>('local');
  
  const [pklFile, setPklFile] = useState<File | null>(null);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [pklDragActive, setPklDragActive] = useState<boolean>(false);
  const [mp4DragActive, setMp4DragActive] = useState<boolean>(false);
  
  const pklInputRef = useRef<HTMLInputElement>(null);
  const mp4InputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<FileNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [isFetchingProjects, setIsFetchingProjects] = useState<boolean>(false);

  // 这里的 process 报错是环境问题，代码运行时在 Docker 中会被正确替换
  const apiUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:18000/api';

  useEffect(() => {
    if (activeTab === 'server' && projects.length === 0) {
      fetchLevel(""); 
    }
  }, [activeTab]);

  const fetchLevel = async (path: string) => {
    setIsFetchingProjects(true);
    try {
      const response = await fetch(`${apiUrl}/projects?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      const newItems: FileNode[] = data.projects || [];
      
      if (path === "") {
        setProjects(newItems);
      } else {
        setProjects((prev: FileNode[]) => updateChildrenInTree(prev, path, newItems));
      }
    } catch (error) {
      console.error('Failed to load level', error);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const updateChildrenInTree = (nodes: FileNode[], targetId: string, children: FileNode[]): FileNode[] => {
    return nodes.map((node: FileNode) => {
      if (node.id === targetId) {
        return { ...node, children, isLoaded: true };
      }
      if (node.children) {
        return { ...node, children: updateChildrenInTree(node.children, targetId, children) };
      }
      return node;
    });
  };

  const toggleNode = async (node: FileNode) => {
    const isExpanding = !expandedNodes[node.id];
    
    if (isExpanding && !node.isLoaded) {
      await fetchLevel(node.id);
    }
    
    setExpandedNodes((prev: Record<string, boolean>) => ({
      ...prev,
      [node.id]: isExpanding
    }));
  };

  const handleFileSelect = (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFile(node);
    }
  };

  const renderTree = (nodes: FileNode[]) => {
    return nodes.map((node: FileNode) => (
      <div key={node.id} className={styles.treeNode}>
        <div 
          className={`${styles.treeHeader} ${selectedFile?.id === node.id ? styles.treeHeaderActive : ''}`}
          onClick={() => node.type === 'directory' ? toggleNode(node) : handleFileSelect(node)}
        >
          <span className={styles.treeIcon}>
            {node.type === 'directory' ? (expandedNodes[node.id] ? '📂' : '📁') : '📄'}
          </span>
          <span className={styles.nodeName}>{node.name}</span>
          {node.type === 'file' && <span className={styles.fileInfo}>.pkl</span>}
        </div>
        
        {node.type === 'directory' && expandedNodes[node.id] && node.children && (
          <div className={styles.treeChildren}>
            {renderTree(node.children)}
          </div>
        )}
      </div>
    ));
  };

  const handleLocalSubmit = () => {
    if (pklFile && mp4File) {
      onLocalFilesSelected(pklFile, mp4File);
    }
  };

  const handleServerSubmit = () => {
    if (selectedFile?.pkl_path && selectedFile?.mp4_path) {
      onServerFileSelected(selectedFile.pkl_path, selectedFile.mp4_path);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onPklDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPklDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setPklFile(e.dataTransfer.files[0]);
    }
  };

  const onMp4Drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMp4DragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setMp4File(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={styles.uploadContainer}>
      <h2 className={styles.uploadTitle}>MANO Web Viewer</h2>
      <p className={styles.uploadSubtitle}>选择 PKL 和 MP4 文件开始可视化检查</p>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'local' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('local')}
        >
          本地上传
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'server' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('server')}
        >
          服务器库
        </button>
      </div>

      {activeTab === 'local' ? (
        <div className={styles.uploadFields}>
          <div className={styles.uploadField}>
            <div
              className={`${styles.dropZone} ${pklDragActive ? styles.dropZoneActive : ''} ${pklFile ? styles.dropZoneSelected : ''}`}
              onClick={() => pklInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={onPklDrop}
              onDragEnter={() => setPklDragActive(true)}
              onDragLeave={() => setPklDragActive(false)}
            >
              <span className={styles.dropIcon}>📄</span>
              <span className={styles.dropLabel}>PKL 文件</span>
              {pklFile && <span className={styles.fileName}>{pklFile.name}</span>}
              <input 
                ref={pklInputRef}
                type="file" 
                accept=".pkl" 
                className={styles.hiddenInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPklFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className={styles.uploadField}>
            <div
              className={`${styles.dropZone} ${mp4DragActive ? styles.dropZoneActive : ''} ${mp4File ? styles.dropZoneSelected : ''}`}
              onClick={() => mp4InputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={onMp4Drop}
              onDragEnter={() => setMp4DragActive(true)}
              onDragLeave={() => setMp4DragActive(false)}
            >
              <span className={styles.dropIcon}>🎬</span>
              <span className={styles.dropLabel}>MP4 视频</span>
              {mp4File && <span className={styles.fileName}>{mp4File.name}</span>}
              <input 
                ref={mp4InputRef}
                type="file" 
                accept="video/mp4" 
                className={styles.hiddenInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMp4File(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.serverExplorer}>
          {projects.length > 0 ? (
            renderTree(projects)
          ) : isFetchingProjects ? (
            <div className={styles.noProjects}>正在加载...</div>
          ) : (
            <div className={styles.noProjects}>未找到匹配的项目</div>
          )}
          {isFetchingProjects && projects.length > 0 && (
            <div style={{fontSize: '10px', padding: '4px', textAlign: 'center', opacity: 0.5}}>正在抓取子项...</div>
          )}
        </div>
      )}

      <div className={styles.uploadActions}>
        <button 
          className={styles.btnPrimary} 
          disabled={isLoading || (activeTab === 'local' ? (!pklFile || !mp4File) : !selectedFile)}
          onClick={activeTab === 'local' ? handleLocalSubmit : handleServerSubmit}
        >
          {isLoading ? '解析中...' : '开始加载'}
        </button>
        {(pklFile || mp4File || selectedFile) && (
          <button 
            className={styles.btnSecondary}
            onClick={() => {
              setPklFile(null);
              setMp4File(null);
              setSelectedFile(null);
            }}
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;

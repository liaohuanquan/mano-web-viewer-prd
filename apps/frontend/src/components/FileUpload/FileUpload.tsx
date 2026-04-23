import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import styles from './FileUpload.module.css';

interface FileNode {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'csv';
  children?: FileNode[];
  pkl_path?: string;
  mp4_path?: string;
  csv_path?: string;
  isLoaded?: boolean;
}

interface CsvRecord {
  id: string;
  name: string;
  pkl_path: string;
  mp4_path: string;
  frame_count: string;
  track_count: string;
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
  
  // 本地上传状态
  const [pklFile, setPklFile] = useState<File | null>(null);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [pklDragActive, setPklDragActive] = useState<boolean>(false);
  const [mp4DragActive, setMp4DragActive] = useState<boolean>(false);
  
  const pklInputRef = useRef<HTMLInputElement>(null);
  const mp4InputRef = useRef<HTMLInputElement>(null);

  // 服务器项目状态
  const [projects, setProjects] = useState<FileNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [selectedCsv, setSelectedCsv] = useState<FileNode | null>(null);
  const [csvRecords, setCsvRecords] = useState<CsvRecord[]>([]);
  const [isParsingCsv, setIsParsingCsv] = useState<boolean>(false);
  const [isFetchingProjects, setIsFetchingProjects] = useState<boolean>(false);
  
  // 搜索与历史记录状态
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [recentProjects, setRecentProjects] = useState<FileNode[]>([]);
  
  // 用于取消上一个未完成的请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const apiUrl = (typeof window !== 'undefined' && window.location.hostname) 
    ? `http://${window.location.hostname}:18000/api`
    : 'http://localhost:18000/api';

  // 初始化历史记录
  useEffect(() => {
    const saved = localStorage.getItem('mano_recent_projects');
    if (saved) {
      try {
        setRecentProjects(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent projects', e);
      }
    }
  }, []);

  // 搜索防抖逻辑
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 缩短为 300ms
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 当防抖查询词变化时，重新抓取
  useEffect(() => {
    console.log(`[FileUpload] Effect Triggered: activeTab=${activeTab}, debouncedQuery="${debouncedQuery}"`);
    if (activeTab === 'server') {
      if (debouncedQuery.trim()) {
        fetchLevel("", debouncedQuery);
      } else {
        fetchLevel(""); // 确保清空时抓取根目录
      }
    }
  }, [debouncedQuery, activeTab]);

  const fetchLevel = async (path: string, query: string = "") => {
    // 取消上一个请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsFetchingProjects(true);
    console.log(`[FileUpload] 🚀 发起请求: path="${path}", query="${query}"`);
    
    // 如果是搜索或者是回到根目录，先清空列表以示状态切换
    if (query || path === "") {
      setProjects([]);
    }

    const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加到15秒超时

    try {
      const url = query 
        ? `${apiUrl}/projects?query=${encodeURIComponent(query)}`
        : `${apiUrl}/projects?path=${encodeURIComponent(path)}`;
        
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      // 只要请求没被取消，且 query 匹配，就更新
      if (query === debouncedQuery) {
        const newItems: FileNode[] = data.projects || [];
        if (query || path === "") {
          setProjects(newItems);
        } else {
          setProjects((prev: FileNode[]) => updateChildrenInTree(prev, path, newItems));
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[FileUpload] ⏹️ 请求已取消或超时');
      } else {
        console.error('[FileUpload] ❌ 请求异常:', error);
      }
    } finally {
      clearTimeout(timeoutId);
      console.log(`[FileUpload] ✅ 状态重置`);
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
    if (debouncedQuery) return; // 搜索模式下禁用折叠展开

    const isExpanding = !expandedNodes[node.id];
    if (isExpanding && !node.isLoaded) {
      await fetchLevel(node.id);
    }
    setExpandedNodes((prev: Record<string, boolean>) => ({
      ...prev,
      [node.id]: isExpanding
    }));
  };

  const handleNodeClick = async (node: FileNode) => {
    if (node.type === 'directory') {
      toggleNode(node);
    } else if (node.type === 'csv') {
      setIsParsingCsv(true);
      setSelectedCsv(node);
      setSelectedFile(null); // 清空直接选择的文件
      try {
        const response = await fetch(`${apiUrl}/parse-csv?csv_path=${encodeURIComponent(node.csv_path || '')}`);
        const data = await response.json();
        if (data.records) {
          setCsvRecords(data.records);
        } else {
          console.error('[FileUpload] CSV parse error:', data.error);
        }
      } catch (error) {
        console.error('[FileUpload] Failed to parse CSV', error);
      } finally {
        setIsParsingCsv(false);
      }
    } else {
      setSelectedFile(node);
      setSelectedCsv(null); // 清空 CSV 模式
      setCsvRecords([]);
    }
  };

  const saveToRecent = (node: FileNode) => {
    const filtered = recentProjects.filter(p => p.id !== node.id);
    const updated = [node, ...filtered].slice(0, 20); // 增加到 20 个
    setRecentProjects(updated);
    localStorage.setItem('mano_recent_projects', JSON.stringify(updated));
  };

  const handleServerSubmit = () => {
    if (selectedFile?.pkl_path && selectedFile?.mp4_path) {
      saveToRecent(selectedFile);
      onServerFileSelected(selectedFile.pkl_path, selectedFile.mp4_path);
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className={styles.highlight}>
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const renderTree = (nodes: FileNode[]) => {
    return nodes.map((node: FileNode) => (
      <div key={node.id} className={styles.treeNode}>
        <div 
          className={`${styles.treeHeader} ${(selectedFile?.id === node.id || selectedCsv?.id === node.id) ? styles.treeHeaderActive : ''}`}
          onClick={() => handleNodeClick(node)}
          title={node.id}
        >
          <span className={styles.treeIcon}>
            {node.type === 'directory' ? (expandedNodes[node.id] ? '📂' : '📁') : node.type === 'csv' ? '📊' : '📄'}
          </span>
          <span className={styles.nodeName}>{highlightText(node.name, debouncedQuery)}</span>
          {node.type === 'file' && <span className={styles.fileInfo}>.pkl</span>}
          {node.type === 'csv' && (
            <button 
              className={styles.parseBtn} 
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
            >
              解析
            </button>
          )}
        </div>
        
        {node.type === 'directory' && expandedNodes[node.id] && node.children && (
          <div className={styles.treeChildren}>
            {renderTree(node.children)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={styles.uploadContainer}>
      <h2 className={styles.uploadTitle}>MANO Web Viewer</h2>
      <p className={styles.uploadSubtitle}>选择或搜索服务器上的项目开始分析</p>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'local' ? styles.tabActive : ''}`} onClick={() => setActiveTab('local')}>本地上传</button>
        <button className={`${styles.tab} ${activeTab === 'server' ? styles.tabActive : ''}`} onClick={() => setActiveTab('server')}>服务器库</button>
      </div>

      {activeTab === 'local' ? (
        <div className={styles.uploadFields}>
          {/* 本地上传逻辑保持不变 */}
          <div className={styles.uploadField}>
            <div className={`${styles.dropZone} ${pklFile ? styles.dropZoneSelected : ''}`} onClick={() => pklInputRef.current?.click()}>
              <span className={styles.dropIcon}>📄</span>
              <span className={styles.dropLabel}>PKL 文件</span>
              {pklFile && <span className={styles.fileName}>{pklFile.name}</span>}
              <input ref={pklInputRef} type="file" accept=".pkl" className={styles.hiddenInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setPklFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className={styles.uploadField}>
            <div className={`${styles.dropZone} ${mp4File ? styles.dropZoneSelected : ''}`} onClick={() => mp4InputRef.current?.click()}>
              <span className={styles.dropIcon}>🎬</span>
              <span className={styles.dropLabel}>MP4 视频</span>
              {mp4File && <span className={styles.fileName}>{mp4File.name}</span>}
              <input ref={mp4InputRef} type="file" accept="video/mp4" className={styles.hiddenInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setMp4File(e.target.files?.[0] || null)} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{width: '100%'}}>
          <div className={styles.toolbar}>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder=" 搜索项目名称..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchLevel("", searchQuery);
                }
              }}
            />
            <button className={styles.iconBtn} title="搜索" onClick={() => fetchLevel("", searchQuery)}>
              🔍
            </button>
            <button className={styles.iconBtn} title="全部折叠" onClick={() => setExpandedNodes({})}>
              ⏫
            </button>
            <button className={styles.iconBtn} title="刷新" onClick={() => searchQuery ? fetchLevel("", searchQuery) : fetchLevel("")}>
              🔄
            </button>
          </div>
          
          <div className={styles.explorerWrapper}>
            <div className={styles.serverExplorer}>
              {projects.length > 0 ? (
                renderTree(projects)
              ) : isFetchingProjects ? (
                <div className={styles.noProjects}>🔍正在加载...</div>
              ) : (
                <div className={styles.noProjects}>未找到匹配项</div>
              )}
            </div>

            {/* CSV 记录列表面板 - 移出 tree 滚动区 */}
            {(selectedCsv || isParsingCsv) && (
              <div className={styles.csvPanel}>
                <div className={styles.csvPanelHeader}>
                  <span>📊 {selectedCsv?.name} {csvRecords.length > 0 ? `(共 ${csvRecords.length} 条)` : ''}</span>
                  <button className={styles.closeBtn} onClick={() => { setSelectedCsv(null); setCsvRecords([]); }}>✕</button>
                </div>
                <div className={styles.csvRecordList}>
                  {isParsingCsv ? (
                    <div className={styles.csvLoading}>正在解析 CSV 数据...</div>
                  ) : csvRecords.length > 0 ? (
                    csvRecords.map((record) => (
                      <div 
                        key={record.id} 
                        className={`${styles.csvRecordItem} ${selectedFile?.id === record.id ? styles.treeHeaderActive : ''}`}
                        onClick={() => {
                          const virtualNode: FileNode = {
                            id: record.id,
                            name: record.name,
                            type: 'file',
                            pkl_path: record.pkl_path,
                            mp4_path: record.mp4_path
                          };
                          setSelectedFile(virtualNode);
                        }}
                      >
                        <div style={{flex: 1}}>
                          <div className={styles.recordName}>{record.name}</div>
                          <div className={styles.recordInfo}>
                            帧数: {record.frame_count}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.csvEmpty}>该 CSV 文件中未找到有效记录</div>
                  )}
                </div>
              </div>
            )}

            <div className={styles.recentPanel}>
              <div className={styles.recentTitle}>最近播放</div>
              {recentProjects.length > 0 ? recentProjects.map(p => (
                <div key={p.id} className={styles.recentItem} onClick={() => handleNodeClick(p)}>
                  <span> {p.name.split('/').pop()}</span>
                  <span className={styles.recentPath}>{p.id}</span>
                </div>
              )) : (
                <div className={styles.noProjects} style={{padding: '10px 0'}}>暂无记录</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.uploadActions}>
        <button 
          className={styles.btnPrimary} 
          disabled={isLoading || (activeTab === 'local' ? (!pklFile || !mp4File) : !selectedFile)}
          onClick={activeTab === 'local' ? onLocalFilesSelected.bind(null, pklFile!, mp4File!) : handleServerSubmit}
        >
          {isLoading ? '解析中...' : '开始加载'}
        </button>
        <button className={styles.btnSecondary} onClick={() => {setPklFile(null); setMp4File(null); setSelectedFile(null); setSearchQuery('');}}>
          重置
        </button>
      </div>
    </div>
  );
};

export default FileUpload;

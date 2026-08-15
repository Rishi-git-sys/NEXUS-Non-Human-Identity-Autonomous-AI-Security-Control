'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { GraphNode, GraphEdge } from '@/lib/types/access';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Database, 
  Server, 
  Cpu, 
  Key, 
  FileText, 
  ArrowRight, 
  ShieldAlert, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  Network
} from 'lucide-react';
import Link from 'next/link';
import { formatTimestamp } from '@/lib/utils';

export default function AccessGraphPage() {
  const { user } = useAuth();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGraphData = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/access-graph');
      if (!res.ok) {
        throw new Error(`Failed to fetch access graph: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setNodes(json.data.nodes || []);
        setEdges(json.data.edges || []);

        if (json.data.nodes?.length > 0) {
          setSelectedNode(json.data.nodes[0]);
        } else {
          setSelectedNode(null);
        }
      } else {
        throw new Error(json.error || 'Failed to load access graph topology');
      }
    } catch (err: unknown) {
      console.error('Error fetching Access Graph telemetry:', err);
      setError('Unable to fetch access path topology from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchGraphData();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchGraphData]);

  const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.1));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).id === 'grid-rect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'Identity': return <Key className="w-4 h-4" />;
      case 'Agent': return <Cpu className="w-4 h-4" />;
      case 'Application':
      case 'API': return <Server className="w-4 h-4" />;
      case 'Database': return <Database className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Graph Traversal Logic
  const getHighlightState = (nodeId: string): 'selected' | 'active-path' | 'dimmed' => {
    if (selectedEdge) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) return 'selected';
      return 'dimmed';
    }
    if (!selectedNode) return 'selected';
    if (selectedNode.id === nodeId) return 'selected';

    // Highlight source and target dependencies
    const isSource = edges.some(e => e.source === nodeId && e.target === selectedNode.id);
    const isTarget = edges.some(e => e.source === selectedNode.id && e.target === nodeId);

    if (isSource || isTarget) return 'active-path';
    return 'dimmed';
  };

  const getEdgeHighlight = (edge: GraphEdge): boolean => {
    if (selectedEdge) return selectedEdge.id === edge.id;
    if (!selectedNode) return true;
    if (edge.source === selectedNode.id || edge.target === selectedNode.id) return true;
    return false;
  };

  const filteredNodes = nodes.filter(node => 
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Access Path Topology Map</h2>
          <p className="text-xs text-secondary mt-1">
            Visual graph mapping authorization flows, service endpoints, databases, and LLM boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchGraphData(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer"
            title="Refresh Graph Topology"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Search bar */}
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search nodes by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
            />
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchGraphData()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Main Canvas + Inspector */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* SVG Graph Canvas */}
        <div className="flex-grow bg-surface border border-border rounded-[12px] overflow-hidden relative min-h-[500px] flex items-stretch">
          
          {/* Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 bg-background/80 border border-border rounded-[8px] p-1.5 backdrop-blur-md">
            <button onClick={handleZoomIn} className="p-2 hover:bg-surface-top rounded text-secondary hover:text-white transition-colors cursor-pointer" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-surface-top rounded text-secondary hover:text-white transition-colors cursor-pointer" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleReset} className="p-2 hover:bg-surface-top rounded text-secondary hover:text-white transition-colors cursor-pointer" title="Recenter Map"><RotateCcw className="w-4 h-4" /></button>
          </div>

          <div className="absolute top-4 right-4 z-10 bg-background/80 border border-border rounded-[8px] px-3 py-1.5 text-[10px] text-muted font-bold tracking-wider uppercase backdrop-blur-md flex items-center gap-2">
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
            <span>Canvas drag & zoom active</span>
          </div>

          {isLoading ? (
            <div className="w-full h-full min-h-[500px] flex items-center justify-center text-xs text-muted">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 mr-2" />
              <span>Loading Access Graph topology...</span>
            </div>
          ) : nodes.length === 0 ? (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center text-xs text-muted p-8 text-center space-y-3">
              <Network className="w-10 h-10 text-muted opacity-40" />
              <p className="text-white font-semibold">No access relationships discovered</p>
              <p className="max-w-md text-secondary">
                Register non-human identities, AI agents, or target resources to visualize privilege topology paths.
              </p>
            </div>
          ) : (
            <svg
              className="w-full h-full min-h-[500px] select-none cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
                </pattern>

                <filter id="glow-crit" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect id="grid-rect" width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                
                {/* Draw Edges */}
                {edges.map((edge) => {
                  const sourceNode = nodes.find(n => n.id === edge.source);
                  const targetNode = nodes.find(n => n.id === edge.target);
                  
                  if (!sourceNode || !targetNode) return null;

                  const isEdgeHighlighted = getEdgeHighlight(edge);
                  const opacity = isEdgeHighlighted ? 'opacity-100' : 'opacity-15';
                  
                  let strokeColor = 'var(--border)';
                  let strokeWidth = '1.5';
                  let filter = undefined;
                  let dashArray = undefined;

                  if (isEdgeHighlighted) {
                    if (edge.status === 'critical') {
                      strokeColor = '#EF4444';
                      strokeWidth = '2.5';
                      filter = 'url(#glow-crit)';
                      dashArray = '5,5';
                    } else if (edge.status === 'warning') {
                      strokeColor = '#F59E0B';
                      strokeWidth = '2';
                      dashArray = '5,5';
                    } else {
                      strokeColor = '#10B981';
                      strokeWidth = '1.8';
                    }
                  }

                  const x1 = sourceNode.x + 160;
                  const y1 = sourceNode.y + 20;
                  const x2 = targetNode.x;
                  const y2 = targetNode.y + 20;
                  const pathString = `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;

                  return (
                    <g 
                      key={edge.id} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdge(edge);
                        setSelectedNode(null);
                      }}
                      className={`transition-opacity duration-200 cursor-pointer ${opacity}`}
                    >
                      <path
                        d={pathString}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashArray}
                        filter={filter}
                        className={dashArray ? 'animate-dash' : ''}
                      />
                    </g>
                  );
                })}

                {/* Draw Nodes */}
                {nodes.map((node) => {
                  const highlightState = getHighlightState(node.id);
                  const isSelected = highlightState === 'selected';
                  const isPath = highlightState === 'active-path';
                  const matchesSearch = filteredNodes.some(n => n.id === node.id);
                  
                  let opacity = 'opacity-30';
                  if (matchesSearch && (!selectedNode || isSelected || isPath)) {
                    opacity = 'opacity-100';
                  }

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => {
                        setSelectedNode(node);
                        setSelectedEdge(null);
                      }}
                      className={`cursor-pointer select-none transition-all duration-200 ${opacity}`}
                    >
                      <rect
                        width="160"
                        height="40"
                        rx="8"
                        fill="var(--surface)"
                        stroke={isSelected ? '#8B5CF6' : isPath ? '#9CA3AF' : 'var(--border)'}
                        strokeWidth={isSelected ? 2 : isPath ? 1.5 : 1}
                        className="transition-colors hover:fill-surface-top"
                      />

                      <circle
                        cx="14"
                        cy="20"
                        r="4.5"
                        className={`${
                          node.riskScore >= 80 ? 'fill-red-500' :
                          node.riskScore >= 60 ? 'fill-amber-500' : 'fill-green-500'
                        }`}
                      />

                      <text
                        x="28"
                        y="18"
                        fill="#F3F4F6"
                        fontSize="9"
                        fontWeight="600"
                      >
                        {node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label}
                      </text>

                      <text
                        x="28"
                        y="30"
                        fill="#6B7280"
                        fontSize="8"
                        fontFamily="monospace"
                      >
                        {node.type.toUpperCase()}
                      </text>

                      <g transform="translate(132, 13)">
                        <rect
                          width="20"
                          height="14"
                          rx="3"
                          fill={
                            node.riskScore >= 80 ? 'rgba(239, 68, 68, 0.1)' :
                            node.riskScore >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                          }
                        />
                        <text
                          x="10"
                          y="10"
                          textAnchor="middle"
                          fill={
                            node.riskScore >= 80 ? '#EF4444' :
                            node.riskScore >= 60 ? '#F59E0B' : '#10B981'
                          }
                          fontSize="7"
                          fontWeight="700"
                        >
                          {node.riskScore}
                        </text>
                      </g>
                    </g>
                  );
                })}

              </g>
            </svg>
          )}
        </div>

        {/* Sidebar Inspector Panel */}
        <div className="w-full lg:w-80 bg-surface border border-border rounded-[12px] p-5 shrink-0 flex flex-col justify-between space-y-6 min-h-[300px]">
          {selectedEdge ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Selected Relationship</span>
                  <h3 className="text-xs font-bold text-white leading-tight truncate">{selectedEdge.relationType}</h3>
                </div>
                <div className="p-1.5 bg-background border border-border text-purple-400 rounded-[6px] shrink-0">
                  <Network className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Source Entity</span>
                  <span className="text-white font-medium block truncate">
                    {nodes.find(n => n.id === selectedEdge.source)?.label || selectedEdge.source}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Target Entity</span>
                  <span className="text-white font-medium block truncate">
                    {nodes.find(n => n.id === selectedEdge.target)?.label || selectedEdge.target}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Granted By</span>
                  <span className="text-secondary font-mono text-[11px] block truncate">{selectedEdge.grantedBy}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Created At</span>
                  <span className="text-secondary text-[11px] block">{formatTimestamp(selectedEdge.createdAt)}</span>
                </div>
              </div>
            </div>
          ) : selectedNode ? (
            <div className="space-y-5">
              
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Selected Node</span>
                  <h3 className="text-xs font-bold text-white leading-tight truncate">{selectedNode.label}</h3>
                </div>
                
                <div className="p-1.5 bg-background border border-border text-purple-400 rounded-[6px] shrink-0">
                  {getNodeIcon(selectedNode.type)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs w-full min-w-0">
                <div className="min-w-0">
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Node Type</span>
                  <span className="text-white font-semibold mt-0.5 block truncate">{selectedNode.type}</span>
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Status</span>
                  <StatusBadge status={selectedNode.status} className="text-[9px] px-1.5 py-0.5" />
                </div>
                <div className="col-span-2 min-w-0">
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Risk Level</span>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <RiskBadge score={selectedNode.riskScore} className="text-[9px] px-2 py-0.5" />
                    <span className="text-[10px] text-secondary truncate">
                      {selectedNode.riskScore >= 80 ? 'Critical Severity' :
                       selectedNode.riskScore >= 60 ? 'High Severity' : 'Compliant / Secure'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Description</span>
                <p className="text-secondary leading-relaxed">{selectedNode.description}</p>
              </div>

              {selectedNode.riskScore >= 80 && (
                <div className="bg-critical-bg border border-critical-border rounded-[6px] p-3 text-[11px] space-y-2">
                  <div className="flex items-center gap-1.5 text-critical-text font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>High Risk Path Active!</span>
                  </div>
                  <p className="text-secondary leading-relaxed text-[10px]">
                    This node exhibits elevated permission risk vectors requiring governance policy review.
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center text-muted text-xs my-auto">
              Select a node or relationship link in the graph to inspect details.
            </div>
          )}

          {selectedNode && (
            <div className="pt-4 border-t border-border">
              {selectedNode.type === 'Identity' && (
                <Link
                  href={`/identities/${selectedNode.id}`}
                  className="bg-background hover:bg-surface-top text-white font-semibold text-xs py-2 px-3 rounded-[6px] flex items-center justify-center gap-2 border border-border transition-colors w-full"
                >
                  <span>Investigate Identity Profile</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </Link>
              )}
              {selectedNode.type === 'Agent' && (
                <Link
                  href={`/agents/${selectedNode.id}`}
                  className="bg-background hover:bg-surface-top text-white font-semibold text-xs py-2 px-3 rounded-[6px] flex items-center justify-center gap-2 border border-border transition-colors w-full"
                >
                  <span>Investigate Agent Profile</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </Link>
              )}
              {(selectedNode.type === 'Database' || selectedNode.type === 'API' || selectedNode.type === 'Resource') && (
                <Link
                  href="/resources"
                  className="bg-background hover:bg-surface-top text-white font-semibold text-xs py-2 px-3 rounded-[6px] flex items-center justify-center gap-2 border border-border transition-colors w-full"
                >
                  <span>View Resource Catalog</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </Link>
              )}
            </div>
          )}

        </div>

      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
      `}</style>

    </div>
  );
}

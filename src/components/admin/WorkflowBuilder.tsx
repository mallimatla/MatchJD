'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Circle,
  Diamond,
  Hexagon,
  Bot,
  Zap,
  GitBranch,
  Clock,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Copy,
  Plus,
  Save,
  ChevronRight,
  ChevronDown,
  X,
  GripVertical,
  ArrowRight,
  AlertTriangle,
  Mail,
  Database,
  Globe,
  Code,
  MessageSquare,
  Search,
  Filter,
  Sparkles,
  Brain,
  Cpu,
  Target,
  Timer,
  Upload,
  Download,
  Eye,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  position: { x: number; y: number };
  config: NodeConfig;
  inputs: string[];
  outputs: string[];
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourceOutput: string;
  targetNodeId: string;
  targetInput: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: WorkflowVariable[];
  triggers: WorkflowTrigger[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue: any;
  description: string;
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  config: any;
  enabled: boolean;
}

type NodeType =
  | 'trigger_manual'
  | 'trigger_schedule'
  | 'trigger_event'
  | 'trigger_document_upload'
  | 'ai_classifier'
  | 'ai_extractor'
  | 'ai_analyzer'
  | 'ai_summarizer'
  | 'ai_custom'
  | 'condition'
  | 'switch'
  | 'loop'
  | 'delay'
  | 'hitl_gate'
  | 'action_update_record'
  | 'action_create_record'
  | 'action_send_notification'
  | 'action_send_email'
  | 'action_webhook'
  | 'action_custom_code'
  | 'end_success'
  | 'end_failure';

interface NodeConfig {
  [key: string]: any;
}

// Node definitions
const NODE_CATEGORIES = {
  triggers: {
    label: 'Triggers',
    icon: Play,
    color: 'bg-green-500',
    nodes: [
      { type: 'trigger_manual', name: 'Manual Trigger', icon: Play, description: 'Start workflow manually' },
      { type: 'trigger_schedule', name: 'Schedule', icon: Clock, description: 'Run on a schedule' },
      { type: 'trigger_event', name: 'Event Trigger', icon: Zap, description: 'Triggered by system events' },
      { type: 'trigger_document_upload', name: 'Document Upload', icon: Upload, description: 'When document is uploaded' },
    ],
  },
  ai_agents: {
    label: 'AI Agents',
    icon: Bot,
    color: 'bg-purple-500',
    nodes: [
      { type: 'ai_classifier', name: 'Document Classifier', icon: Filter, description: 'AI classifies document type' },
      { type: 'ai_extractor', name: 'Data Extractor', icon: Search, description: 'Extract structured data from documents' },
      { type: 'ai_analyzer', name: 'Site Analyzer', icon: Target, description: 'Analyze site suitability' },
      { type: 'ai_summarizer', name: 'Summarizer', icon: FileText, description: 'Generate AI summaries' },
      { type: 'ai_custom', name: 'Custom AI Agent', icon: Brain, description: 'Custom AI prompt agent' },
    ],
  },
  logic: {
    label: 'Logic & Control',
    icon: GitBranch,
    color: 'bg-blue-500',
    nodes: [
      { type: 'condition', name: 'Condition', icon: GitBranch, description: 'If/else branching' },
      { type: 'switch', name: 'Switch', icon: Diamond, description: 'Multiple path routing' },
      { type: 'loop', name: 'Loop', icon: Circle, description: 'Iterate over items' },
      { type: 'delay', name: 'Delay', icon: Timer, description: 'Wait for specified time' },
      { type: 'hitl_gate', name: 'Human Review', icon: Users, description: 'Require human approval' },
    ],
  },
  actions: {
    label: 'Actions',
    icon: Zap,
    color: 'bg-orange-500',
    nodes: [
      { type: 'action_update_record', name: 'Update Record', icon: Database, description: 'Update database record' },
      { type: 'action_create_record', name: 'Create Record', icon: Plus, description: 'Create new record' },
      { type: 'action_send_notification', name: 'Send Notification', icon: MessageSquare, description: 'Send in-app notification' },
      { type: 'action_send_email', name: 'Send Email', icon: Mail, description: 'Send email notification' },
      { type: 'action_webhook', name: 'Webhook', icon: Globe, description: 'Call external API' },
      { type: 'action_custom_code', name: 'Custom Code', icon: Code, description: 'Execute custom code' },
    ],
  },
  end: {
    label: 'End Points',
    icon: Square,
    color: 'bg-gray-500',
    nodes: [
      { type: 'end_success', name: 'Success', icon: CheckCircle, description: 'Workflow completed successfully' },
      { type: 'end_failure', name: 'Failure', icon: XCircle, description: 'Workflow failed' },
    ],
  },
};

// Get node definition
const getNodeDef = (type: NodeType) => {
  for (const category of Object.values(NODE_CATEGORIES)) {
    const node = category.nodes.find(n => n.type === type);
    if (node) return { ...node, categoryColor: category.color };
  }
  return null;
};

// Default node configs
const getDefaultNodeConfig = (type: NodeType): NodeConfig => {
  switch (type) {
    case 'trigger_schedule':
      return { cron: '0 9 * * *', timezone: 'UTC' };
    case 'trigger_event':
      return { eventType: 'document.created', filters: {} };
    case 'ai_classifier':
      return {
        model: 'claude-3-sonnet',
        categories: ['lease', 'ppa', 'easement', 'title_report', 'survey'],
        confidenceThreshold: 0.8,
        prompt: 'Classify the following document into one of these categories: {categories}'
      };
    case 'ai_extractor':
      return {
        model: 'claude-3-sonnet',
        schema: {},
        prompt: 'Extract the following fields from the document: {fields}',
        validateOutput: true,
      };
    case 'ai_analyzer':
      return {
        model: 'claude-3-sonnet',
        analysisType: 'site_suitability',
        criteria: ['physical', 'zoning', 'environmental', 'grid', 'access'],
      };
    case 'ai_custom':
      return {
        model: 'claude-3-sonnet',
        systemPrompt: '',
        userPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
      };
    case 'condition':
      return {
        conditions: [
          { field: '', operator: 'equals', value: '', branch: 'true' }
        ],
        defaultBranch: 'false'
      };
    case 'switch':
      return {
        field: '',
        cases: [
          { value: '', branch: 'case1' }
        ],
        defaultBranch: 'default'
      };
    case 'delay':
      return { duration: 60, unit: 'seconds' };
    case 'hitl_gate':
      return {
        reviewType: 'approval',
        assignTo: 'auto',
        urgency: 'medium',
        timeout: 86400,
        timeoutAction: 'escalate',
        instructions: '',
      };
    case 'action_update_record':
      return { collection: '', recordId: '', updates: {} };
    case 'action_create_record':
      return { collection: '', data: {} };
    case 'action_send_notification':
      return { title: '', message: '', type: 'info', recipients: 'owner' };
    case 'action_send_email':
      return { to: '', subject: '', body: '', template: '' };
    case 'action_webhook':
      return { url: '', method: 'POST', headers: {}, body: {} };
    case 'action_custom_code':
      return { language: 'javascript', code: '// Your code here\nreturn data;' };
    default:
      return {};
  }
};

interface WorkflowBuilderProps {
  workflow: WorkflowDefinition;
  onChange: (workflow: WorkflowDefinition) => void;
  onSave: () => void;
  saving?: boolean;
}

export function WorkflowBuilder({ workflow, onChange, onSave, saving }: WorkflowBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['triggers', 'ai_agents']));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; output: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = workflow.nodes.find(n => n.id === selectedNodeId);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Add node from palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const nodeDef = getNodeDef(draggedNodeType);
    if (!nodeDef) return;

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: draggedNodeType,
      name: nodeDef.name,
      description: nodeDef.description,
      position: { x, y },
      config: getDefaultNodeConfig(draggedNodeType),
      inputs: draggedNodeType.startsWith('trigger_') ? [] : ['input'],
      outputs: draggedNodeType.startsWith('end_') ? [] : ['output'],
    };

    // Special outputs for logic nodes
    if (draggedNodeType === 'condition') {
      newNode.outputs = ['true', 'false'];
    } else if (draggedNodeType === 'switch') {
      newNode.outputs = ['case1', 'default'];
    }

    onChange({
      ...workflow,
      nodes: [...workflow.nodes, newNode],
    });

    setDraggedNodeType(null);
  }, [draggedNodeType, pan, zoom, workflow, onChange]);

  // Delete node
  const deleteNode = (nodeId: string) => {
    onChange({
      ...workflow,
      nodes: workflow.nodes.filter(n => n.id !== nodeId),
      connections: workflow.connections.filter(
        c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
      ),
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Update node
  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    onChange({
      ...workflow,
      nodes: workflow.nodes.map(n =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    });
  };

  // Update node config
  const updateNodeConfig = (nodeId: string, configUpdates: Partial<NodeConfig>) => {
    onChange({
      ...workflow,
      nodes: workflow.nodes.map(n =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...configUpdates } } : n
      ),
    });
  };

  // Add connection
  const addConnection = (sourceNodeId: string, sourceOutput: string, targetNodeId: string) => {
    // Check if connection already exists
    const exists = workflow.connections.some(
      c => c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
    );
    if (exists) return;

    const newConnection: WorkflowConnection = {
      id: `conn_${Date.now()}`,
      sourceNodeId,
      sourceOutput,
      targetNodeId,
      targetInput: 'input',
    };

    onChange({
      ...workflow,
      connections: [...workflow.connections, newConnection],
    });
  };

  // Delete connection
  const deleteConnection = (connectionId: string) => {
    onChange({
      ...workflow,
      connections: workflow.connections.filter(c => c.id !== connectionId),
    });
  };

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setConnectingFrom(null);
  };

  // Render connection line
  const renderConnection = (conn: WorkflowConnection) => {
    const sourceNode = workflow.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
    if (!sourceNode || !targetNode) return null;

    const sx = sourceNode.position.x + 220 + 3; // Right side of node + port offset
    const sy = sourceNode.position.y + 40;
    const tx = targetNode.position.x - 3; // Left side of node - port offset
    const ty = targetNode.position.y + 40;

    const midX = (sx + tx) / 2;
    const curveOffset = Math.min(Math.abs(tx - sx) / 2, 80);

    return (
      <g key={conn.id} className="cursor-pointer group" onClick={() => deleteConnection(conn.id)}>
        {/* Wider invisible path for easier clicking */}
        <path
          d={`M ${sx} ${sy} C ${sx + curveOffset} ${sy}, ${tx - curveOffset} ${ty}, ${tx} ${ty}`}
          stroke="transparent"
          strokeWidth="12"
          fill="none"
        />
        {/* Visible path */}
        <path
          d={`M ${sx} ${sy} C ${sx + curveOffset} ${sy}, ${tx - curveOffset} ${ty}, ${tx} ${ty}`}
          stroke="#94a3b8"
          strokeWidth="2"
          fill="none"
          className="group-hover:stroke-red-500 transition-colors"
          markerEnd="url(#arrowhead)"
        />
        {/* Delete indicator on hover */}
        <circle
          cx={(sx + tx) / 2}
          cy={(sy + ty) / 2}
          r="8"
          fill="white"
          stroke="#94a3b8"
          strokeWidth="2"
          className="opacity-0 group-hover:opacity-100 group-hover:fill-red-100 group-hover:stroke-red-500 transition-all"
        />
        <text
          x={(sx + tx) / 2}
          y={(sy + ty) / 2 + 4}
          textAnchor="middle"
          className="text-xs fill-red-500 opacity-0 group-hover:opacity-100 transition-all pointer-events-none"
        >
          ×
        </text>
      </g>
    );
  };

  // Node component
  const NodeComponent = ({ node }: { node: WorkflowNode }) => {
    const nodeDef = getNodeDef(node.type);
    if (!nodeDef) return null;

    const Icon = nodeDef.icon;
    const isSelected = selectedNodeId === node.id;
    const isConnectingTarget = connectingFrom && connectingFrom.nodeId !== node.id && node.inputs.length > 0;

    return (
      <div
        className={cn(
          'absolute bg-white border-2 rounded-lg shadow-lg w-[220px] cursor-move transition-all',
          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300',
          isConnectingTarget && 'ring-2 ring-blue-300 border-blue-400'
        )}
        style={{
          left: node.position.x,
          top: node.position.y,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNodeId(node.id);
        }}
        draggable
        onDragEnd={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          updateNode(node.id, {
            position: {
              x: (e.clientX - rect.left - pan.x) / zoom - 110,
              y: (e.clientY - rect.top - pan.y) / zoom - 40,
            },
          });
        }}
      >
        {/* Node Header */}
        <div className={cn('px-3 py-2 rounded-t-md flex items-center gap-2', nodeDef.categoryColor)}>
          <Icon className="w-4 h-4 text-white flex-shrink-0" />
          <span className="text-white text-sm font-medium truncate">{node.name}</span>
        </div>

        {/* Node Body */}
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500 line-clamp-2">{node.description}</p>
        </div>

        {/* Input Port - left side */}
        {node.inputs.length > 0 && (
          <div
            className={cn(
              'absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white cursor-pointer transition-all flex items-center justify-center shadow-sm',
              connectingFrom ? 'bg-blue-500 hover:bg-blue-600 scale-110' : 'bg-gray-400 hover:bg-primary'
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (connectingFrom) {
                addConnection(connectingFrom.nodeId, connectingFrom.output, node.id);
                setConnectingFrom(null);
              }
            }}
            title={connectingFrom ? 'Click to connect here' : 'Input port'}
          >
            {connectingFrom && (
              <ChevronRight className="w-3 h-3 text-white" />
            )}
          </div>
        )}

        {/* Output Ports - right side */}
        {node.outputs.map((output, i) => {
          const topPercent = node.outputs.length === 1 ? 50 : 30 + (i * 40 / Math.max(1, node.outputs.length - 1));
          return (
            <div
              key={output}
              className={cn(
                'absolute -right-3 w-6 h-6 rounded-full border-2 border-white cursor-pointer transition-all flex items-center justify-center shadow-sm',
                connectingFrom?.nodeId === node.id && connectingFrom?.output === output
                  ? 'bg-green-500 ring-2 ring-green-300 scale-110'
                  : 'bg-gray-400 hover:bg-green-500'
              )}
              style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}
              onClick={(e) => {
                e.stopPropagation();
                setConnectingFrom({ nodeId: node.id, output });
              }}
              title={`Click to connect from "${output}"`}
            >
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
          );
        })}

        {/* Output labels for multi-output nodes */}
        {node.outputs.length > 1 && (
          <div className="absolute -right-16 top-0 bottom-0 flex flex-col justify-center">
            {node.outputs.map((output, i) => {
              const topPercent = 30 + (i * 40 / Math.max(1, node.outputs.length - 1));
              return (
                <span
                  key={output}
                  className="text-xs text-gray-500 whitespace-nowrap absolute"
                  style={{ top: `${topPercent}%`, transform: 'translateY(-50%)', right: 0 }}
                >
                  {output}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] border rounded-lg overflow-hidden bg-gray-50">
      {/* Left Sidebar - Node Palette */}
      <div className="w-72 bg-white border-r overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900">Node Palette</h3>
          <p className="text-xs text-gray-500 mt-1">Drag nodes to canvas to add them</p>
        </div>

        <div className="p-3">
          {Object.entries(NODE_CATEGORIES).map(([key, category]) => (
            <div key={key} className="mb-3">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {expandedCategories.has(key) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <div className={cn('w-3 h-3 rounded', category.color)} />
                <span className="text-sm font-medium flex-1 text-left">{category.label}</span>
                <span className="text-xs text-gray-400">{category.nodes.length}</span>
              </button>

              {expandedCategories.has(key) && (
                <div className="mt-2 space-y-1 pl-2">
                  {category.nodes.map((node) => {
                    const Icon = node.icon;
                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={() => setDraggedNodeType(node.type as NodeType)}
                        onDragEnd={() => setDraggedNodeType(null)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-grab hover:bg-gray-100 active:cursor-grabbing border border-transparent hover:border-gray-200 transition-all"
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', category.color)}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{node.name}</p>
                          <p className="text-xs text-gray-500">{node.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Canvas Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => onChange({ ...workflow, name: e.target.value })}
              className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-0"
              placeholder="Workflow Name"
            />
            <Badge variant={workflow.enabled ? 'success' : 'secondary'}>
              {workflow.enabled ? 'Active' : 'Draft'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection Mode Indicator */}
            {connectingFrom && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm animate-pulse">
                <ArrowRight className="w-4 h-4" />
                <span>Click target node to connect</span>
                <button
                  onClick={() => setConnectingFrom(null)}
                  className="ml-1 p-0.5 hover:bg-blue-200 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="text-gray-600 hover:text-gray-900 px-1"
              >
                -
              </button>
              <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                className="text-gray-600 hover:text-gray-900 px-1"
              >
                +
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPan({ x: 0, y: 0 })}>
              Reset View
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* SVG for connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            {workflow.connections.map(renderConnection)}
          </svg>

          {/* Nodes */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            {workflow.nodes.map((node) => (
              <NodeComponent key={node.id} node={node} />
            ))}
          </div>

          {/* Empty state */}
          {workflow.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center max-w-md">
                <Workflow className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500">Start Building Your Workflow</h3>
                <p className="text-gray-400 mt-1">Drag nodes from the left panel to get started</p>
                <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border text-left">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">How to connect nodes:</h4>
                  <ol className="text-xs text-gray-500 space-y-1">
                    <li>1. Click the <span className="inline-block w-3 h-3 bg-gray-300 rounded-full align-middle mx-1"></span> output port (right side) of source node</li>
                    <li>2. Then click the <span className="inline-block w-3 h-3 bg-gray-300 rounded-full align-middle mx-1"></span> input port (left side) of target node</li>
                    <li>3. Click on a line to delete the connection</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Instructions when nodes exist but no connections */}
          {workflow.nodes.length > 0 && workflow.connections.length === 0 && !connectingFrom && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-full shadow-lg">
                Click the right port of a node to start connecting
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Node Config */}
      {selectedNode && (
        <div className="w-96 bg-white border-l overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Node Configuration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Configure node settings and behavior</p>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5">
            {/* Node Type Badge */}
            <div className="flex items-center gap-2">
              {(() => {
                const nodeDef = getNodeDef(selectedNode.type);
                if (!nodeDef) return null;
                const Icon = nodeDef.icon;
                return (
                  <div className={cn('px-3 py-1.5 rounded-lg flex items-center gap-2', nodeDef.categoryColor)}>
                    <Icon className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium">{selectedNode.type.replace(/_/g, ' ')}</span>
                  </div>
                );
              })()}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={selectedNode.description}
                  onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>

            {/* Type-specific config */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Node Settings</h4>
              {renderNodeConfig(selectedNode, updateNodeConfig)}
            </div>

            {/* Connection Info */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Connections</h4>
              <div className="space-y-2 text-sm">
                {selectedNode.inputs.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-3 h-3 bg-blue-400 rounded-full" />
                    <span>Inputs: {selectedNode.inputs.join(', ')}</span>
                  </div>
                )}
                {selectedNode.outputs.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-3 h-3 bg-green-400 rounded-full" />
                    <span>Outputs: {selectedNode.outputs.join(', ')}</span>
                  </div>
                )}
                {/* Show connected nodes */}
                {workflow.connections.filter(c => c.sourceNodeId === selectedNode.id || c.targetNodeId === selectedNode.id).length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Connected to:</p>
                    {workflow.connections
                      .filter(c => c.sourceNodeId === selectedNode.id || c.targetNodeId === selectedNode.id)
                      .map(c => {
                        const otherNodeId = c.sourceNodeId === selectedNode.id ? c.targetNodeId : c.sourceNodeId;
                        const otherNode = workflow.nodes.find(n => n.id === otherNodeId);
                        const direction = c.sourceNodeId === selectedNode.id ? '→' : '←';
                        return (
                          <div key={c.id} className="text-xs text-gray-600 flex items-center justify-between py-1">
                            <span>{direction} {otherNode?.name || 'Unknown'}</span>
                            <button
                              onClick={() => deleteConnection(c.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteNode(selectedNode.id)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Node
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Node-specific configuration UI
function renderNodeConfig(
  node: WorkflowNode,
  updateConfig: (nodeId: string, config: Partial<NodeConfig>) => void
) {
  const { type, config, id } = node;

  switch (type) {
    case 'trigger_schedule':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
            <input
              type="text"
              value={config.cron || ''}
              onChange={(e) => updateConfig(id, { cron: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              placeholder="0 9 * * *"
            />
            <p className="text-xs text-gray-500 mt-1">e.g., "0 9 * * *" = every day at 9am</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={config.timezone || 'UTC'}
              onChange={(e) => updateConfig(id, { timezone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
        </div>
      );

    case 'trigger_event':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={config.eventType || ''}
              onChange={(e) => updateConfig(id, { eventType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="document.created">Document Created</option>
              <option value="document.updated">Document Updated</option>
              <option value="project.created">Project Created</option>
              <option value="parcel.added">Parcel Added</option>
              <option value="workflow.completed">Workflow Completed</option>
              <option value="hitl.approved">HITL Approved</option>
              <option value="hitl.rejected">HITL Rejected</option>
            </select>
          </div>
        </div>
      );

    case 'ai_classifier':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <select
              value={config.model || 'claude-3-sonnet'}
              onChange={(e) => updateConfig(id, { model: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet (Balanced)</option>
              <option value="claude-3-haiku">Claude 3 Haiku (Fastest)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
            <textarea
              value={(config.categories || []).join('\n')}
              onChange={(e) => updateConfig(id, { categories: e.target.value.split('\n').filter(Boolean) })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={4}
              placeholder="One category per line"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confidence Threshold
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={config.confidenceThreshold || 0.8}
              onChange={(e) => updateConfig(id, { confidenceThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-sm text-gray-500 text-center">
              {Math.round((config.confidenceThreshold || 0.8) * 100)}%
            </p>
          </div>
        </div>
      );

    case 'ai_extractor':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <select
              value={config.model || 'claude-3-sonnet'}
              onChange={(e) => updateConfig(id, { model: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet (Balanced)</option>
              <option value="claude-3-haiku">Claude 3 Haiku (Fastest)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extraction Prompt</label>
            <textarea
              value={config.prompt || ''}
              onChange={(e) => updateConfig(id, { prompt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={4}
              placeholder="Instructions for data extraction"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.validateOutput || false}
              onChange={(e) => updateConfig(id, { validateOutput: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">Validate extracted data</label>
          </div>
        </div>
      );

    case 'ai_custom':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <select
              value={config.model || 'claude-3-sonnet'}
              onChange={(e) => updateConfig(id, { model: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet (Balanced)</option>
              <option value="claude-3-haiku">Claude 3 Haiku (Fastest)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              value={config.systemPrompt || ''}
              onChange={(e) => updateConfig(id, { systemPrompt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={3}
              placeholder="System instructions for the AI"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Prompt</label>
            <textarea
              value={config.userPrompt || ''}
              onChange={(e) => updateConfig(id, { userPrompt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={4}
              placeholder="User message template. Use {variable} for dynamic values."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature: {config.temperature || 0.7}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature || 0.7}
              onChange={(e) => updateConfig(id, { temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
            {(config.conditions || []).map((cond: any, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={cond.field}
                  onChange={(e) => {
                    const newConds = [...config.conditions];
                    newConds[i].field = e.target.value;
                    updateConfig(id, { conditions: newConds });
                  }}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  placeholder="Field"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => {
                    const newConds = [...config.conditions];
                    newConds[i].operator = e.target.value;
                    updateConfig(id, { conditions: newConds });
                  }}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="equals">=</option>
                  <option value="not_equals">!=</option>
                  <option value="greater">&gt;</option>
                  <option value="less">&lt;</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => {
                    const newConds = [...config.conditions];
                    newConds[i].value = e.target.value;
                    updateConfig(id, { conditions: newConds });
                  }}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  placeholder="Value"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newConds = [...(config.conditions || []), { field: '', operator: 'equals', value: '' }];
                updateConfig(id, { conditions: newConds });
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> Add Condition
            </Button>
          </div>
        </div>
      );

    case 'delay':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config.duration || 60}
                onChange={(e) => updateConfig(id, { duration: parseInt(e.target.value) })}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                min="1"
              />
              <select
                value={config.unit || 'seconds'}
                onChange={(e) => updateConfig(id, { unit: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        </div>
      );

    case 'hitl_gate':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
            <select
              value={config.reviewType || 'approval'}
              onChange={(e) => updateConfig(id, { reviewType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="approval">Approval Required</option>
              <option value="review">Review Only</option>
              <option value="edit">Edit & Approve</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
            <select
              value={config.urgency || 'medium'}
              onChange={(e) => updateConfig(id, { urgency: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
            <input
              type="number"
              value={config.timeout || 86400}
              onChange={(e) => updateConfig(id, { timeout: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={config.instructions || ''}
              onChange={(e) => updateConfig(id, { instructions: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={3}
              placeholder="Instructions for the reviewer"
            />
          </div>
        </div>
      );

    case 'action_send_notification':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={config.title || ''}
              onChange={(e) => updateConfig(id, { title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Notification title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={config.message || ''}
              onChange={(e) => updateConfig(id, { message: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={3}
              placeholder="Notification message"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={config.type || 'info'}
              onChange={(e) => updateConfig(id, { type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      );

    case 'action_webhook':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              value={config.url || ''}
              onChange={(e) => updateConfig(id, { url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="https://api.example.com/webhook"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              value={config.method || 'POST'}
              onChange={(e) => updateConfig(id, { method: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
            <textarea
              value={JSON.stringify(config.headers || {}, null, 2)}
              onChange={(e) => {
                try {
                  updateConfig(id, { headers: JSON.parse(e.target.value) });
                } catch {}
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              rows={3}
            />
          </div>
        </div>
      );

    case 'action_custom_code':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={config.language || 'javascript'}
              onChange={(e) => updateConfig(id, { language: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <textarea
              value={config.code || ''}
              onChange={(e) => updateConfig(id, { code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              rows={10}
              placeholder="// Your code here&#10;return data;"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500 italic">
          No additional configuration for this node type.
        </div>
      );
  }
}

export default WorkflowBuilder;

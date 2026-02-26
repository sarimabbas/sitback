import type { NodeProps } from '@xyflow/react'

type GraphNodeData = {
  todoId: number
  title: string
  lane: string
  tagPath: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: number | null
  dueDate: string | null
  blocked: boolean
  laneType: 'same_tag' | 'untagged' | 'default'
}

function statusPillClass(status: GraphNodeData['status']) {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  }
  if (status === 'in_progress') {
    return 'bg-sky-100 text-sky-800 border-sky-300'
  }
  return 'bg-amber-100 text-amber-800 border-amber-300'
}

function laneAccent(laneType: GraphNodeData['laneType']) {
  if (laneType === 'same_tag') {
    return 'border-slate-200 bg-white'
  }

  if (laneType === 'untagged') {
    return 'border-amber-300 bg-white'
  }

  return 'border-slate-200 bg-white'
}

export function TodoGraphNode({ data, selected }: NodeProps) {
  const node = data as GraphNodeData
  const laneBadgeClass =
    node.laneType === 'same_tag'
      ? 'border-cyan-300 bg-cyan-100 text-cyan-900'
      : node.laneType === 'untagged'
        ? 'border-amber-300 bg-amber-100 text-amber-900'
        : 'border-slate-300 bg-slate-100 text-slate-700'

  return (
    <div
      className={`flex h-[164px] w-[320px] flex-col rounded-xl border p-3 shadow-md transition-shadow ${laneAccent(node.laneType)} ${
        selected ? 'ring-2 ring-cyan-400 shadow-lg' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
          #{node.todoId}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${statusPillClass(node.status)}`}
        >
          {node.status}
        </span>
      </div>

      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{node.title}</p>

      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
        <p>
          <span className="font-medium text-slate-700">Tag:</span>{' '}
          <span className={`inline-flex rounded border px-1 py-0 ${laneBadgeClass}`}>
            {node.lane}
          </span>
        </p>
        <p>
          <span className="font-medium text-slate-700">Full tag:</span> {node.tagPath}
        </p>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-2 text-[11px] text-slate-600">
        <p>
          Priority <span className="font-medium text-slate-700">{node.priority ?? 'none'}</span>
          {'  |  '}
          Due <span className="font-medium text-slate-700">{node.dueDate ?? 'none'}</span>
        </p>
        <p>
          Blocked{' '}
          <span className={`font-medium ${node.blocked ? 'text-red-700' : 'text-emerald-700'}`}>
            {node.blocked ? 'yes' : 'no'}
          </span>
        </p>
      </div>
    </div>
  )
}

import type { NodeProps } from '@xyflow/react'

type GroupNodeData = {
  label: string
  laneType: 'same_tag' | 'untagged' | 'default'
}

function laneBadgeClasses(laneType: GroupNodeData['laneType']) {
  if (laneType === 'same_tag') {
    return 'border-cyan-300 bg-cyan-100 text-cyan-900'
  }

  if (laneType === 'untagged') {
    return 'border-amber-300 bg-amber-100 text-amber-900'
  }

  return 'border-slate-300 bg-slate-100 text-slate-700'
}

export function TodoGraphGroupNode({ data, selected }: NodeProps) {
  const group = data as GroupNodeData
  const badgeClasses = laneBadgeClasses(group.laneType)

  return (
    <div
      className={`h-full w-full rounded-2xl border border-slate-300 bg-slate-50/55 ${
        selected ? 'ring-1 ring-cyan-400' : ''
      }`}
    >
      <div className="rounded-t-2xl border-b border-slate-300 bg-slate-100/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
        <span className={`inline-flex rounded border px-1.5 py-0.5 ${badgeClasses}`}>
          {group.label}
        </span>
      </div>
    </div>
  )
}

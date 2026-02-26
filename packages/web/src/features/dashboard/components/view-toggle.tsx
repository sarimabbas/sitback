import { BarChart3, List } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { DashboardViewMode } from '../types'

type ViewToggleProps = {
  value: DashboardViewMode
  onChange: (next: DashboardViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
      <Button
        type="button"
        variant={value === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('list')}
        className="gap-1"
      >
        <List className="size-4" />
        List
      </Button>
      <Button
        type="button"
        variant={value === 'graph' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('graph')}
        className="gap-1"
      >
        <BarChart3 className="size-4" />
        Graph
      </Button>
    </div>
  )
}

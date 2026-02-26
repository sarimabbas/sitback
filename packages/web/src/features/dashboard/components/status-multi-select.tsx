import { Check, ChevronsUpDown, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { DashboardTodoStatus } from '../types'

const STATUS_OPTIONS: Array<{ value: DashboardTodoStatus; label: string }> = [
  { value: 'todo', label: 'todo' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'completed', label: 'completed' },
  { value: 'cancelled', label: 'cancelled' },
]

type StatusMultiSelectProps = {
  value: DashboardTodoStatus[]
  onChange: (next: DashboardTodoStatus[]) => void
}

export function StatusMultiSelect({ value, onChange }: StatusMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(value), [value])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return STATUS_OPTIONS
    }

    return STATUS_OPTIONS.filter((option) => option.label.includes(normalized))
  }, [query])

  const triggerLabel =
    value.length === 0
      ? 'All statuses'
      : value.length <= 2
        ? value.join(', ')
        : `${value.length} statuses`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            name="status-filter"
            aria-label="Filter statuses"
            autoComplete="off"
            value={query}
            onValueChange={setQuery}
            placeholder="Filter statuses…"
          />
          <CommandList>
            <CommandEmpty>No status found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange([])
                }}
              >
                <Check className={cn('mr-2 size-4', value.length === 0 ? 'opacity-100' : 'opacity-0')} />
                All statuses
              </CommandItem>
              {filtered.map((option) => {
                const selected = selectedSet.has(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      if (selected) {
                        onChange(value.filter((status) => status !== option.value))
                        return
                      }

                      onChange([...value, option.value])
                    }}
                  >
                    <Check className={cn('mr-2 size-4', selected ? 'opacity-100' : 'opacity-0')} />
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 ? (
          <div className="border-t border-slate-200 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-slate-600"
              onClick={() => onChange([])}
            >
              <X className="mr-1 size-3" />
              Clear status filters
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

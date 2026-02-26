import { Check, X } from 'lucide-react'
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

import { cn } from '@/lib/utils'

import type { DashboardTodo } from '../types'

type PredecessorPickerProps = {
  selectedIds: number[]
  todos: DashboardTodo[]
  selfId?: number
  onChange: (ids: number[]) => void
}

export function PredecessorPicker({
  selectedIds,
  todos,
  selfId,
  onChange,
}: PredecessorPickerProps) {
  const [query, setQuery] = useState('')

  const available = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return todos
      .filter((todo) => todo.id !== selfId)
      .filter((todo) => {
        if (!normalized) {
          return true
        }

        return (
          String(todo.id).includes(normalized) ||
          todo.description.toLowerCase().includes(normalized)
        )
      })
      .slice(0, 30)
  }, [query, selfId, todos])

  const selectedTodos = useMemo(
    () =>
      selectedIds
        .map((id) => todos.find((todo) => todo.id === id))
        .filter((todo): todo is DashboardTodo => Boolean(todo)),
    [selectedIds, todos],
  )

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-slate-200">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search by ID or title (arrow keys + enter)"
          />
          <CommandList>
            <CommandEmpty>No matching todo.</CommandEmpty>
            <CommandGroup>
              {available.map((todo) => {
                const isSelected = selectedIds.includes(todo.id)

                return (
                  <CommandItem
                    key={todo.id}
                    value={`${todo.id}-${todo.description}`}
                    onSelect={() => {
                      if (isSelected) {
                        onChange(selectedIds.filter((candidateId) => candidateId !== todo.id))
                        return
                      }

                      onChange([...selectedIds, todo.id])
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    #{todo.id} - {todo.description}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>

      {selectedTodos.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTodos.map((todo) => (
            <span
              key={todo.id}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs"
            >
              #{todo.id} {todo.description}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onChange(selectedIds.filter((candidateId) => candidateId !== todo.id))
                }
              >
                <X className="size-3" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

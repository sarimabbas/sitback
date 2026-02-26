import { Check, ChevronsUpDown } from 'lucide-react'
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

type AssigneeComboboxProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
}

export function AssigneeCombobox({ value, options, onChange }: AssigneeComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return options.slice(0, 12)
    }

    return options.filter((option) => option.toLowerCase().includes(normalized)).slice(0, 12)
  }, [options, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || 'Select assignee (optional)'}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search assignees"
          />
          <CommandList>
            <CommandEmpty>No assignee found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                  setQuery('')
                }}
              >
                <Check className={cn('mr-2 size-4', value ? 'opacity-0' : 'opacity-100')} />
                No assignee
              </CommandItem>
              {filtered.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <Check
                    className={cn('mr-2 size-4', value === option ? 'opacity-100' : 'opacity-0')}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

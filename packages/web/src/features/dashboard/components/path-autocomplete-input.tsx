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

type PathAutocompleteInputProps = {
  value: string
  options: string[]
  placeholder?: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
}

export function PathAutocompleteInput({
  value,
  options,
  placeholder,
  onChange,
  onSelect,
}: PathAutocompleteInputProps) {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return options.slice(0, 16)
    }

    return options.filter((option) => option.startsWith(normalized)).slice(0, 16)
  }, [options, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between overflow-hidden"
        >
          <span className="truncate text-left">{value || placeholder || 'Select tag path'}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            name="tag-path-filter"
            aria-label="Filter by tag path"
            autoComplete="off"
            value={value}
            onValueChange={(next) => onChange(next.toLowerCase())}
            placeholder={placeholder ? `${placeholder.replace(/\.\.\.$/, '').replace(/…$/, '')}…` : 'Type tag path…'}
          />
          <CommandList>
            <CommandEmpty>No matching tag path.</CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onSelect(option)
                    setOpen(false)
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

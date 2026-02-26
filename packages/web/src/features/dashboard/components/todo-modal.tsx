import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { flattenTagTree } from '../lib/filtering'
import type { DashboardTagNode, DashboardTodo } from '../types'
import { AssigneeCombobox } from './assignee-combobox'
import { PathAutocompleteInput } from './path-autocomplete-input'
import { PredecessorPicker } from './predecessor-picker'

type TodoModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  initialTagId?: number | null
  todo?: DashboardTodo
  predecessorIds?: number[]
  tagTree: DashboardTagNode[]
  allTodos: DashboardTodo[]
  onOpenChange: (open: boolean) => void
  onCreateTodo: (input: {
    description: string
    status: DashboardTodo['status']
    tagId: number | null
    priority: number | null
    dueDate: string | null
    assignee: string | null
    assigneeLease: string | null
    workNotes: string | null
    predecessorIds: number[]
  }) => Promise<void>
  onUpdateTodo: (id: number, changes: Partial<DashboardTodo>) => Promise<void>
  onDeleteTodo: (id: number) => Promise<void>
  onSetPredecessors: (id: number, predecessorIds: number[]) => Promise<void>
}

type TodoFormState = {
  description: string
  status: DashboardTodo['status']
  tagId: number | null
  tagPathInput: string
  priority: string
  dueDate: string
  assignee: string
  assigneeLease: string
  workNotes: string
  predecessorIds: number[]
}

const EMPTY_FORM: TodoFormState = {
  description: '',
  status: 'todo',
  tagId: null,
  tagPathInput: '',
  priority: '',
  dueDate: '',
  assignee: '',
  assigneeLease: '',
  workNotes: '',
  predecessorIds: [],
}

function toFormState(
  todo: DashboardTodo,
  predecessorIds: number[],
  tagPathById: Map<number, string>,
): TodoFormState {
  const normalizedWorkNotes = (todo.workNotes ?? '').replace(/\\n/g, '\n')

  return {
    description: todo.description,
    status: todo.status,
    tagId: todo.tagId,
    tagPathInput: todo.tagId ? (tagPathById.get(todo.tagId) ?? '') : '',
    priority: todo.priority === null ? '' : String(todo.priority),
    dueDate: todo.dueDate ?? '',
    assignee: todo.assignee ?? '',
    assigneeLease: todo.assigneeLease ?? '',
    workNotes: normalizedWorkNotes,
    predecessorIds,
  }
}

export function TodoModal({
  open,
  mode,
  initialTagId = null,
  todo,
  predecessorIds = [],
  tagTree,
  allTodos,
  onOpenChange,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onSetPredecessors,
}: TodoModalProps) {
  const [form, setForm] = useState<TodoFormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tagOptions = useMemo(() => flattenTagTree(tagTree), [tagTree])
  const tagPaths = useMemo(() => tagOptions.map((tag) => tag.path), [tagOptions])
  const tagIdByPath = useMemo(
    () => new Map(tagOptions.map((tag) => [tag.path, tag.id])),
    [tagOptions],
  )
  const tagPathById = useMemo(
    () => new Map(tagOptions.map((tag) => [tag.id, tag.path])),
    [tagOptions],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    if (mode === 'edit' && todo) {
      setForm(toFormState(todo, predecessorIds, tagPathById))
      return
    }

    const initialTagPath =
      initialTagId === null ? '' : (tagPathById.get(initialTagId) ?? '')

    setForm({
      ...EMPTY_FORM,
      tagId: initialTagId,
      tagPathInput: initialTagPath,
    })
  }, [initialTagId, mode, open, predecessorIds, tagPathById, todo])

  const handleSave = async () => {
    const description = form.description.trim()
    if (!description) {
      return
    }

    const parsedPriority =
      form.priority.trim() === '' ? null : Number(form.priority)

    if (parsedPriority !== null && (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 5)) {
      toast.error('Priority must be an integer between 1 and 5')
      return
    }

    setIsSubmitting(true)
    try {
      const normalized = {
        description,
        status: form.status,
        tagId: form.tagId,
        priority: parsedPriority,
        dueDate: form.dueDate.trim() === '' ? null : form.dueDate,
        assignee: form.assignee.trim() === '' ? null : form.assignee,
        assigneeLease:
          form.assigneeLease.trim() === '' ? null : form.assigneeLease,
        workNotes: form.workNotes.trim() === '' ? null : form.workNotes,
      }

      if (mode === 'create') {
        await onCreateTodo({
          ...normalized,
          predecessorIds: form.predecessorIds,
        })
      } else if (todo) {
        await onUpdateTodo(todo.id, normalized)
        await onSetPredecessors(todo.id, form.predecessorIds)
      }

      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save todo'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!todo) {
      return
    }

    setIsSubmitting(true)
    try {
      await onDeleteTodo(todo.id)
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete todo'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Todo' : `Edit Todo #${todo?.id ?? ''}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new todo quickly.'
              : 'Update todo fields and dependency links.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Description</p>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Status</p>
            <Select
              value={form.status}
              onValueChange={(value: DashboardTodo['status']) =>
                setForm((current) => ({ ...current, status: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">todo</SelectItem>
                <SelectItem value="in_progress">in_progress</SelectItem>
                <SelectItem value="completed">completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Tag Path</p>
            <PathAutocompleteInput
              value={form.tagPathInput}
              options={tagPaths}
              placeholder="Start typing tag path"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  tagPathInput: value,
                  tagId: tagIdByPath.get(value.trim().toLowerCase()) ?? null,
                }))
              }
              onSelect={(value) =>
                setForm((current) => ({
                  ...current,
                  tagPathInput: value,
                  tagId: tagIdByPath.get(value) ?? null,
                }))
              }
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Priority</p>
            <Input
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value }))
              }
              placeholder="1-5"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Due Date</p>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Assignee</p>
            <AssigneeCombobox
              value={form.assignee}
              options={Array.from(
                new Set(
                  allTodos
                    .map((candidate) => candidate.assignee)
                    .filter((candidate): candidate is string => Boolean(candidate?.trim())),
                ),
              )}
              onChange={(value) => setForm((current) => ({ ...current, assignee: value }))}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Assignee Lease</p>
            <Input
              value={form.assigneeLease}
              onChange={(event) =>
                setForm((current) => ({ ...current, assigneeLease: event.target.value }))
              }
              placeholder="YYYY-MM-DD HH:MM:SS"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Predecessors</p>
            <PredecessorPicker
              selectedIds={form.predecessorIds}
              todos={allTodos}
              selfId={todo?.id}
              onChange={(ids) =>
                setForm((current) => ({
                  ...current,
                  predecessorIds: ids,
                }))
              }
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Work Notes</p>
            <Textarea
              rows={4}
              value={form.workNotes}
              onChange={(event) =>
                setForm((current) => ({ ...current, workNotes: event.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {mode === 'edit' && todo ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSave()}>
            {mode === 'create' ? 'Add Todo' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

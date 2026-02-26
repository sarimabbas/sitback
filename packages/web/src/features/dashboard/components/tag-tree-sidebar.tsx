import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { DashboardTagNode } from '../types'

type TagTreeSidebarProps = {
  tagTree: DashboardTagNode[]
  selectedTagId: number | null
  selectedUntagged: boolean
  directCountByTagId: Map<number, number>
  totalCountByTagId: Map<number, number>
  onSelectTag: (tagId: number | null) => void
  onSelectUntagged: () => void
  onRenameTag: (tagId: number, name: string) => Promise<void>
  onDeleteTag: (tagId: number) => Promise<void>
  onCreateTag: (name: string, parentId: number | null) => Promise<void>
}

type TagNodeItemProps = {
  node: DashboardTagNode
  depth: number
  isLast: boolean
  selectedTagId: number | null
  directCountByTagId: Map<number, number>
  totalCountByTagId: Map<number, number>
  onSelectTag: (tagId: number) => void
  onRenameTag: (tagId: number, name: string) => Promise<void>
  onDeleteTag: (tagId: number) => Promise<void>
}

function TagNodeItem({
  node,
  depth,
  isLast,
  selectedTagId,
  directCountByTagId,
  totalCountByTagId,
  onSelectTag,
  onRenameTag,
  onDeleteTag,
}: TagNodeItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(node.name)
  const [isPending, setIsPending] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  const isSelected = node.id === selectedTagId
  const hasChildren = node.children.length > 0
  const directCount = directCountByTagId.get(node.id) ?? 0
  const totalCount = totalCountByTagId.get(node.id) ?? 0

  const handleRename = async () => {
    const nextName = nameDraft.trim().toLowerCase()
    if (!nextName || nextName === node.name) {
      setIsRenaming(false)
      setNameDraft(node.name)
      return
    }

    setIsPending(true)
    try {
      await onRenameTag(node.id, nextName)
      setIsRenaming(false)
    } finally {
      setIsPending(false)
    }
  }

  const handleDelete = async () => {
    setIsPending(true)
    try {
      await onDeleteTag(node.id)
    } finally {
      setIsPending(false)
    }
  }

  const row = (
    <div
      className={`group relative flex items-center gap-1 rounded-md pr-1 transition-colors ${
        isSelected
          ? 'bg-amber-100 text-amber-900'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      }`}
      style={{ paddingLeft: `${depth * 14 + 6}px` }}
    >
      {depth > 0 ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0">
          {Array.from({ length: depth }, (_unused, guideDepth) => guideDepth + 1).map((guideDepth) => (
            <span
              key={`${node.id}-${guideDepth}`}
              className={`absolute w-px ${isSelected ? 'bg-amber-200' : 'bg-slate-200'}`}
              style={{
                left: `${(guideDepth - 1) * 14 + 10}px`,
                top: guideDepth === depth && isLast ? '0' : '-4px',
                bottom: guideDepth === depth && isLast ? '50%' : '-4px',
              }}
            />
          ))}
        </span>
      ) : null}

      {hasChildren ? (
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : 'rotate-0'}`}
        />
      ) : null}

      {isRenaming ? (
        <Input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => void handleRename()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleRename()
            }
            if (event.key === 'Escape') {
              setIsRenaming(false)
              setNameDraft(node.name)
            }
          }}
          className="h-7"
          autoFocus
          disabled={isPending}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelectTag(node.id)}
            className="min-w-0 flex-1 px-1 py-1.5 text-left text-sm"
          >
            <span className="block truncate">{node.name}</span>
          </button>
          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            {directCount}|{totalCount}
          </span>
        </>
      )}

      {!isRenaming ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100"
            disabled={isPending}
            onClick={() => {
              setIsRenaming(true)
              setNameDraft(node.name)
            }}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 text-red-700 group-hover:opacity-100"
            disabled={isPending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-3" />
          </Button>
        </>
      ) : null}
    </div>
  )

  if (!hasChildren) {
    return <li>{row}</li>
  }

  return (
    <li>
      <details
        open={isOpen}
        onToggle={(event) => {
          setIsOpen((event.currentTarget as HTMLDetailsElement).open)
        }}
      >
        <summary className="list-none [&::-webkit-details-marker]:hidden">{row}</summary>
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child, index) => (
            <TagNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              selectedTagId={selectedTagId}
              directCountByTagId={directCountByTagId}
              totalCountByTagId={totalCountByTagId}
              onSelectTag={onSelectTag}
              onRenameTag={onRenameTag}
              onDeleteTag={onDeleteTag}
            />
          ))}
        </ul>
      </details>
    </li>
  )
}

export function TagTreeSidebar({
  tagTree,
  selectedTagId,
  selectedUntagged,
  directCountByTagId,
  totalCountByTagId,
  onSelectTag,
  onSelectUntagged,
  onRenameTag,
  onDeleteTag,
  onCreateTag,
}: TagTreeSidebarProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const handleCreate = async () => {
    const nextName = newTagName.trim().toLowerCase()
    if (!nextName) {
      setIsAdding(false)
      setNewTagName('')
      return
    }

    await onCreateTag(nextName, selectedTagId)
    setIsAdding(false)
    setNewTagName('')
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3 px-2 py-1">
        <img
          src="/relax.png"
          width={56}
          height={56}
          alt="Sitback logo"
          className="rounded-lg object-cover shadow-sm"
        />
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sitback</h2>
      </div>

      <div className="mb-3 border-t border-slate-200 px-2 pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Tag Tree
      </div>

      <Button
        type="button"
        variant={selectedTagId === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelectTag(null)}
        className="mb-3 w-full justify-start"
      >
        All tags
      </Button>

      <Button
        type="button"
        variant={selectedUntagged ? 'default' : 'outline'}
        size="sm"
        onClick={onSelectUntagged}
        className="mb-3 w-full justify-start"
      >
        Untagged todos
      </Button>

      {isAdding ? (
        <div className="mb-3 space-y-2">
          <Input
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onBlur={() => void handleCreate()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleCreate()
              }
              if (event.key === 'Escape') {
                setIsAdding(false)
                setNewTagName('')
              }
            }}
            autoFocus
            placeholder={selectedTagId ? 'New child tag name' : 'New root tag name'}
            className="h-8"
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-3 w-full justify-start"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="size-4" />
          Add tag
        </Button>
      )}

      {tagTree.length === 0 ? (
        <p className="px-2 text-sm text-slate-500">No tags yet.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className="space-y-0.5">
            {tagTree.map((node, index) => (
              <TagNodeItem
                key={node.id}
                node={node}
                depth={0}
                isLast={index === tagTree.length - 1}
                selectedTagId={selectedTagId}
                directCountByTagId={directCountByTagId}
                totalCountByTagId={totalCountByTagId}
                onSelectTag={onSelectTag}
                onRenameTag={onRenameTag}
                onDeleteTag={onDeleteTag}
              />
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

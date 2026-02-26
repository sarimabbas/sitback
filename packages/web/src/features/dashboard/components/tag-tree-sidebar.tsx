import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { DashboardTagNode } from '../types'

type TagTreeSidebarProps = {
  tagTree: DashboardTagNode[]
  selectedTagId: number | null
  selectedUntagged: boolean
  onSelectTag: (tagId: number | null) => void
  onSelectUntagged: () => void
  onRenameTag: (tagId: number, name: string) => Promise<void>
  onDeleteTag: (tagId: number) => Promise<void>
  onCreateTag: (name: string, parentId: number | null) => Promise<void>
}

type TagNodeItemProps = {
  node: DashboardTagNode
  depth: number
  selectedTagId: number | null
  onSelectTag: (tagId: number) => void
  onRenameTag: (tagId: number, name: string) => Promise<void>
  onDeleteTag: (tagId: number) => Promise<void>
}

function TagNodeItem({
  node,
  depth,
  selectedTagId,
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
      className={`group flex items-center gap-1 rounded-md pr-1 transition-colors ${
        isSelected
          ? 'bg-amber-100 text-amber-900'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      }`}
      style={{ paddingLeft: `${depth * 14 + 6}px` }}
    >
      {hasChildren ? (
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : 'rotate-0'}`}
        />
      ) : (
        <span className="size-3 shrink-0" />
      )}

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
        <button
          type="button"
          onClick={() => onSelectTag(node.id)}
          className="min-w-0 flex-1 px-1 py-1.5 text-left text-sm"
        >
          <span className="block truncate">{node.name}</span>
        </button>
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
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TagNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedTagId={selectedTagId}
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
      <div className="mb-3 flex items-center gap-2 px-2">
        <FolderTree className="size-4 text-amber-700" />
        <h2 className="text-sm font-semibold text-slate-900">Tag Tree</h2>
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
          <ul className="space-y-1">
            {tagTree.map((node) => (
              <TagNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectedTagId={selectedTagId}
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

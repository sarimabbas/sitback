import { todoDependenciesTable } from "../schema";
import { getTags } from "./tags";
import { getTodos } from "./todos";
import type { DbClient, ExportTagNode, ExportTodoNode } from "./types";

export async function getExportTree(db: DbClient): Promise<{
  tagTree: ExportTagNode[];
  todoTree: ExportTodoNode[];
}> {
  const [tags, todos, dependencies] = await Promise.all([
    getTags(db),
    getTodos(db),
    db.select().from(todoDependenciesTable)
  ]);

  const tagNodesById = new Map<number, ExportTagNode>();

  for (const tag of tags) {
    tagNodesById.set(tag.id, {
      id: tag.id,
      name: tag.name,
      parentId: tag.parentId ?? null,
      children: []
    });
  }

  const tagTree: ExportTagNode[] = [];

  for (const node of tagNodesById.values()) {
    if (node.parentId === null) {
      tagTree.push(node);
      continue;
    }

    const parent = tagNodesById.get(node.parentId);
    if (!parent) {
      tagTree.push(node);
      continue;
    }

    parent.children.push(node);
  }

  const sortTagTree = (nodes: ExportTagNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    for (const node of nodes) {
      sortTagTree(node.children);
    }
  };

  sortTagTree(tagTree);

  const todoNodesById = new Map<number, ExportTodoNode>();

  for (const todo of todos) {
    todoNodesById.set(todo.id, {
      id: todo.id,
      description: todo.description,
      status: todo.status,
      tagId: todo.tagId ?? null,
      workNotes: todo.workNotes ?? null,
      priority: todo.priority ?? null,
      dueDate: todo.dueDate ?? null,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      isBlocked: todo.isBlocked,
      predecessorIds: [],
      children: []
    });
  }

  for (const dep of dependencies) {
    const predecessor = todoNodesById.get(dep.predecessorId);
    const successor = todoNodesById.get(dep.successorId);

    if (!predecessor || !successor) {
      continue;
    }

    successor.predecessorIds.push(dep.predecessorId);
    predecessor.children.push(successor);
  }

  for (const node of todoNodesById.values()) {
    node.predecessorIds.sort((a, b) => a - b);
    node.children.sort((a, b) => a.id - b.id);
  }

  const todoTree = Array.from(todoNodesById.values())
    .filter((node) => node.predecessorIds.length === 0)
    .sort((a, b) => a.id - b.id);

  return {
    tagTree,
    todoTree
  };
}

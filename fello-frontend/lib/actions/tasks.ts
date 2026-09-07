import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { ActionResult, Task } from "@/lib/types"

const TASK_STATUSES: Task["status"][] = [
  "unassigned",
  "assigned",
  "in_progress",
  "completed",
  "blocked",
]

export interface CreateProjectTaskInput {
  orgId: string
  tenantId: string
  projectId: string
  title: string
  description: string
  assignedTo: string[]
  dueDate: string | null
  createdBy: string
}

/** Mirrors fello-agent/skills/tasks.py::create_task's write shape exactly. */
export async function createProjectTask(
  input: CreateProjectTaskInput
): Promise<ActionResult<{ taskId: string }>> {
  try {
    const taskId = `task_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
    const task: Task = {
      id: taskId,
      orgId: input.orgId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      assignedTo: input.assignedTo,
      status: input.assignedTo.length > 0 ? "assigned" : "unassigned",
      dueDate: input.dueDate,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      sourceMessageId: null,
    }
    await setDoc(doc(db, "tasks", taskId), task)
    return { data: { taskId }, error: null }
  } catch (error) {
    console.error("Failed to create task:", error)
    return { data: null, error: "Failed to create task." }
  }
}

/** Mirrors fello-agent/skills/tasks.py::assign_task's update shape exactly. */
export async function assignProjectTask(
  taskId: string,
  assigneeUids: string[]
): Promise<ActionResult<null>> {
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      assignedTo: assigneeUids,
      status: assigneeUids.length > 0 ? "assigned" : "unassigned",
    })
    return { data: null, error: null }
  } catch (error) {
    console.error("Failed to assign task:", error)
    return { data: null, error: "Failed to assign task." }
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: Task["status"]
): Promise<ActionResult<null>> {
  if (!TASK_STATUSES.includes(status)) {
    return { data: null, error: `Invalid status. Must be one of: ${TASK_STATUSES.join(", ")}` }
  }
  try {
    await updateDoc(doc(db, "tasks", taskId), { status })
    return { data: null, error: null }
  } catch (error) {
    console.error("Failed to update task status:", error)
    return { data: null, error: "Failed to update task status." }
  }
}

export async function listProjectTasks(
  orgId: string,
  projectId: string
): Promise<ActionResult<Task[]>> {
  try {
    const q = query(
      collection(db, "tasks"),
      where("orgId", "==", orgId),
      where("projectId", "==", projectId)
    )
    const snap = await getDocs(q)
    return { data: snap.docs.map((d) => d.data() as Task), error: null }
  } catch (error) {
    console.error("Failed to list tasks:", error)
    return { data: null, error: "Failed to load tasks." }
  }
}

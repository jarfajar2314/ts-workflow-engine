import { WorkflowEventMap } from "../core/events";

export interface EventAdapter {
  onWorkflowStart?(payload: WorkflowEventMap["workflowStart"]): void | Promise<void>;
  onStepChange?(payload: WorkflowEventMap["stepChange"]): void | Promise<void>;
  onWorkflowComplete?(payload: WorkflowEventMap["workflowComplete"]): void | Promise<void>;
  onWorkflowReject?(payload: WorkflowEventMap["workflowReject"]): void | Promise<void>;
  onError?(payload: WorkflowEventMap["error"]): void | Promise<void>;
}

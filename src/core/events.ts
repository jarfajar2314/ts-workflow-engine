import { WorkflowDefinition, WorkflowInstance } from "./types";

export type WorkflowEventMap = {
  workflowStart: {
    instance: WorkflowInstance;
    blueprint: WorkflowDefinition;
    actorId: string;
  };
  stepChange: {
    instance: WorkflowInstance;
    fromStepId: string;
    toStepId: string;
    action: "APPROVE" | "REJECT";
    actorId: string;
    comment?: string;
  };
  workflowComplete: {
    instance: WorkflowInstance;
    fromStepId: string;
    action: "APPROVE";
    actorId: string;
    comment?: string;
  };
  workflowReject: {
    instance: WorkflowInstance;
    fromStepId: string;
    action: "REJECT";
    actorId: string;
    comment?: string;
  };
  error: {
    event: keyof WorkflowEventMap;
    error: Error;
    payload: any;
  };
};

export type WorkflowEventType = keyof WorkflowEventMap;

export type WorkflowEventListener<K extends WorkflowEventType> = (
  payload: WorkflowEventMap[K]
) => void | Promise<void>;

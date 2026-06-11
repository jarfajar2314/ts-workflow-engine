export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';
export type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
export type ApproverStrategy = 'USER' | 'ROLE' | 'MANAGER' | 'ANY' | 'DYNAMIC';

/**
 * THE BLUEPRINT: How a single step is configured
 */
export interface StepDefinition {
  stepId: string;           // e.g., 'HR_APPROVAL'
  name: string;             // e.g., 'HR Document Verification'
  approverStrategy: ApproverStrategy;
  approverValue: string;    // e.g., 'hr_admin' or an actual User ID
  
  // Routing Logic
  onApprove: string | 'COMPLETE';  // The ID of the next step, or end workflow
  onReject: string | 'TERMINATE';  // The ID of a step to "Send Back" to, or kill workflow
}

/**
 * THE BLUEPRINT: The entire workflow schema
 */
export interface WorkflowDefinition {
  code: string;             // e.g., 'LEAVE_REQUEST'
  version: number;
  initialStepId: string;    // Where does the engine start?
  steps: Record<string, StepDefinition>; // A lookup map of all steps
}

/**
 * THE LIVE STATE: A currently running workflow
 */
export interface WorkflowInstance {
  id: string;               // Unique ID for this specific run
  workflowCode: string;
  workflowVersion: number;
  refType: string;          // e.g., 'document' or 'expense_report'
  refId: string;            // The ID of the document in the host application
  status: WorkflowStatus;
  currentStepId: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface WorkflowActionLog {
  id: string;
  instanceId: string;
  action: 'APPROVE' | 'REJECT' | 'SEND_BACK' | 'START';
  fromStepId: string | null;
  toStepId: string | null;
  actorId: string;
  comment?: string;
  createdAt: Date;
}
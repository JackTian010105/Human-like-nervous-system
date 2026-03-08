export interface HealthResponse {
    status: "ok";
}
export interface CreateCommandDraftRequest {
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
}
export interface CommandDraft {
    draftId: string;
    status: "DRAFT";
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
    createdAt: string;
}
export interface CreateCommandDraftResponse {
    draft: CommandDraft;
}
export interface IssueCommandRequest {
    issuerId: string;
}
export interface CommandRecord {
    commandId: string;
    draftId: string;
    issuerId: string;
    createdAt: string;
    status: "CREATED";
}
export interface IssueCommandResponse {
    command: CommandRecord;
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  CommandDraft,
  CommandRecord,
  CreateCommandDraftResponse,
  IssueCommandResponse
} from "@command-neural/shared-types";

type FieldName = "content" | "targetNode" | "executionRequirement" | "feedbackRequirement";

type FormState = Record<FieldName, string>;

const initialFormState: FormState = {
  content: "",
  targetNode: "",
  executionRequirement: "",
  feedbackRequirement: ""
};

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    []
  );
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CommandDraft | null>(null);
  const [issuerId, setIssuerId] = useState("sunwu");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [command, setCommand] = useState<CommandRecord | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    setErrors({});

    try {
      const response = await fetch(`${apiBase}/commands/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          message?: string;
          errors?: Partial<Record<FieldName, string>>;
        };
        setErrors(payload.errors ?? {});
        setSubmitError(payload.message ?? "Failed to create draft");
        setDraft(null);
        return;
      }

      const payload = (await response.json()) as CreateCommandDraftResponse;
      setDraft(payload.draft);
      setCommand(null);
      setIssueError("");
      setForm(initialFormState);
    } catch {
      setSubmitError("Network error while creating draft");
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const onIssue = async () => {
    if (!draft) {
      return;
    }
    setIssuing(true);
    setIssueError("");

    try {
      const response = await fetch(`${apiBase}/commands/drafts/${draft.draftId}/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${draft.draftId}:${issuerId}`
        },
        body: JSON.stringify({ issuerId })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setIssueError(payload.message ?? "Failed to issue command");
        return;
      }

      const payload = (await response.json()) as IssueCommandResponse;
      setCommand(payload.command);
    } catch {
      setIssueError("Network error while issuing command");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 720 }}>
      <h1>Command Neural System Console</h1>
      <p>Create structured command draft (Story 1.2)</p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          id="content"
          label="指令内容"
          value={form.content}
          onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
          error={errors.content}
        />
        <Field
          id="targetNode"
          label="目标节点"
          value={form.targetNode}
          onChange={(value) => setForm((prev) => ({ ...prev, targetNode: value }))}
          error={errors.targetNode}
        />
        <Field
          id="executionRequirement"
          label="执行要求"
          value={form.executionRequirement}
          onChange={(value) => setForm((prev) => ({ ...prev, executionRequirement: value }))}
          error={errors.executionRequirement}
        />
        <Field
          id="feedbackRequirement"
          label="反馈要求"
          value={form.feedbackRequirement}
          onChange={(value) => setForm((prev) => ({ ...prev, feedbackRequirement: value }))}
          error={errors.feedbackRequirement}
        />

        <button type="submit" disabled={saving}>
          {saving ? "提交中..." : "创建草稿"}
        </button>
      </form>

      {submitError ? (
        <p role="alert" style={{ color: "#b42318", marginTop: 16 }}>
          失败：{submitError}
        </p>
      ) : null}

      {draft ? (
        <section style={{ marginTop: 16 }}>
          <h2>草稿创建成功</h2>
          <p>Draft ID: {draft.draftId}</p>
          <p>Status: {draft.status}</p>
          <p>Created At: {draft.createdAt}</p>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="issuerId" style={{ display: "block", marginBottom: 4 }}>
              发令者（issuerId）
            </label>
            <input
              id="issuerId"
              name="issuerId"
              value={issuerId}
              onChange={(event) => setIssuerId(event.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={onIssue} disabled={issuing}>
              {issuing ? "发令中..." : "发令并生成 CommandID"}
            </button>
          </div>
          {issueError ? (
            <p role="alert" style={{ color: "#b42318", marginTop: 8 }}>
              发令失败：{issueError}
            </p>
          ) : null}
        </section>
      ) : null}

      {command ? (
        <section style={{ marginTop: 16 }}>
          <h2>发令成功</h2>
          <p>Command ID: {command.commandId}</p>
          <p>Issuer ID: {command.issuerId}</p>
          <p>Created At: {command.createdAt}</p>
          <p>Status: {command.status}</p>
        </section>
      ) : null}
    </main>
  );
}

function Field(props: {
  id: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { id, label, value, onChange, error } = props;
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        style={{ width: "100%" }}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" style={{ color: "#b42318", marginTop: 4 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

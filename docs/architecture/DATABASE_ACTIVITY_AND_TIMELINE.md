# Domain activity vs audit vs timeline

- **`audit_logs`**: Low-level persistence (`CREATE`, `UPDATE`, `DELETE`, `LOCK`, `APPROVE`, …) plus optional JSON **`diff`**. Written next to sensitive mutations from generic auditing middleware or explicit calls.
- **`domain_activities`**: HR-readable summaries (`verb` + **`summary`** + optional **`payload`**) for feeds that should not expose raw field-level diffs.
- **`employee_timeline_events`**: Employee-centric storyline (`eventType`, `title`, optional **`subjectKind`/`subjectId`**). Writers should target **one** canonical writer per business action (e.g. leave approval writes timeline + optional domain activity; payroll lock writes audit + timeline).

Avoid copying identical payloads into all three: prefer **timeline title/body** for UX, **audit diff** for forensics, **domain summary** for cross-entity company feeds.

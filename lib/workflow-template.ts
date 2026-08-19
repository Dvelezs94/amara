export type WorkflowTemplateVariable = {
  key: string;
  label: string;
};

export const WORKFLOW_TEMPLATE_VARIABLES: readonly WorkflowTemplateVariable[] = [
  { key: "title", label: "Título" },
  { key: "folio", label: "Folio" },
  { key: "status", label: "Estado" },
  { key: "priority", label: "Prioridad" },
  { key: "actorName", label: "Quién disparó el evento" },
  { key: "assetName", label: "Máquina" },
  { key: "note", label: "Nota / comentario" },
  { key: "href", label: "Enlace" },
  { key: "contactEmail", label: "Email de contacto" },
  { key: "contactName", label: "Nombre de contacto" },
];

export const WORKFLOW_TEMPLATE_HINT =
  "Escribe { para insertar una variable: " +
  WORKFLOW_TEMPLATE_VARIABLES.map((item) => `{{${item.key}}}`).join(" ");

export type WorkflowTemplateTokenMatch = {
  start: number;
  end: number;
  query: string;
};

export function matchWorkflowTemplateToken(
  text: string,
  cursor: number
): WorkflowTemplateTokenMatch | null {
  if (!Number.isFinite(cursor) || cursor < 0 || cursor > text.length) {
    return null;
  }
  const prefix = text.slice(0, cursor);
  const match = prefix.match(/\{(\{)?([a-zA-Z0-9_]*)$/);
  if (!match) return null;
  return {
    start: cursor - match[0].length,
    end: cursor,
    query: match[2] ?? "",
  };
}

export function filterWorkflowTemplateVariables(
  query: string
): WorkflowTemplateVariable[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...WORKFLOW_TEMPLATE_VARIABLES];
  return WORKFLOW_TEMPLATE_VARIABLES.filter(
    (item) =>
      item.key.toLowerCase().startsWith(q) ||
      item.label.toLowerCase().includes(q)
  );
}

export function insertWorkflowTemplateVariable(
  text: string,
  cursor: number,
  key: string
): { text: string; cursor: number } {
  const insertion = `{{${key}}}`;
  const token = matchWorkflowTemplateToken(text, cursor);
  const start = token?.start ?? cursor;
  const end = token?.end ?? cursor;
  return {
    text: text.slice(0, start) + insertion + text.slice(end),
    cursor: start + insertion.length,
  };
}

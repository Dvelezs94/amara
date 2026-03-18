import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import OpenAI from "openai";
import { AI_TOOLS, runAiTool } from "@/lib/ai/tools";

const systemPrompt = `Eres un asistente de mantenimiento para AmiMaint. Respondes en español.
Tienes acceso a herramientas para consultar:
- Activos (equipos/sitios): list_assets, get_asset
- Órdenes de trabajo: list_work_orders, get_work_order
- Plantillas de checklist: list_checklist_templates, get_checklist_template
- Documentos/base de conocimiento (manuales, especificaciones): list_documents
- Solicitudes de mantenimiento: list_requests

Usa las herramientas cuando necesites datos para responder. Responde de forma clara y concisa. Si no hay datos, dilo. No inventes IDs ni datos que no hayas obtenido con las herramientas.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no configurada. Añádela en .env.local para usar el asistente." },
      { status: 503 }
    );
  }

  let body: { messages: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  let maxTurns = 8;
  while (maxTurns-- > 0) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullMessages,
      tools: AI_TOOLS,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    if (!choice?.message) {
      return NextResponse.json(
        { error: "No response from model", content: null },
        { status: 500 }
      );
    }

    fullMessages.push(choice.message);

    if (!choice.message.tool_calls?.length) {
      const content = choice.message.content ?? "";
      return NextResponse.json({ content, role: "assistant" });
    }

    for (const tc of choice.message.tool_calls) {
      const name = tc.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        if (tc.function?.arguments) args = JSON.parse(tc.function.arguments);
      } catch {}
      const result = await runAiTool(name, args);
      fullMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return NextResponse.json(
    { error: "Too many tool turns", content: null },
    { status: 500 }
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        return;
      }
      if (data.content) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.content },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      <div className="flex-shrink-0 mb-4">
        <p className="text-sm text-zinc-500">
          Pregunta sobre maquinas, órdenes de trabajo, checklists, documentación y solicitudes. El
          asistente consulta los datos por ti.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-500">
            <div>
              <p className="font-medium text-zinc-700">Ejemplos de preguntas</p>
              <ul className="mt-3 space-y-2 text-sm text-left max-w-sm mx-auto">
                <li>• ¿Cuántas órdenes de trabajo abiertas hay?</li>
                <li>• Lista las maquinas</li>
                <li>• ¿Qué plantillas de checklist existen?</li>
                <li>• ¿Hay documentación o manuales en la base de conocimiento?</li>
                <li>• Dame los detalles del activo [nombre]</li>
              </ul>
            </div>
          </div>
        )}

        <ul className="flex-1 space-y-4 p-4">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-700" />
                </span>
              )}
              <div
                className={`rounded-xl px-4 py-2.5 max-w-[85%] ${
                  m.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.content ? (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                ) : error ? (
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                ) : loading ? (
                  <p className="text-sm text-zinc-500">Pensando…</p>
                ) : null}
              </div>
              {m.role === "user" && (
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-zinc-600" />
                </span>
              )}
            </li>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-700" />
              </span>
              <div className="rounded-xl px-4 py-2.5 bg-zinc-100 text-zinc-500 text-sm">
                Consultando datos…
              </div>
            </li>
          )}
        </ul>
        <div ref={bottomRef} />

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 p-3 border-t border-zinc-100"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta…"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary-600 text-white p-2.5 disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

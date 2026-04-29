"use client";

type PrintChecklistButtonProps = {
  targetId: string;
};

export function PrintChecklistButton({ targetId }: PrintChecklistButtonProps) {
  function onPrint() {
    const node = document.getElementById(targetId);
    if (!node) return;

    const printRoot = document.createElement("div");
    printRoot.id = "checklist-print-root";
    printRoot.innerHTML = node.innerHTML;
    document.body.appendChild(printRoot);

    const style = document.createElement("style");
    style.id = "checklist-print-style";
    style.textContent = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #checklist-print-root,
        #checklist-print-root * {
          visibility: visible !important;
        }
        #checklist-print-root {
          position: fixed;
          inset: 0;
          background: white;
          overflow: auto;
          padding: 16px;
          z-index: 2147483647;
        }
      }
    `;
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      printRoot.remove();
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <button
      type="button"
      onClick={onPrint}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
    >
      Imprimir checklist
    </button>
  );
}

export function simularImpressaoTermicaPDF(
  titulo: string,
  linhas: string[]
): void {
  if (typeof window === "undefined") return;

  const win = window.open("", "_blank", "width=360,height=640");
  if (!win) {
    alert("Permita pop-ups para abrir o simulador de impressão térmica (PDF 80mm).");
    return;
  }

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const conteudo = linhas.map(escapeHtml).join("\n");

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 12px;
      background: #f5f5f4;
      font-family: "Courier New", Courier, monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .cupom {
      width: min(100%, 360px);
      background: #fffbeb;
      color: #111827;
      padding: 14px 12px;
      border: 1px dashed #d6d3d1;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      font-size: 13px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .acoes {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      background: #111827;
      color: #ffffff;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .cupom {
        width: 100%;
        background: #ffffff;
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .acoes {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="acoes">
    <button class="btn" onclick="window.print()">Salvar PDF / Imprimir (80mm)</button>
  </div>
  <pre class="cupom">${conteudo}</pre>
</body>
</html>`);
  win.document.close();
}


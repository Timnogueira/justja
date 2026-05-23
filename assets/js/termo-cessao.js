/* ==========================================================================
   Just Já — Geração da minuta do Termo de Cessão (PDF)
   --------------------------------------------------------------------------
   Usa jsPDF carregado por CDN no <head> da página.
   Gera duas variantes:
     - Integral: cessão do valor total (cliente + honorários do advogado)
     - Parcial:  cessão só da parte do cliente (honorários ficam com o advogado)

   ⚠️ ATENÇÃO: este é um TEMPLATE DE MINUTA gerado automaticamente.
   Antes de uso em produção, precisa ser revisado por advogado.
   ========================================================================== */

const TermoCessao = (() => {
  const CESSIONARIA = {
    razao: "Just Já Antecipações Ltda.",
    cnpj:  "00.000.000/0001-00",         // PLACEHOLDER — trocar no produção
    endereco: "Av. Paulista, 1000, sala 101 — São Paulo/SP — CEP 01310-100",
  };

  function gerar(proc, user) {
    if (!window.jspdf) {
      alert("jsPDF ainda não carregou. Aguarde 1 segundo e tente novamente.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const integral = (proc.escolhaCessao || "integral") === "integral";
    const titulo = integral
      ? "TERMO DE CESSÃO DE CRÉDITO JUDICIAL — INTEGRAL"
      : "TERMO DE CESSÃO DE CRÉDITO JUDICIAL — PARCIAL";

    const valorBase     = proc.analise?.valorBaseCausa || proc.valorEstimado || 0;
    const valorPago     = proc.oferta?.valorAntecipadoFinal
                       || (integral ? proc.oferta?.valorAntecipadoIntegral : proc.oferta?.valorAntecipadoParcial)
                       || 0;
    const honorariosPct = 0.30; // padrão atual — substituir pelo real em produção
    const honorariosVal = Math.round(valorBase * honorariosPct);
    const parteCliente  = valorBase - honorariosVal;

    const objetoCessao = integral
      ? `a integralidade do crédito objeto do referido processo, no valor base estimado de ${fmt(valorBase)}, incluindo principal, juros, correção monetária e honorários sucumbenciais e/ou contratuais`
      : `a parte do crédito que cabe ao(a) CEDENTE, no valor base estimado de ${fmt(parteCliente)} (correspondente ao crédito total de ${fmt(valorBase)} deduzidos os honorários advocatícios estimados de ${fmt(honorariosVal)} que permanecem com o(a) advogado(a))`;

    // ---------- Layout ----------
    const M = { left: 20, right: 20, top: 20, bottom: 25 };
    const pageW = doc.internal.pageSize.getWidth();
    const contentW = pageW - M.left - M.right;
    let y = M.top;

    // Cabeçalho — marca d'água "MINUTA"
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(60);
    doc.setFont("helvetica", "bold");
    doc.text("MINUTA", pageW / 2, 150, { align: "center", angle: 30 });
    doc.setTextColor(0, 0, 0);

    // Título
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(titulo, pageW / 2, y, { align: "center" });
    y += 8;

    // Subtítulo: irrevogável
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("Instrumento particular irrevogável e irretratável, regido pelo Art. 286 e seguintes do Código Civil.",
             pageW / 2, y, { align: "center" });
    y += 10;

    // ---------- Partes ----------
    y = par(doc, y, M, contentW, "1. DAS PARTES", true);
    y = par(doc, y, M, contentW,
      `CEDENTE: ${user.nome || "[nome do cliente]"}, inscrito(a) no CPF sob o nº ${formatCPF(proc.cpfTitular) || "[CPF a preencher]"}, doravante simplesmente "CEDENTE".`);
    y = par(doc, y, M, contentW,
      `CESSIONÁRIA: ${CESSIONARIA.razao}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${CESSIONARIA.cnpj}, com sede em ${CESSIONARIA.endereco}, doravante "CESSIONÁRIA".`);
    y = par(doc, y, M, contentW,
      `Com a anuência do(a) ADVOGADO(A) constituído(a) nos autos do processo objeto deste instrumento, a seguir identificado.`);
    y += 2;

    // ---------- Cláusulas ----------
    y = par(doc, y, M, contentW, "2. DO PROCESSO E DO CRÉDITO CEDIDO", true);
    y = par(doc, y, M, contentW,
      `O CEDENTE figura como parte autora no processo de número ${proc.numeroCnj || "[CNJ a preencher]"}, em trâmite perante ${proc.tribunal || "[tribunal a preencher]"}.`);

    y = par(doc, y, M, contentW, "3. OBJETO DA CESSÃO", true);
    y = par(doc, y, M, contentW,
      `Pelo presente instrumento, o CEDENTE cede e transfere à CESSIONÁRIA, ${objetoCessao}.`);

    y = par(doc, y, M, contentW, "4. PREÇO E FORMA DE PAGAMENTO", true);
    y = par(doc, y, M, contentW,
      `Pela cessão objeto deste instrumento, a CESSIONÁRIA pagará ao CEDENTE a quantia de ${fmt(valorPago)} (${valorPorExtenso(valorPago)}), à vista, mediante PIX para a chave de titularidade do CEDENTE, em até 24 (vinte e quatro) horas contadas da apresentação do comprovante de protocolação deste termo nos autos do processo.`);

    y = par(doc, y, M, contentW, "5. IRREVOGABILIDADE E IRRETRATABILIDADE", true);
    y = par(doc, y, M, contentW,
      `A presente cessão é firmada em caráter IRREVOGÁVEL e IRRETRATÁVEL, vinculando o CEDENTE, seus herdeiros e sucessores. Uma vez recebido o preço, o CEDENTE não poderá rescindir ou modificar unilateralmente os termos deste instrumento.`);

    y = par(doc, y, M, contentW, "6. EFICÁCIA PERANTE O JUÍZO E O DEVEDOR", true);
    y = par(doc, y, M, contentW,
      `A presente cessão produzirá efeitos perante o devedor a partir da juntada deste termo aos autos do processo, nos termos do art. 290 do Código Civil. O(A) ADVOGADO(A) do CEDENTE compromete-se a protocolar este instrumento nos autos no prazo de até 5 (cinco) dias úteis da assinatura, e a comunicar a CESSIONÁRIA mediante envio do comprovante de protocolização.`);

    y = par(doc, y, M, contentW, "7. RESPONSABILIDADES E GARANTIAS", true);
    y = par(doc, y, M, contentW,
      `O CEDENTE declara, sob as penas da lei, que: (a) é o legítimo titular do crédito cedido; (b) o crédito é existente e não foi previamente cedido a terceiros; (c) não há litígios, garantias ou ônus que comprometam a cessão. A responsabilidade do CEDENTE limita-se à existência do crédito (art. 295 do CC), não respondendo pela solvência do devedor (sem garantia de solvência), assumindo a CESSIONÁRIA o risco da espera e do efetivo pagamento pelo tribunal.`);

    y = par(doc, y, M, contentW, "8. FORO", true);
    y = par(doc, y, M, contentW,
      `As partes elegem o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas deste instrumento, renunciando a qualquer outro, por mais privilegiado que seja.`);

    // ---------- Local, data, assinaturas ----------
    if (y > 240) { doc.addPage(); y = M.top; }
    y += 10;
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`São Paulo, ${hoje}.`, M.left, y);
    y += 18;

    // 3 assinaturas — Cedente, Cessionária, Advogado
    drawSigLine(doc, M.left, y, contentW, "CEDENTE", `${user.nome || "[Nome do cliente]"}\nCPF: ${formatCPF(proc.cpfTitular) || "[CPF]"}`);
    y += 30;
    drawSigLine(doc, M.left, y, contentW, "CESSIONÁRIA", `${CESSIONARIA.razao}\nCNPJ: ${CESSIONARIA.cnpj}`);
    y += 30;
    drawSigLine(doc, M.left, y, contentW, "ADVOGADO(A) DO CEDENTE", proc.advogadoTexto || "[Nome do advogado(a) e OAB]");

    // ---------- Footer com aviso ----------
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Minuta gerada automaticamente pela Just Já em ${new Date().toLocaleString("pt-BR")} · página ${i}/${pageCount} · documento sujeito a revisão jurídica`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    const nomeArq = `termo-cessao-${(proc.numeroCnj || proc.id).replace(/[^\w]/g, "")}-${integral ? "integral" : "parcial"}.pdf`;
    doc.save(nomeArq);
  }

  // ---------- Helpers ----------
  function par(doc, y, M, w, txt, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 10);
    const lines = doc.splitTextToSize(txt, w);
    if (y + lines.length * 5 > 270) {
      doc.addPage();
      y = M.top;
    }
    doc.text(lines, M.left, y, { align: "justify", maxWidth: w });
    return y + lines.length * 5 + (bold ? 2 : 4);
  }

  function drawSigLine(doc, x, y, w, label, name) {
    const lineY = y + 8;
    doc.setDrawColor(80, 80, 80);
    doc.line(x, lineY, x + w * 0.6, lineY);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(label, x, lineY + 5);
    doc.setFont("helvetica", "normal");
    const nameLines = (name || "").split("\n");
    nameLines.forEach((l, i) => doc.text(l, x, lineY + 10 + i * 4));
  }

  function fmt(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatCPF(s) {
    if (!s) return "";
    const d = String(s).replace(/\D/g, "");
    if (d.length !== 11) return s;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  // Valor por extenso rudimentar — pra MVP serve
  function valorPorExtenso(v) {
    const n = Math.round(Number(v) * 100) / 100;
    const reais = Math.floor(n);
    const cents = Math.round((n - reais) * 100);
    return `R$ ${reais.toLocaleString("pt-BR")},${String(cents).padStart(2, "0")} reais`;
  }

  return { gerar };
})();

window.TermoCessao = TermoCessao;

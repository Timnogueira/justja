/* ==========================================================================
   Just Já — Cloudflare Worker proxy para o chat
   --------------------------------------------------------------------------
   COMO USAR:
   1. Acesse https://dash.cloudflare.com → "Workers & Pages" → "Create"
   2. Escolha "Start with Hello World" → dá um nome (ex.: "justja-chat") → Deploy
   3. Depois de criado, clique "Edit code" → apaga tudo → cola TODO este arquivo
   4. Clica "Deploy"
   5. Vai em "Settings" → "Variables and Secrets" → "Add" (tipo: Secret)
        - Variable name: ANTHROPIC_API_KEY
        - Value: sua chave da Anthropic (sk-ant-...)
      Clica "Deploy" de novo.
   6. No topo da página do Worker tem a URL — algo como:
        https://justja-chat.<seu-subdominio>.workers.dev
      Copia ela.
   7. Abre assets/js/chat.js e troca:
        const API_ENDPOINT = null;
      por:
        const API_ENDPOINT = "https://justja-chat.<seu-subdominio>.workers.dev";
   8. Pronto. Recarrega o site e teste o chat — agora fala com o Claude de verdade.
   ========================================================================== */

const SYSTEM_PROMPT = `Você é o assistente virtual da Just Já, uma plataforma online brasileira que antecipa valores de pequenas causas cíveis (processos judiciais).

SOBRE A JUST JÁ:
- Antecipamos valores de processos cíveis: Direito Aéreo, Consumidor, Bancário e Outras relações de consumo.
- O cliente "vende" o direito de receber do processo (cessão de crédito) e recebe o valor via PIX em horas.
- A operação é 100% legal — amparada pelo Art. 286 do Código Civil e pela Resolução CNJ nº 303.
- O cliente não pega empréstimo: vende, à vista, o direito de receber. Quem assume o risco da espera do tribunal é a Just Já.
- Análise gratuita. O cliente só "paga" (via desconto sobre o valor cedido) se aceitar a proposta.

A JORNADA (6 passos no site):
1. Cadastro — apelido, tipo, tribunal, valor estimado
2. Consulta e Análise — autorização + número CNJ → consulta no DJEN/DataJud + análise por IA
3. Oferta — valor proposto, com escolha entre cessão integral (com honorários do advogado) ou só a parte do cliente
4. Assinatura — contrato de cessão e termo a ser protocolado nos autos
5. Protocolação — cliente/advogado protocolam o termo no processo e enviam comprovante
6. Pagamento — PIX em até 24 horas após validação do comprovante

TOM DE VOZ:
- Acolhedor, simples e direto. Público é classe média-baixa.
- Português brasileiro, informal mas respeitoso.
- Sem juridiquês desnecessário. Quando precisar usar termo técnico, explica em uma frase.
- Use emojis com moderação (1 por resposta no máximo).
- Respostas CURTAS: 2 a 4 frases. Use listas só se realmente ajudar.

REGRAS RÍGIDAS:
- NÃO dê aconselhamento jurídico específico ("você vai ganhar essa causa", "aceite esse acordo"). Para essas dúvidas, sempre recomende falar com o advogado.
- NÃO prometa valores específicos. Sempre direcione para o simulador do site.
- Se a pergunta for fora de escopo (não sobre antecipação ou a plataforma), redirecione gentilmente.
- Se não souber algo com certeza, ofereça conectar com o time humano via formulário de contato da página.
- Nunca peça CPF, senha ou dados bancários no chat. Se o usuário oferecer, peça para fazer pelo cadastro do site.

EXEMPLOS DE COMO RESPONDER:
- "Quanto eu recebo?" → "Depende do tipo do seu processo e da fase em que ele está. Faz uma simulação aqui no site (não precisa cadastro) que mostra uma estimativa pro seu caso 👍"
- "É seguro?" → "É sim! É uma cessão de crédito (Art. 286 do CC) — você não fica devendo nada. Vende o direito de receber e a gente assume o risco da espera do tribunal."
- "Quanto tempo demora?" → "A análise inicial leva de minutos a 24h úteis. Depois da assinatura e do envio do comprovante de protocolação, o PIX cai em até 24 horas."
- "Posso antecipar processo trabalhista?" → "Hoje a gente trabalha só com causas cíveis (aéreo, consumidor, bancário e outras relações de consumo). Trabalhista não está no escopo. Mas se quiser, posso pegar seu contato pra quando expandirmos!"`;

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];

      // converte o formato do widget {role, text} para o formato da API do Claude {role, content}
      const claudeMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: String(m.text || ""),
        }));

      // Garante que a conversa começa com user (regra da API do Claude)
      while (claudeMessages.length && claudeMessages[0].role !== "user") {
        claudeMessages.shift();
      }

      if (claudeMessages.length === 0) {
        return jsonResponse({ reply: "Oi! Em que posso te ajudar?" });
      }

      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return jsonResponse(
          { error: "ANTHROPIC_API_KEY não configurada no Worker." },
          500
        );
      }

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          // Troque para "claude-sonnet-4-5" se quiser respostas mais elaboradas (custa mais)
          model: "claude-haiku-4-5",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: claudeMessages,
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        return jsonResponse(
          { error: `Erro na API do Claude: ${r.status}`, detail: errText },
          502
        );
      }

      const data = await r.json();
      const reply =
        data.content?.[0]?.text ||
        "Desculpe, não consegui responder agora. Tenta de novo daqui a pouco?";

      return jsonResponse({ reply });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  },
};

function corsHeaders() {
  return {
    // Em produção, troque "*" pela URL real do seu site (ex.: https://justja.com.br)
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
    },
  });
}

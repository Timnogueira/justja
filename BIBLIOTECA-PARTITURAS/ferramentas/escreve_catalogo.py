# -*- coding: utf-8 -*-
import os, json, html
OUT = "/home/user/justja/BIBLIOTECA-PARTITURAS"
d = json.load(open("/tmp/build/catalogo.json"))
por_col, volumes, TIT = d["por_col"], d["volumes"], d["titulos"]
ORDEM = list(por_col.keys())
tot_pec = sum(len(v) for v in por_col.values())
tot_pag = sum(i["p"] for v in por_col.values() for i in v)

# ------------------------------- LEIA-ME.md -------------------------------
L = []
L.append("# Biblioteca de Partituras para Piano\n")
L.append(f"**{tot_pec} peças · {tot_pag} páginas · {len(volumes)} volumes encadernados**\n")
L.append("Todas as peças foram **gravadas do zero** a partir de fontes digitais de domínio "
         "público, com uma única folha de estilo. Por isso têm todas o mesmo aspecto: "
         "A4, pauta de 20 pt, margens de 15 mm e bastante espaço entre os sistemas.\n")
L.append("## Como está organizado\n")
L.append("Cada coleção tem os PDFs avulsos (um por peça, para pôr na estante) e um "
         "`_VOLUME-COMPLETO.pdf` com **marcadores clicáveis** — esse é o arquivo para "
         "carregar no tablet.\n")
L.append("| Coleção | Peças | Páginas | Volume |")
L.append("|---|--:|--:|---|")
for col in ORDEM:
    t = TIT.get(col, [col, "", ""])
    pgs = sum(i["p"] for i in por_col[col])
    vol = f"`{volumes[col][0]}` ({volumes[col][1]}p)" if col in volumes else "—"
    L.append(f"| **{t[0]}** | {len(por_col[col])} | {pgs} | {vol} |")
L.append("")
for col in ORDEM:
    t = TIT.get(col, [col, "", ""])
    L.append(f"### {t[0]}")
    L.append(f"*{t[2]}*\n")
    L.append("| n.º | Peça | | Pág. | Arquivo |")
    L.append("|--:|---|---|--:|---|")
    for n, i in enumerate(por_col[col], 1):
        arq = i["a"].split("/")[-1]
        L.append(f"| {n} | {i['t']} | {i['s']} | {i['p']} | `{arq}` |")
    L.append("")
L.append("## De onde vêm as partituras\n")
L.append("- **Bach, Beethoven e as peças de leitura** — [Mutopia Project]"
         "(https://www.mutopiaproject.org), edições sob licença Creative Commons "
         "BY-SA 3.0. O crédito ao gravador de cada peça está no rodapé da última página.\n"
         "- **Estudos de Chopin** — edição digital das **primeiras edições** feita pelo "
         "Instituto Fryderyk Chopin (NIFC), publicada em acesso aberto "
         "([chopinscores.org](https://chopinscores.org)). Op. 10 a partir da edição "
         "francesa de M. Schlesinger; op. 25 a partir da edição de Leipzig.\n"
         "- Todas as obras musicais estão em **domínio público** (Bach †1750, "
         "Beethoven †1827, Chopin †1849).\n")
L.append("## Como foi gravado\n")
L.append("- Fontes `.ly` → **LilyPond 2.25** com a folha de estilo `estilo/padrao.ily`.\n"
         "- Fontes Humdrum `.krn` (Chopin) → **Verovio 6.3** com margens equivalentes.\n"
         "- As duas engines foram ajustadas para a **mesma altura de pauta** (5 pt entre "
         "linhas), então as páginas se parecem mesmo vindo de origens diferentes.\n"
         "- `CATALOGO.csv` tem a lista completa em formato de planilha; `indice.html` é "
         "o índice navegável (abra no navegador).\n")
open(os.path.join(OUT, "LEIA-ME.md"), "w", encoding="utf-8").write("\n".join(L))

# ------------------------------- indice.html ------------------------------
def esc(s): return html.escape(str(s))
H = []
H.append("""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Biblioteca de Partituras</title><style>
:root{--bg:#faf8f4;--card:#fff;--tx:#23201c;--mut:#7a7166;--ln:#e6e0d6;--ac:#8a5a2b}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){
--bg:#17150f;--card:#201d16;--tx:#ece7dd;--mut:#9d948a;--ln:#332e25;--ac:#d6a26a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);
font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
padding:0 16px}
.wrap{max-width:900px;margin:0 auto;padding:40px 0 64px}
h1{font-size:1.9rem;margin:0 0 4px;letter-spacing:-.02em}
.sub{color:var(--mut);margin:0 0 32px}
section{background:var(--card);border:1px solid var(--ln);border-radius:12px;
padding:20px 22px;margin:0 0 18px}
h2{font-size:1.12rem;margin:0 0 4px;letter-spacing:-.01em}
.desc{color:var(--mut);font-size:.9rem;margin:0 0 14px}
.vol{display:inline-block;background:var(--ac);color:#fff;text-decoration:none;
font-size:.82rem;font-weight:600;padding:7px 13px;border-radius:7px;margin:0 0 14px}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .vol{color:#17150f}}
ol{margin:0;padding:0;list-style:none}
li{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-top:1px solid var(--ln)}
li:first-child{border-top:0}
.n{color:var(--mut);font-variant-numeric:tabular-nums;min-width:1.8em;font-size:.85rem}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--ln)}
a:hover{border-color:var(--ac);color:var(--ac)}
.k{color:var(--mut);font-size:.85rem;margin-left:auto;text-align:right;padding-left:12px}
.p{color:var(--mut);font-size:.78rem;font-variant-numeric:tabular-nums;min-width:3em;
text-align:right}
footer{color:var(--mut);font-size:.83rem;margin-top:34px;line-height:1.7}
</style></head><body><div class="wrap">""")
H.append(f"<h1>Biblioteca de Partituras</h1>")
H.append(f'<p class="sub">{tot_pec} peças · {tot_pag} páginas · piano</p>')
for col in ORDEM:
    t = TIT.get(col, [col, "", ""])
    H.append("<section>")
    H.append(f"<h2>{esc(t[0])}</h2><p class='desc'>{esc(t[2])}</p>")
    if col in volumes:
        H.append(f'<a class="vol" href="{esc(col)}/{esc(volumes[col][0])}">'
                 f'Volume completo · {volumes[col][1]} páginas</a>')
    H.append("<ol>")
    for n, i in enumerate(por_col[col], 1):
        H.append(f'<li><span class="n">{n}</span>'
                 f'<a href="{esc(i["a"])}">{esc(i["t"])}</a>'
                 f'<span class="k">{esc(i["s"])}</span>'
                 f'<span class="p">{i["p"]}p</span></li>')
    H.append("</ol></section>")
H.append("<footer>Gravado com LilyPond e Verovio a partir do Mutopia Project "
         "(CC BY-SA 3.0) e da edição de acesso aberto do Instituto Fryderyk Chopin. "
         "Obras em domínio público.</footer>")
H.append("</div></body></html>")
open(os.path.join(OUT, "indice.html"), "w", encoding="utf-8").write("\n".join(H))
print("LEIA-ME.md e indice.html escritos")

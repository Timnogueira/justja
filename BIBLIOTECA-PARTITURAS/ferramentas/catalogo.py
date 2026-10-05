# -*- coding: utf-8 -*-
"""Monta os volumes encadernados (com marcadores) e o catalogo da biblioteca."""
import os, json, csv, html, collections
import pymupdf

OUT = "/home/user/justja/BIBLIOTECA-PARTITURAS"
res = json.load(open("/tmp/build/resultado.json"))

TITULOS = {
 "01-BACH/01-Invencoes-a-2-vozes-BWV-772-786": ("Invenções a 2 vozes, BWV 772–786", "Bach, J. S.", "O livro de estudo por excelência: independência das mãos e condução de duas vozes."),
 "01-BACH/02-Sinfonias-a-3-vozes-BWV-787-801": ("Sinfonias (Invenções a 3 vozes), BWV 787–801", "Bach, J. S.", "O passo seguinte às Invenções: três vozes simultâneas."),
 "01-BACH/03-Pequenos-Preludios": ("Pequenos Prelúdios", "Bach, J. S.", "Porta de entrada no Bach de teclado — as peças mais curtas e acessíveis."),
 "01-BACH/04-Caderno-de-Anna-Magdalena": ("Caderno de Anna Magdalena Bach", "Bach, J. S. (e círculo)", "Minuetos, polonaises e marchas. O material mais fácil do conjunto."),
 "01-BACH/05-Cravo-Bem-Temperado-Livro-I": ("O Cravo Bem Temperado, Livro I (seleção)", "Bach, J. S.", "Prelúdios e fugas. Seleção: os pares disponíveis em edição livre."),
 "01-BACH/06-Cravo-Bem-Temperado-Livro-II": ("O Cravo Bem Temperado, Livro II (seleção)", "Bach, J. S.", "Pequena seleção do segundo livro."),
 "02-CHOPIN-Estudos/Op-10": ("Estudos, op. 10", "Chopin, F.", "Os doze estudos do op. 10, na edição original francesa (M. Schlesinger)."),
 "02-CHOPIN-Estudos/Op-25": ("Estudos, op. 25", "Chopin, F.", "Os doze estudos do op. 25, na edição original (Breitkopf, Leipzig)."),
 "03-BEETHOVEN-Sonata-Luar-op-27-n-2": ("Sonata “Ao Luar”, op. 27 n.º 2 — completa", "Beethoven, L. van", "Os três movimentos da Sonata quasi una Fantasia."),
 "05-LEITURA-A-PRIMEIRA-VISTA": ("Leitura à primeira vista", "vários", "Seis peças curtas e pouco tocadas, de estilos diferentes, para ler sem conhecer."),
}

por_col = collections.OrderedDict()
for r in res:
    por_col.setdefault(r["colecao"], []).append(r)

# ---------- volumes encadernados com marcadores ----------
volumes = {}
for col, itens in por_col.items():
    if len(itens) < 3:
        continue
    doc = pymupdf.open()
    toc = []
    for it in itens:
        p = os.path.join(OUT, it["arquivo"])
        inicio = doc.page_count
        doc.insert_pdf(pymupdf.open(p))
        toc.append([1, f"{it['titulo']} — {it['sub']}", inicio + 1])
    doc.set_toc(toc)
    nome = "_VOLUME-COMPLETO.pdf"
    destino = os.path.join(OUT, col, nome)
    doc.save(destino, garbage=4, deflate=True)
    np = doc.page_count
    volumes[col] = (nome, np)
    doc.close()
    print(f"volume: {col} -> {np}p")

# ---------- CSV ----------
with open(os.path.join(OUT, "CATALOGO.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["colecao", "n", "titulo", "tonalidade/compositor", "paginas", "arquivo", "fonte"])
    for r in res:
        fonte = "Mutopia Project (CC BY-SA 3.0)" if r["tipo"] == "ly" else "NIFC / chopinscores.org (acesso aberto)"
        w.writerow([TITULOS.get(r["colecao"], (r["colecao"],))[0], r["ordem"],
                    r["titulo"], r["sub"], r["paginas"], r["arquivo"], fonte])
print("CATALOGO.csv escrito")
json.dump({"por_col": {k: [dict(t=i["titulo"], s=i["sub"], a=i["arquivo"], p=i["paginas"]) for i in v]
                       for k, v in por_col.items()},
           "volumes": volumes, "titulos": TITULOS},
          open("/tmp/build/catalogo.json", "w"), ensure_ascii=False)
tot = sum(r["paginas"] for r in res)
print("total pecas:", len(res), "| total paginas:", tot)

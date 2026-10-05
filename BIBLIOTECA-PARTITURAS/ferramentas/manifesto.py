# -*- coding: utf-8 -*-
"""Manifesto da Biblioteca de Partituras: o que entra, com que nome, de que fonte."""
import os, glob, re

MUT = "/tmp/src/mutopia/ftp"
KRN = "/tmp/src/chopin/kern"

TONS = ["Dó maior","Dó menor","Ré maior","Ré menor","Mi bemol maior","Mi maior",
        "Mi menor","Fá maior","Fá menor","Sol maior","Sol menor","Lá maior",
        "Lá menor","Si bemol maior","Si menor"]

EXCLUI = ("guitar","duo","organ","choir","viola","violin","cello","orch","band","-lys/")

def pick(bwv, prefer=None):
    """Escolhe o .ly de teclado de uma pasta BWV do Mutopia."""
    cands = glob.glob(f"{MUT}/BachJS/{bwv}/**/*.ly", recursive=True)
    cands = [c for c in cands if not any(t in c.lower() for t in ("guitar","duo","organ"))]
    cands = [c for c in cands if "-notes.ly" not in c]
    if prefer:
        for p in prefer:
            for c in cands:
                if p in os.path.basename(c).lower():
                    return c
    return cands[0] if cands else None

M = []   # lista de entradas

def add(colecao, ordem, titulo, sub, fonte, tipo="ly", nota=""):
    if fonte is None:
        return
    M.append(dict(colecao=colecao, ordem=ordem, titulo=titulo, sub=sub,
                  fonte=fonte, tipo=tipo, nota=nota))

# ---------------- BACH: Invencoes a 2 vozes -----------------
for i in range(15):
    bwv = 772 + i
    add("01-BACH/01-Invencoes-a-2-vozes-BWV-772-786", i+1,
        f"Invenção {i+1}", f"{TONS[i]} · BWV {bwv}", pick(f"BWV{bwv}"))

# ---------------- BACH: Sinfonias (invencoes a 3 vozes) -----
for i in range(15):
    bwv = 787 + i
    add("01-BACH/02-Sinfonias-a-3-vozes-BWV-787-801", i+1,
        f"Sinfonia {i+1}", f"{TONS[i]} · BWV {bwv}", pick(f"BWV{bwv}"))

# ---------------- BACH: Pequenos Preludios ------------------
PREL = [("BWV924","Prelúdio","Dó maior · BWV 924"),
        ("BWV924a","Prelúdio","Dó maior · BWV 924a"),
        ("BWV926","Prelúdio","Ré menor · BWV 926"),
        ("BWV928","Prelúdio","Fá maior · BWV 928"),
        ("BWV933","Prelúdio 1 (dos Seis Pequenos)","Dó maior · BWV 933"),
        ("BWV934","Prelúdio 2 (dos Seis Pequenos)","Dó menor · BWV 934"),
        ("BWV935","Prelúdio 3 (dos Seis Pequenos)","Ré menor · BWV 935"),
        ("BWV936","Prelúdio 4 (dos Seis Pequenos)","Ré maior · BWV 936"),
        ("BWV937","Prelúdio 5 (dos Seis Pequenos)","Mi maior · BWV 937"),
        ("BWV938","Prelúdio 6 (dos Seis Pequenos)","Mi menor · BWV 938"),
        ("BWV939","Prelúdio","Dó maior · BWV 939"),
        ("BWV940","Prelúdio","Ré menor · BWV 940"),
        ("BWV941","Prelúdio","Mi menor · BWV 941"),
        ("BWV942","Prelúdio","Lá menor · BWV 942"),
        ("BWV943","Prelúdio","Dó maior · BWV 943"),
        ("BWV999","Prelúdio","Dó menor · BWV 999"),
        ("BWV994","Applicatio","Dó maior · BWV 994")]
for n,(bwv,tit,sub) in enumerate(PREL, 1):
    add("01-BACH/03-Pequenos-Preludios", n, tit, sub, pick(bwv))

# ---------------- BACH: Caderno de Anna Magdalena -----------
AM = [("BWVAnh113","Minueto","Sol maior · BWV Anh. 113"),
      ("BWVAnh115","Minueto","Sol menor · BWV Anh. 115"),
      ("BWVAnh116","Minueto","Sol maior · BWV Anh. 116"),
      ("BWVAnh117b","Polonaise","Fá maior · BWV Anh. 117b"),
      ("BWVAnh118","Minueto","Si bemol maior · BWV Anh. 118"),
      ("BWVAnh119","Polonaise","Sol menor · BWV Anh. 119"),
      ("BWVAnh120","Minueto","Lá menor · BWV Anh. 120"),
      ("BWVAnh121","Minueto","Dó menor · BWV Anh. 121"),
      ("BWVAnh126","Musette","Ré maior · BWV Anh. 126"),
      ("BWVAnh127","Marcha","Mi bemol maior · BWV Anh. 127"),
      ("BWVAnh128","Polonaise","Ré menor · BWV Anh. 128"),
      ("BWVAnh131","Ária","Fá maior · BWV Anh. 131"),
      ("BWVAnh691","Coral “Wer nur den lieben Gott lässt walten”","BWV Anh. 691")]
for n,(bwv,tit,sub) in enumerate(AM, 1):
    add("01-BACH/04-Caderno-de-Anna-Magdalena", n, tit, sub, pick(bwv))

# ---------------- BACH: Cravo Bem Temperado ------------------
B = f"{MUT}/BachJS"
WTC1 = [
 (1,"Dó maior","BWV 846", f"{B}/BWV846/wtk1-prelude1/wtk1-prelude1.ly", f"{B}/BWV846/wtk1-fugue1/wtk1-fugue1.ly"),
 (2,"Dó menor","BWV 847", f"{B}/BWV847/bwv847a/bwv847a.ly", f"{B}/BWV847/fuga2/fuga2.ly"),
 (3,"Dó sustenido maior","BWV 848", f"{B}/BWV848/bwv848a/bwv848a.ly", f"{B}/BWV848/bwv848b/bwv848b.ly"),
 (4,"Dó sustenido menor","BWV 849", f"{B}/BWV849/bwv849a/bwv849a.ly", f"{B}/BWV849/bwv849b/bwv849b.ly"),
 (5,"Ré maior","BWV 850", f"{B}/BWV850/bwv850a/bwv850a-lys/bwv850a.ly", f"{B}/BWV850/bwv850b/bwv850b-lys/bwv850b.ly"),
 (6,"Ré menor","BWV 851", f"{B}/BWV851/bwv851a/bwv851a.ly", f"{B}/BWV851/bwv851_fugue06/bwv851_fugue06.ly"),
 (8,"Mi bemol menor","BWV 853", f"{B}/BWV853/bwv853a/bwv853a.ly", f"{B}/BWV853/bwv853b/bwv853b.ly"),
 (9,"Mi maior","BWV 854", f"{B}/BWV854/BWV854_Praeludium_IX_rh/BWV854_Praeludium_IX_rh.ly", None),
 (10,"Mi menor","BWV 855", f"{B}/BWV855/bwv855a/bwv855a.ly", f"{B}/BWV855/bwv855b/bwv855b.ly"),
 (11,"Fá maior","BWV 856", f"{B}/BWV856/BWV856_Praeludium11/BWV856_Praeludium11.ly", f"{B}/BWV856/BWV856_Fugue11/BWV856_Fugue11.ly"),
 (12,"Fá menor","BWV 857", f"{B}/BWV857/BWV857_Praeludium12/BWV857_Praeludium12.ly", f"{B}/BWV857/BWV857_Fuga12/BWV857_Fuga12.ly"),
 (15,"Sol maior","BWV 860", f"{B}/BWV860/BWV860_Praeludium15/BWV860_Praeludium15.ly", f"{B}/BWV860/BWV860_Fuga15/BWV860_Fuga15.ly"),
 (16,"Sol menor","BWV 861", f"{B}/BWV861/BWV861_Praeludium16/BWV861_Praeludium16.ly", f"{B}/BWV861/BWV861_Fuga16/BWV861_Fuga16.ly"),
 (17,"Lá bemol maior","BWV 862", f"{B}/BWV862/bach-prelude17/bach-prelude17.ly", f"{B}/BWV862/bach-fugue17/bach-fugue17.ly"),
 (20,"Lá menor","BWV 865", f"{B}/BWV865/BWV865_Praeludium20/BWV865_Praeludium20.ly", f"{B}/BWV865/BWV865_Fuga20/BWV865_Fuga20.ly"),
 (24,"Si menor","BWV 869", f"{B}/BWV869/BWV869_Praeludium24/BWV869_Praeludium24.ly", f"{B}/BWV869/bwv869b/bwv869b-lys/bwv869b.ly"),
]
for num, tom, bwv, prel, fuga in WTC1:
    col = "01-BACH/05-Cravo-Bem-Temperado-Livro-I"
    if prel: add(col, num*2-1, f"Prelúdio {num}", f"{tom} · {bwv}", prel)
    if fuga: add(col, num*2,   f"Fuga {num}",     f"{tom} · {bwv}", fuga)

WTC2 = [
 (1,"Dó maior","BWV 870", f"{B}/BWV870/wtk2prelude1/wtk2prelude1.ly", f"{B}/BWV870/wtk2fuga1/wtk2fuga1.ly"),
 (2,"Dó menor","BWV 871", f"{B}/BWV871/wtk2-prelude2/wtk2-prelude2.ly", f"{B}/BWV871/wtk2-fugue2/wtk2-fugue2.ly"),
 (6,"Ré menor","BWV 875", f"{B}/BWV875/bwv875a/bwv875a.ly", None),
 (9,"Mi maior","BWV 878", None, f"{B}/BWV878/f9/f9.ly"),
]
for num, tom, bwv, prel, fuga in WTC2:
    col = "01-BACH/06-Cravo-Bem-Temperado-Livro-II"
    if prel: add(col, num*2-1, f"Prelúdio {num}", f"{tom} · {bwv}", prel)
    if fuga: add(col, num*2,   f"Fuga {num}",     f"{tom} · {bwv}", fuga)

# ---------------- CHOPIN: Estudos (fonte Humdrum/NIFC) -------
OP10 = ["Dó maior","Lá menor","Mi maior (“Tristesse”)","Dó sustenido menor",
        "Sol bemol maior (“Teclas pretas”)","Mi bemol menor","Dó maior","Fá maior",
        "Fá menor","Lá bemol maior","Mi bemol maior","Dó menor (“Revolucionário”)"]
OP25 = ["Lá bemol maior (“Harpa eólia”)","Fá menor","Fá maior","Lá menor","Mi menor",
        "Sol sustenido menor (“Terças”)","Dó sustenido menor","Ré bemol maior (“Sextas”)",
        "Sol bemol maior (“Borboleta”)","Si menor (“Oitavas”)","Lá menor (“Vento de inverno”)",
        "Dó menor (“Oceano”)"]
for i, tom in enumerate(OP10, 1):
    add("02-CHOPIN-Estudos/Op-10", i, f"Estudo op. 10 n.º {i}", tom,
        f"{KRN}/010-1b-Sm-{i:03d}.krn", tipo="krn")
for i, tom in enumerate(OP25, 1):
    add("02-CHOPIN-Estudos/Op-25", i, f"Estudo op. 25 n.º {i}", tom,
        f"{KRN}/025-1b-LE-{i:03d}.krn", tipo="krn")

# ---------------- BEETHOVEN: Sonata op. 27 n.2 --------------
MOON = f"{MUT}/BeethovenLv/O27/moonlight/moonlight-lys"
for n,(mv,nome) in enumerate([("1","I. Adagio sostenuto"),
                              ("2","II. Allegretto"),
                              ("3","III. Presto agitato")], 1):
    add("03-BEETHOVEN-Sonata-Luar-op-27-n-2", n, nome,
        "Sonata quasi una Fantasia, op. 27 n.º 2", f"{MOON}/moonlight{mv}-a4.ly")

# ---------------- LEITURA A PRIMEIRA VISTA ------------------
LEITURA = [
 (1,"Siciliano","August Eberhardt Müller (1767-1817)", f"{MUT}/MuellerAE/muller-siciliano/muller-siciliano.ly"),
 (2,"In May","Franz Behr (1837-1898)", f"{MUT}/BehrF/in_may_piano/in_may_piano.ly"),
 (3,"Les étoiles d’or","Streabbog / Louis Gobbaerts (1835-1886)", f"{MUT}/GobbaertsL/Les_Etoiles_dOr_No1/Les_Etoiles_dOr_No1.ly"),
 (4,"Possum and Taters","Charles Hunter (1876-1906)", f"{MUT}/HunterC/PossumAndTaters/PossumAndTaters.ly"),
 (5,"Gondellied, op. 4","Dora Pejačević (1885-1923)", f"{MUT}/PejacsevichD/O4/Gondellied/Gondellied.ly"),
 (6,"Prelúdio no modo lídio","Alexei Stanchinsky (1888-1914)", f"{MUT}/StanchinskyAV/pilm/pilm.ly"),
]
for n, tit, comp, src in LEITURA:
    add("05-LEITURA-A-PRIMEIRA-VISTA", n, tit, comp, src)

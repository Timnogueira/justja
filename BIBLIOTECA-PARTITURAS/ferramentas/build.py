# -*- coding: utf-8 -*-
"""Gravação de toda a biblioteca: Mutopia(.ly)->LilyPond e NIFC(.krn)->Verovio."""
import os, re, sys, json, shutil, subprocess, unicodedata, tempfile, traceback
from concurrent.futures import ProcessPoolExecutor, as_completed

sys.path.insert(0, "/tmp/build")
from manifesto import M

LILY  = "/usr/local/lib/python3.11/dist-packages/lilypond-binaries/bin/lilypond"
CONV  = "/usr/local/lib/python3.11/dist-packages/lilypond-binaries/bin/convert-ly"
STYLE = "/tmp/build/style"
OUT   = "/home/user/justja/BIBLIOTECA-PARTITURAS"
WORK  = "/tmp/build/work"

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[“”\"'’.,:;()]", "", s)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")
    return s

WRAPPER = '''\\include "padrao.ily"
\\include "creditos.ily"
\\include "{orig}"
\\header {{ tagline = \\creditoMutopia }}
'''

def build_ly(e, destino):
    src = e["fonte"]
    srcdir = os.path.dirname(src)
    wd = tempfile.mkdtemp(prefix="ly_", dir=WORK)
    shutil.copytree(srcdir, os.path.join(wd, "s"), ignore_dangling_symlinks=True,
                    ignore=shutil.ignore_patterns("Makefile"))
    sdir = os.path.join(wd, "s")
    orig = os.path.basename(src)
    build = os.path.join(sdir, "_build.ly")

    def run():
        extra = "\n".join(f'  {k} = {v}' for k, v in e.get("hdr", {}).items())
        open(build, "w").write(WRAPPER.format(orig=orig, extra=extra))
        return subprocess.run(
            [LILY, "-I", STYLE, "-I", sdir, "-dno-point-and-click",
             "--pdf", "-o", os.path.join(wd, "saida"), build],
            capture_output=True, text=True, timeout=400, cwd=sdir)

    r = run()
    pdf = os.path.join(wd, "saida.pdf")
    if not os.path.exists(pdf):
        # tentativa 2: atualizar sintaxe antiga com convert-ly
        subprocess.run([CONV, "-e", os.path.join(sdir, orig)],
                       capture_output=True, text=True, timeout=200, cwd=sdir)
        r = run()
        pdf = os.path.join(wd, "saida.pdf")
    if not os.path.exists(pdf):
        shutil.rmtree(wd, ignore_errors=True)
        return False, (r.stderr or "")[-600:]
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.move(pdf, destino)
    shutil.rmtree(wd, ignore_errors=True)
    return True, ""

VEROVIO_OPTS = {
    "pageWidth": 2100, "pageHeight": 2970,
    "pageMarginLeft": 150, "pageMarginRight": 150,
    "pageMarginTop": 100, "pageMarginBottom": 120,
    "scale": 40, "adjustPageHeight": False,
    "breaks": "auto", "footer": "none", "header": "encoded",
    "smuflTextFont": "embedded",
}

def build_krn(e, destino):
    import verovio, cairosvg, pymupdf
    tk = verovio.toolkit()
    tk.setOptions(VEROVIO_OPTS)
    if not tk.loadFile(e["fonte"]):
        return False, "verovio nao carregou o arquivo"
    n = tk.getPageCount()
    wd = tempfile.mkdtemp(prefix="krn_", dir=WORK)
    doc = pymupdf.open()
    for p in range(1, n + 1):
        svg = tk.renderToSVG(p)
        m = re.match(r'<svg width="(\d+)px" height="(\d+)px"', svg)
        svg = re.sub(r'^<svg width="\d+px" height="\d+px"',
                     f'<svg width="210mm" height="297mm" '
                     f'viewBox="0 0 {m.group(1)} {m.group(2)}"', svg, count=1)
        sp = os.path.join(wd, f"p{p}.svg")
        pp = os.path.join(wd, f"p{p}.pdf")
        open(sp, "w").write(svg)
        cairosvg.svg2pdf(url=sp, write_to=pp)
        doc.insert_pdf(pymupdf.open(pp))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    doc.save(destino, garbage=4, deflate=True)
    doc.close()
    shutil.rmtree(wd, ignore_errors=True)
    return True, ""

def tarefa(e):
    destino = os.path.join(OUT, e["colecao"],
                           f"{e['ordem']:02d}-{slug(e['titulo'])}.pdf")
    try:
        ok, err = (build_krn if e["tipo"] == "krn" else build_ly)(e, destino)
    except Exception:
        ok, err = False, traceback.format_exc()[-600:]
    pags = 0
    if ok:
        import pymupdf
        with pymupdf.open(destino) as d:
            pags = d.page_count
    return dict(colecao=e["colecao"], ordem=e["ordem"], titulo=e["titulo"],
                sub=e["sub"], tipo=e["tipo"], fonte=e["fonte"],
                arquivo=os.path.relpath(destino, OUT), ok=ok, erro=err, paginas=pags)

if __name__ == "__main__":
    os.makedirs(WORK, exist_ok=True)
    res = []
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        futs = {ex.submit(tarefa, e): e for e in M}
        for i, f in enumerate(as_completed(futs), 1):
            r = f.result()
            res.append(r)
            print(f"[{i}/{len(M)}] {'OK ' if r['ok'] else 'ERRO'} "
                  f"{r['paginas']:>2}p  {r['titulo']} — {r['sub']}", flush=True)
    res.sort(key=lambda r: (r["colecao"], r["ordem"]))
    json.dump(res, open("/tmp/build/resultado.json", "w"), ensure_ascii=False, indent=1)
    falhas = [r for r in res if not r["ok"]]
    print(f"\n=== {len(res)-len(falhas)}/{len(res)} gravadas | {len(falhas)} falhas ===")
    for r in falhas:
        print(" FALHA:", r["titulo"], "|", r["sub"], "|", r["fonte"])

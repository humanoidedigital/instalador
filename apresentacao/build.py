#!/usr/bin/env python3
"""Junta a apresentação num único arquivo HTML (imagens, nichos e bibliotecas embutidos).

Uso:  python3 build.py
Gera: dist/ribeker-apresentacao.html  → abre em qualquer navegador, funciona offline
      dist/artifact.html              → mesma página, sem <html>/<head>/<body>, para publicar como Artifact
"""
import base64
import mimetypes
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent
DIST = RAIZ / 'dist'


def ler(rel):
    return (RAIZ / rel).read_text(encoding='utf-8')


def data_uri(rel):
    caminho = RAIZ / rel
    tipo = mimetypes.guess_type(caminho.name)[0] or 'application/octet-stream'
    return 'data:%s;base64,%s' % (tipo, base64.b64encode(caminho.read_bytes()).decode('ascii'))


def embutir_imagens(js):
    # troca 'assets/arquivo.png' (ou .jpg/.webp/.svg) pelo conteúdo da imagem
    def troca(m):
        rel = m.group(2)
        if not (RAIZ / rel).exists():
            print('Aviso: imagem não encontrada, ficou como caminho: ' + rel)
            return m.group(0)
        return m.group(1) + data_uri(rel) + m.group(1)
    return re.sub(r"(['\"])(assets/[\w./-]+\.(?:png|jpe?g|webp|svg|gif))\1", troca, js)


def script_inline(conteudo, origem):
    if re.search(r'</script', conteudo, re.I):
        raise SystemExit('Encontrei "</script" dentro de ' + origem + '; troque por "<\\/script".')
    return '<script>/* ' + origem + ' */\n' + conteudo + '\n</script>'


def main():
    html = ler('index.html')

    def troca_script(m):
        src = m.group(1)
        if src.startswith('http'):
            return m.group(0)
        js = ler(src)
        if src == 'marca.js' or src.startswith('nichos/'):
            js = embutir_imagens(js)
        return script_inline(js, src)

    html = re.sub(r'<script src="([^"]+)"></script>', troca_script, html)

    # bibliotecas do PDF antes do motor, para o relatório funcionar sem internet
    libs = ''.join(script_inline(ler('vendor/' + f), 'vendor/' + f) for f in ('html2canvas.min.js', 'jspdf.umd.min.js'))
    html = html.replace('<script>/* motor.js */', libs + '\n<script>/* motor.js */', 1)

    DIST.mkdir(exist_ok=True)
    completo = DIST / 'ribeker-apresentacao.html'
    completo.write_text(html, encoding='utf-8')

    # versão Artifact: só o conteúdo (o publicador acrescenta doctype, head e body)
    art = re.sub(r'<!DOCTYPE html>\s*', '', html)
    art = re.sub(r'</?html[^>]*>\s*', '', art)
    art = re.sub(r'</?head>\s*', '', art)
    art = re.sub(r'</?body>\s*', '', art)
    art = re.sub(r'<meta charset="UTF-8">\s*', '', art)
    art = re.sub(r'<meta name="viewport"[^>]*>\s*', '', art)
    art = re.sub(r'<meta name="robots"[^>]*>\s*', '', art)
    (DIST / 'artifact.html').write_text(art, encoding='utf-8')

    for f in (completo, DIST / 'artifact.html'):
        print('%-40s %7.0f KB' % (f.relative_to(RAIZ), f.stat().st_size / 1024))


if __name__ == '__main__':
    main()

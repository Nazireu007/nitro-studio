# Fontes no Nitro Studio

Nesta rodada, o Nitro Studio não empacota arquivos de fontes comerciais nem baixa fontes de servidores externos.

## Fontes do Nitro / Sistema

As opções iniciais usam famílias comuns disponíveis no sistema operacional ou navegador do usuário:

- Arial
- Georgia
- Trebuchet MS
- Impact
- Courier New
- Comic Sans MS

Essas fontes são referenciadas pelo nome de família CSS. Nenhum arquivo `.ttf`, `.otf`, `.woff` ou `.woff2` dessas famílias é distribuído dentro deste projeto.

## Fontes importadas pelo usuário

O usuário pode importar fontes nos formatos:

- TTF
- OTF
- WOFF
- WOFF2

As fontes importadas:

- são validadas no navegador;
- são carregadas com `FontFace`;
- ficam salvas localmente em IndexedDB;
- não são enviadas para servidor;
- não são disponibilizadas para download pela interface.

Aviso exibido no produto: use somente fontes que você possui autorização para utilizar.

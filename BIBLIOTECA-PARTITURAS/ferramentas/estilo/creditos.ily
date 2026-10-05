%% Linha de credito compacta e uniforme.
%% Mantem a atribuicao exigida pela licenca CC BY-SA 3.0 das
%% edicoes do Mutopia Project, sem estourar a largura da pagina.
creditoMutopia =
\markup \center-column {
  \vspace #0.6
  \line { \fontsize #-4
    \concat { "Edição: Mutopia Project (mutopiaproject.org) · gravura de " \fromproperty #'header:maintainer " · licença CC BY-SA 3.0" } }
  \line { \fontsize #-4.5 "Obra em domínio público · Biblioteca de Partituras" }
}

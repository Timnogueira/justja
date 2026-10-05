%% ---------------------------------------------------------------
%% Folha de estilo unica da Biblioteca de Partituras
%% A4 | pauta 20 | margens largas | respiro entre sistemas
%% Incluida em todas as pecas via -dinclude-settings
%% ---------------------------------------------------------------

#(set-global-staff-size 20)

\paper {
  #(set-paper-size "a4")

  left-margin   = 15\mm
  right-margin  = 15\mm
  top-margin    = 10\mm
  bottom-margin = 12\mm

  system-system-spacing =
    #'((basic-distance . 15) (minimum-distance . 12) (padding . 4) (stretchability . 40))
  score-system-spacing =
    #'((basic-distance . 16) (minimum-distance . 14) (padding . 5) (stretchability . 40))
  markup-system-spacing =
    #'((basic-distance . 10) (minimum-distance . 6) (padding . 3) (stretchability . 30))
  top-system-spacing =
    #'((basic-distance . 10) (minimum-distance . 8) (padding . 3) (stretchability . 20))
  last-bottom-spacing =
    #'((basic-distance . 6) (minimum-distance . 4) (padding . 3) (stretchability . 60))

  ragged-last-bottom = ##t
  ragged-bottom      = ##f

  print-page-number       = ##t
  print-first-page-number = ##f
  oddHeaderMarkup   = \markup \null
  evenHeaderMarkup  = \markup \null
}

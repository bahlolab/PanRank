
library(tidyverse)

write_csv_gz <- function(data, fn) {
  gz_con <- gzfile(fn, "wb", compression = 9)
  write_csv(data, gz_con)
  close(gz_con)
} 

MIM <-
  read_tsv(
    'https://www.omim.org/static/omim/data/mim2gene.txt',
    skip = 4,
    col_names = c('mim_id', 'mim_type', 'entrez', 'symbol', 'ensembl')
  ) %>% 
  filter(mim_type == 'gene') %>% 
  select(-mim_type) %>% 
  select(`Ensembl` = ensembl,
         OMIM = mim_id) %>% 
  na.omit() %>% 
  distinct() %>% 
  arrange(as.integer(OMIM)) %>% 
  group_by(Ensembl) %>% 
  slice(1) %>% 
  ungroup()

DATA <-
  read_tsv('~/dev/PanRank/PanRankNF/run/output-pub-240806/panrank_scores.tsv') %>% 
  select(panel, path) %>% 
  # mutate(panel = str_remove(panel, 'G4E_') %>% str_replace('ALL', 'Epilepsy')) %>% 
  mutate(data = map(path, read_tsv, col_types = cols())) %>% 
  select(-path) %>% 
  unnest(data) %>% 
  select(
    panel, 
    `Ensembl` = gene_id, 
    `Known Inheritance` = train_class,
    `PanRank Recessive` = response_REC,
    `PanRank Dominant`  = response_DOM
  ) %>% 
  mutate(`Known Inheritance` = case_when(
    `Known Inheritance` == 'NEG' ~ '-',
    `Known Inheritance` == 'DOM' ~ 'Dominant',
    `Known Inheritance` == 'REC' ~ 'Recessive',
    TRUE                 ~ 'Other'
  )) %>% 
  complete(panel, Ensembl) %>% 
  mutate(across(starts_with('PanRank'), round, 5)) %>% 
  mutate(across(starts_with('PanRank'), signif, 3)) %>% 
  mutate(across(starts_with('PanRank'), as.character)) %>% 
  mutate(across(starts_with('PanRank'), replace_na, '')) %>% 
  mutate(
    Symbol      = cavalier::hgnc_ensembl2sym(`Ensembl`),
    `NCBI Gene` = cavalier::hgnc_ensembl2entrez(`Ensembl`)
    ) %>%
  left_join(MIM, by = 'Ensembl') %>% 
  arrange(panel, Symbol) %>% 
  split.data.frame(.$panel) %>% 
  map(function(x) {
    list(
      fixed  = select(x, Symbol, `NCBI Gene`, Ensembl, OMIM),
      scores = select(x, `Known Inheritance`, starts_with('PanRank'))
    )
  })

stopifnot(
   all(map_lgl(map(DATA, 'fixed'), ~ all(. == first(DATA)$fixed)))
)

# Genes4Epilepsy

write_csv_gz(first(DATA)$fixed, '~/dev/panrank-web/data/fixed.csv.gz')

walk2(map(DATA, 'scores'), names(DATA), function(scores, name) {
  write_csv_gz(scores, str_c('~/dev/panrank-web/data/', name, '.csv.gz'))
})
  



library(tidyverse)

X <- tibble(x = rnorm(1000), y=map_dbl(x, ~ rnorm(1, mean = .)), class = x > 0)
plot(pROC::roc(predictor = X$y, response = X$class))

expand_grid(
  mean = seq(-0.5, 0.5, by = 0.1), 
  sd = seq(0, 2, by = 0.2)
  ) %>% 
  mutate(data = map2(mean, sd, function(mean, sd) {
    tibble(
      x = rnorm(mean = mean, 1000),
      pred = map_dbl(x, ~ rnorm(n = 1, mean = ., sd = sd)),
      resp = x > 0
    )
  })) %>%
  mutate(roc = map(data, function(data) {
    suppressMessages(
      with(data, pROC::roc(predictor = pred, response = resp))
    )
  })) %>% 
  mutate(auc = map_dbl(roc, 'auc')) %>% 
  ggplot(aes(mean, sd, fill = auc)) +
  geom_tile()

panels <-
  list.files('docs/data') %>% 
  setdiff(c('paa_names.tsv', "fixed.csv.gz")) %>% 
  str_remove('.csv.gz')

sim_roc <-
  expand_grid(panel = panels, class = c('Dominant', 'Recessive')) %>% 
  mutate(sd = if_else(
    class == 'Dominant',
    rnorm(n = n(), mean = 1, sd = 0.5),
    rnorm(n = n(), mean = 2, sd = 0.5))
  ) %>% 
  mutate(roc = map(sd, function(SD) {
    data <-
      tibble(
        x = rnorm(mean = 1, 1000),
        pred = map_dbl(x, ~ rnorm(n = 1, mean = ., sd = SD)),
        resp = x > 0
      )
    suppressMessages(
      with(data, pROC::roc(predictor = pred, response = resp))
    )
  })) %>% 
  mutate(
    auc = map_dbl(roc, 'auc'),
    specificity = map(roc, 'specificities'),
    sensitivity = map(roc, 'sensitivities')) %>% 
  select(-roc) %>% 
  unnest(c(specificity, sensitivity))

sim_roc %>% 
  ggplot(aes(1 - specificity, sensitivity, col = class)) +
  geom_line() +
  facet_wrap(~panel)


sim_roc %>% 
  select(panel, class, `spec1m` = specificity, sens = sensitivity) %>% 
  mutate(`spec1m`  = 1 - `spec1m`) %>% 
  group_by(panel, class) %>% 
  mutate(rowid = row_number()) %>% 
  ungroup() %>% 
  pivot_wider(names_from = class, values_from = c(spec1m, sens)) %>% 
  select(-rowid) %>% 
  nest(data = -panel) %>% 
  pwalk(function(panel, data) {
    write_csv(data, str_c('data/', panel, '.roc.csv.gz'))
  })

\set ON_ERROR_STOP on
\ir b07-c2c-staging-schema-overlay.sql
\ir ../database/b07-l07-01-c2c-swap-v1-completion-compat.sql
\ir b07-c2c-postgres-regression-base.sql
\ir ../database/b07-l07-01-c2c-swap-v1-pickup.sql
\ir ../database/b07-l07-01-c2c-swap-v1-pickup-completion-compat.sql
\ir b07-c2c-pickup-postgres-regression.sql
\ir b07-pickup-messages-bootstrap.sql
\ir ../database/b07-l07-01-pickup-messages-v1.sql
\ir b07-pickup-messages-postgres-regression.sql
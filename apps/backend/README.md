# Cifro API

API FastAPI do Cifro.

## Rodar localmente

Na raiz do projeto:

```bash
source .venv/bin/activate
python -m uvicorn apps.backend.app.main:app --reload --port 8000
```

Variáveis mínimas no `.env`:

```env
DATABASE_URL=...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=...
CORS_ORIGINS=http://localhost:3000
DB_POOL_ENABLED=false
DB_CONNECT_TIMEOUT_SECONDS=5
DB_STATEMENT_TIMEOUT_MS=5000
DB_LOCK_TIMEOUT_MS=1000
PERF_LOG_ENABLED=false
PERF_LOG_SAMPLE_RATE=1
```

O backend valida o token de sessão recebido no cabeçalho `Authorization` usando
o endpoint de autenticação do Supabase. A chave `SUPABASE_ANON_KEY` pode ser a
publishable/anon key do projeto; nunca use a `service_role` no frontend.

O pool de conexões é opcional e permanece desligado por padrão. Ative-o apenas
depois de calcular o limite de conexões para o ambiente publicado. As respostas
da API financeira usam `Cache-Control: private, no-store`, e a observabilidade
registrada pelo backend não inclui bodies, query strings, tokens ou dados
financeiros.

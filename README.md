# ARCA - Sistema de Gestão para Clínicas de Psicologia

Plataforma SaaS multi-tenant de gestão para clínicas de psicologia. O ARCA facilita o gerenciamento de pacientes, atendimentos, documentos e relatórios, oferecendo controle de acesso baseado em funções, auditoria completa das operações e isolamento de dados entre clínicas (tenants).

## 🎯 Visão Geral

O sistema ARCA (Ambiente de Registro e Controle de Atendimentos) é uma solução full-stack multi-tenant projetada para atender múltiplas clínicas de psicologia de forma isolada e segura, proporcionando:

- **Multi-tenant**: Isolamento completo de dados entre clínicas distintas
- **Gestão de Pacientes**: Cadastro completo com dados pessoais e histórico
- **Lista de Espera**: Controle de candidatos aguardando atendimento
- **Agendamento**: Sistema de marcação e controle de consultas
- **Documentação**: Upload e gerenciamento de documentos
- **Relatórios**: Geração de relatórios de alta e acompanhamento
- **Auditoria**: Log completo de todas as operações realizadas
- **Controle de Acesso**: Sistema de roles para estagiários e supervisores

### Status Atual

O backend está estabilizado (segurança, RBAC, auditoria, testes). O frontend está em reconstrução ativa a partir do zero — a estrutura antiga (pré-reescrita) segue apenas como referência de regras de negócio, não como fonte de verdade. Ver `CLAUDE.md` para detalhes de arquitetura atualizados.

## 🏗️ Arquitetura

Este é um monorepo gerenciado pelo [Turborepo](https://turborepo.org/) contendo:

### Aplicações

- **`backend`**: API REST desenvolvida em [NestJS](https://nestjs.com/) com PostgreSQL
- **`frontend`**: Interface web em [Next.js](https://nextjs.org/) com TypeScript e TailwindCSS

### Tecnologias Principais

- **Backend**: NestJS, Prisma ORM, PostgreSQL
- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Desenvolvimento**: TypeScript, ESLint, Prettier
- **Deploy**: Docker + Coolify (CD automático)

## 🚀 Início Rápido

### Pré-requisitos

- Node.js >= 18
- PostgreSQL
- npm >= 10

### Instalação

1. **Clone o repositório**

   ```bash
   git clone https://github.com/pedrokourly/arca.git
   cd arca
   ```

2. **Instale as dependências**

   ```bash
   npm install
   ```

3. **Configure o banco de dados**

   ```bash
   # Crie um arquivo .env no diretório backend
   cp apps/backend/.env.example apps/backend/.env
   
   # Configure a string de conexão do PostgreSQL
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/arca_db"
   ```

4. **Execute as migrações**

   ```bash
   cd apps/backend
   npx prisma migrate dev
   ```

5. **Inicie o desenvolvimento**

   ```bash
   # Volta para a raiz do projeto
   cd ../..
   
   # Inicia backend (porta 3333) e frontend (porta 3000) simultaneamente
   npm run dev
   ```

### Acesso ao Sistema

- **Frontend**: <http://localhost:3000>
- **Backend API**: <http://localhost:3333>
- **Prisma Studio**: `npx prisma studio` (no diretório backend)

## 📋 Funcionalidades

### Gestão de Usuários

- Cadastro de estagiários e supervisores
- Controle de acesso baseado em roles
- Autenticação segura

### Gestão de Pacientes

- Cadastro completo com dados demográficos
- Histórico de atendimentos
- Relatórios de progresso
- Lista de espera organizada

### Sistema de Atendimentos

- Agendamento de consultas
- Registro de observações
- Status de acompanhamento
- Histórico completo

### Documentação

- Upload de arquivos
- Versionamento de documentos
- Relatórios de alta
- Controle de acesso aos documentos

### Auditoria e Compliance

- Log de todas as operações
- Rastreabilidade completa
- Relatórios de auditoria
- Conformidade com LGPD

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia backend e frontend em paralelo
npm run dev:backend  # Apenas backend (porta 3333)
npm run dev:frontend # Apenas frontend (porta 3000)

# Build
npm run build        # Build de produção de ambas as aplicações

# Qualidade de código
npm run lint         # ESLint em todo o projeto
npm run format       # Prettier para formatação
npm run check-types  # Verificação de tipos TypeScript

# Base de dados
cd apps/backend
npx prisma migrate dev    # Executa migrações
npx prisma studio        # Interface visual do banco
npx prisma generate      # Regenera o cliente Prisma
```

## 📁 Estrutura do Projeto

```text
arca/
├── apps/
│   ├── backend/              # API NestJS
│   │   ├── src/
│   │   │   ├── app/         # Módulos da aplicação
│   │   │   ├── prisma/      # Configuração Prisma
│   │   │   └── main.ts      # Bootstrap da aplicação
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Schema do banco de dados
│   │   │   └── migrations/   # Migrações do banco
│   │   └── package.json
│   └── frontend/             # Interface Next.js (em reconstrução)
│       ├── app/
│       │   ├── (auth)/       # Rotas autenticadas, incl. /plataforma
│       │   ├── (external)/   # Rotas públicas
│       │   └── api/          # Route Handlers (NextAuth)
│       └── package.json
├── packages/                 # Packages compartilhados (futuro: domain)
├── turbo.json               # Configuração Turborepo
└── package.json             # Configuração raiz
```

## 🗄️ Modelo de Dados

O sistema utiliza um modelo relacional robusto com as seguintes entidades principais:

- **Usuários**: Estagiários e supervisores com roles específicos
- **Pacientes**: Dados completos incluindo responsáveis
- **Atendimentos**: Sessões com timestamps e observações
- **Documentos**: Arquivos e relatórios com versionamento
- **Lista de Espera**: Candidatos aguardando atendimento
- **Logs de Auditoria**: Rastreabilidade completa de operações

## 🔒 Segurança e Compliance

- Autenticação baseada em JWT (audience/issuer validados)
- Controle de acesso granular por roles (RBAC)
- Criptografia de senhas com hash seguro
- Logs de auditoria para compliance
- Validação de dados em múltiplas camadas
- Conformidade com LGPD

## 🚢 Deploy

- **Coolify**: CD com deploy automático a cada push (backend e frontend)
- **Supabase**: PostgreSQL gerenciado
- **Docker**: Containerização para build e deploy

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto é licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Equipe

Desenvolvido por Pedro Kourly.

---

**ARCA** - Transformando a gestão de clínicas de psicologia através da tecnologia

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Lock,
  ShieldCheck,
  ArrowLeft,
  Building,
  Mail,
  UserCheck,
  Database,
  Eye,
  FileText,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidade (LGPD) | MAYaMenu",
  description:
    "Diretrizes de Proteção de Dados e Privacidade da plataforma MAYaMenu, em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD). Operada por MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) - CNPJ 70.099.118/0001-02.",
};

export default function PoliticaPrivacidadePage() {
  const dataAtualizacao = "11 de Novembro de 2026";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-rose-600 selection:text-white">
      {/* BARRA SUPERIOR DE NAVEGAÇÃO */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Conformidade LGPD (Lei 13.709/18)
            </span>
          </div>
        </div>
      </header>

      {/* HERO / CABEÇALHO DO DOCUMENTO */}
      <div className="bg-white border-b border-slate-200 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 mb-3">
                <Lock className="w-3.5 h-3.5" />
                <span>Privacidade, Transparência & Governança de Dados</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
                Política de Privacidade
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                Saiba como a plataforma MAYaMenu protege, trata e gerencia os dados pessoais de estabelecimentos parceiros e de consumidores finais, em estrito cumprimento à Lei Geral de Proteção de Dados (LGPD).
              </p>
            </div>

            {/* BOX DO ENCARREGADO (DPO) E DADOS DA EMPRESA */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 shrink-0 sm:max-w-xs shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider text-blue-600">
                <Building className="w-3.5 h-3.5" /> Controlador & Operador
              </div>
              <p className="font-semibold text-slate-950">
                MAYARANAS SISTEMAS INOVA SIMPLES (I.S.)
              </p>
              <p className="text-slate-600">CNPJ: 70.099.118/0001-02</p>
              <p className="text-slate-600">Sede & Foro: Horizonte, Ceará, Brasil</p>
              <p className="text-slate-600 font-medium text-[11px] pt-1 border-t border-slate-200">
                Encarregado (DPO): contato@mayamenu.com.br
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL COM SUMÁRIO E ARTIGOS */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SUMÁRIO NAVEGÁVEL */}
          <aside className="lg:col-span-4 order-2 lg:order-1">
            <div className="sticky top-24 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Sumário de Privacidade
              </h3>
              <nav className="flex flex-col space-y-1.5 text-xs font-medium text-slate-600">
                <a href="#lgpd1" className="hover:text-blue-600 py-1 transition-colors">
                  1. Papéis na LGPD: Quem é Quem
                </a>
                <a href="#lgpd2" className="hover:text-blue-600 py-1 transition-colors">
                  2. Dados Pessoais Coletados
                </a>
                <a href="#lgpd3" className="hover:text-blue-600 py-1 transition-colors">
                  3. Finalidades e Bases Legais
                </a>
                <a href="#lgpd4" className="hover:text-blue-600 py-1 transition-colors">
                  4. Compartilhamento Seguro
                </a>
                <a href="#lgpd5" className="hover:text-blue-600 py-1 transition-colors">
                  5. Segurança e Armazenamento
                </a>
                <a href="#lgpd6" className="hover:text-blue-600 py-1 transition-colors">
                  6. Retenção e Descarte
                </a>
                <a href="#lgpd7" className="hover:text-blue-600 py-1 transition-colors">
                  7. Direitos dos Titulares (Art. 18)
                </a>
                <a href="#lgpd8" className="hover:text-blue-600 py-1 transition-colors">
                  8. Canal do Encarregado (DPO)
                </a>
              </nav>

              <div className="pt-3 border-t border-slate-200">
                <Link
                  href="/termos-de-uso"
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ver Termos de Uso (SaaS)</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* CLÁUSULAS DE PRIVACIDADE */}
          <article className="lg:col-span-8 order-1 lg:order-2 space-y-10 text-sm leading-relaxed text-slate-700">
            {/* 1. PAPÉIS NA LGPD */}
            <section id="lgpd1" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                Distinção Clara de Papéis na LGPD (Controlador vs Operador)
              </h2>
              <p>
                Em conformidade com o Art. 5º da Lei nº 13.709/2018 (LGPD), a <strong>MAYARANAS SISTEMAS INOVA SIMPLES (I.S.)</strong> opera em duas posições jurídicas distintas e bem delimitadas:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                    Como CONTROLADORA
                  </span>
                  <p className="text-xs text-slate-600 leading-snug">
                    A MAYARANAS SISTEMAS é Controladora dos dados cadastrais dos <strong>donos de estabelecimentos e administradores</strong> (nome, e-mail de login, CNPJ/CPF, telefone de contato e dados para emissão de Nota Fiscal do SaaS).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-emerald-700" />
                    Como OPERADORA
                  </span>
                  <p className="text-xs text-slate-600 leading-snug">
                    A MAYARANAS SISTEMAS atua como Operadora técnica dos dados dos <strong>consumidores finais do restaurante</strong> (identificação de comanda, pedidos e WhatsApp eventual), processando-os estritamente em nome e por ordem do <strong>Restaurante (que é o Controlador de seus clientes)</strong>.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. DADOS COLETADOS */}
            <section id="lgpd2" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                Dados Pessoais Coletados e Tratados
              </h2>
              <p>
                A plataforma MAYaMenu adota o princípio da <strong>minimização de dados</strong> (Art. 6º, III da LGPD), coletando exclusivamente o necessário para o funcionamento do cardápio e a operação dos pedidos:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong>Dados do Estabelecimento Lojista:</strong> Razão social, nome fantasia, CNPJ ou CPF do responsável, endereço de e-mail corporativo, número de telefone com WhatsApp, endereço físico da loja e dados bancários/fiscais para emissão de Nota Fiscal Eletrônica (NFS-e).
                </li>
                <li>
                  <strong>Dados do Consumidor do Salão:</strong> Nome ou apelido informado voluntariamente para identificar a mesa/comanda, número de telefone com WhatsApp (caso o cliente opte por receber avisos do pedido ou comprovante) e histórico dos itens consumidos naquela sessão.
                </li>
                <li>
                  <strong>Dados de Conexão e Dispositivo:</strong> Endereço IP, data e hora de cada acesso, tipo de navegador e identificador de sessão (armazenados estritamente em cumprimento ao <strong>Artigo 15 da Lei nº 12.965/2014 - Marco Civil da Internet</strong>).
                </li>
                <li>
                  <strong>Cookies e Tecnologias Locais:</strong> Utilizamos estritamente armazenamento local (Local Storage e Service Workers PWA) essenciais para manter o carrinho da mesa aberto mesmo em caso de oscilação do Wi-Fi. <strong>Não utilizamos cookies para venda de dados a anunciantes terceiros.</strong>
                </li>
              </ul>
            </section>

            {/* 3. FINALIDADES E BASES LEGAIS */}
            <section id="lgpd3" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                Finalidades do Tratamento e Bases Legais da LGPD
              </h2>
              <p>
                Todo o tratamento de dados realizado pela MAYARANAS SISTEMAS é respaldado em bases legais expressas do Artigo 7º da LGPD:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong>Execução de Contrato (Art. 7º, V):</strong> Viabilizar a exibição do cardápio, recepção e disparo de pedidos para a cozinha (KDS) e telas dos garçons, fechamento de comandas e gerenciamento da assinatura Pro.
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong>Cumprimento de Obrigação Legal ou Regulatória (Art. 7º, II):</strong> Guarda de registros de aplicação pelo prazo de 6 meses (Marco Civil da Internet) e guarda de registros contábeis/fiscais por 5 anos (Código Tributário Nacional).
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong>Legítimo Interesse e Segurança (Art. 7º, IX):</strong> Prevenção a acessos não autorizados, mitigação de fraudes, integridade das transações e suporte técnico preventivo.
                </div>
              </div>
            </section>

            {/* 4. COMPARTILHAMENTO SEGURO */}
            <section id="lgpd4" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                Compartilhamento Seguro de Dados (Sem Venda de Informações)
              </h2>
              <p>
                A MAYARANAS SISTEMAS adota política estrita: <strong>jamais vendemos, alugamos ou comercializamos listas de clientes, cardápios ou dados de consumo com terceiros, corretores ou anunciantes</strong>.
              </p>
              <p>
                O compartilhamento de dados ocorre exclusivamente com provedores essenciais e sob contratos com rigorosas cláusulas de sigilo e confidencialidade:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                <li>
                  <strong>Infraestrutura de Nuvem e Banco de Dados:</strong> Google Cloud Platform e Firebase (com infraestrutura certificada ISO 27001, SOC 2 e em conformidade com a LGPD);
                </li>
                <li>
                  <strong>Gateway de Processamento de Pagamento:</strong> Mercado Pago, estritamente para o processamento da contratação pré-paga do Plano Pro entre o estabelecimento e a MAYARANAS SISTEMAS;
                </li>
                <li>
                  <strong>Órgãos Públicos e Fiscais:</strong> Secretaria de Finanças e Receita Federal para emissão de notas fiscais e obrigações tributárias, ou cumprimento de ordem judicial específica.
                </li>
              </ul>
            </section>

            {/* 5. SEGURANÇA */}
            <section id="lgpd5" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                Medidas Técnicas e Segurança da Informação
              </h2>
              <p>
                Adotamos salvaguardas técnicas e administrativas para proteger os dados pessoais contra acessos não autorizados, vazamentos ou perda:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Criptografia HTTPS/TLS de 256 bits em todo o tráfego</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Senhas com Hashing Criptográfico irreversível</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Isolamento Multi-tenant (um restaurante não acessa dados de outro)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Logs auditáveis de transações administrativas</span>
                </div>
              </div>
            </section>

            {/* 6. RETENÇÃO E DESCARTE */}
            <section id="lgpd6" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  6
                </span>
                Prazos de Retenção e Descarte Seguro
              </h2>
              <p>
                Os dados pessoais permanecem armazenados pelo período necessário para atingir as finalidades para as quais foram coletados:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                <li>
                  <strong>Dados do Estabelecimento Lojista:</strong> Mantidos enquanto a conta estiver ativa. Após solicitação de cancelamento, os dados são conservados pelo prazo legal prescricional e fiscal (5 anos) e, em seguida, expurgados;
                </li>
                <li>
                  <strong>Comandas e Sessões de Consumo:</strong> As comandas de clientes no salão são arquivadas de forma segura e sumarizada, permitindo relatórios de faturamento pelo lojista. Ao fim do período legal, dados de identificação pessoal são anonimizados;
                </li>
                <li>
                  <strong>Logs de Conexão IP:</strong> Armazenados pelo prazo improrrogável de 6 (seis) meses, conforme o Artigo 15 do Marco Civil da Internet.
                </li>
              </ul>
            </section>

            {/* 7. DIREITOS DOS TITULARES */}
            <section id="lgpd7" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  7
                </span>
                Direitos dos Titulares de Dados (Artigo 18 da LGPD)
              </h2>
              <p>
                Qualquer titular de dados pessoais (seja o lojista parceiro ou o cliente final) possui o direito de solicitar a qualquer tempo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Confirmação da existência de tratamento
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Acesso facilitado aos seus dados
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Correção de dados incompletos ou inexatos
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Eliminação ou anonimização de dados excessivos
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Portabilidade de seus dados a outro fornecedor
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  ✓ Revogação expressa do consentimento
                </div>
              </div>
            </section>

            {/* 8. CANAL DPO */}
            <section id="lgpd8" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  8
                </span>
                Canal Oficial de Atendimento e Encarregado de Dados (DPO)
              </h2>
              <p>
                Para exercer qualquer dos seus direitos previstos na LGPD, esclarecer dúvidas sobre esta Política de Privacidade ou fazer solicitações relacionadas aos seus dados, entre em contato direto com o nosso <strong>Encarregado pelo Tratamento de Dados Pessoais (DPO)</strong>:
              </p>

              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-slate-950 text-xs flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    <span>Encarregado de Proteção de Dados (DPO) — MAYaMenu</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Operado por: MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) • CNPJ: 70.099.118/0001-02
                  </p>
                  <p className="text-xs text-slate-600">
                    Sede: Horizonte, Ceará, Brasil
                  </p>
                </div>

                <a
                  href="mailto:contato@mayamenu.com.br"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>contato@mayamenu.com.br</span>
                </a>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* RODAPÉ */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) - CNPJ 70.099.118/0001-02</p>
          <div className="flex items-center gap-4">
            <Link href="/termos-de-uso" className="hover:text-rose-600 underline underline-offset-2">
              Termos de Uso (SaaS)
            </Link>
            <Link href="/" className="hover:text-rose-600">
              Página Inicial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


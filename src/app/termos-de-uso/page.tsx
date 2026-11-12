import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  FileText,
  ShieldCheck,
  ArrowLeft,
  Building,
  Mail,
  Scale,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Termos de Uso | MAYaMenu",
  description:
    "Termos de Uso e Condições Gerais de Licenciamento da plataforma MAYaMenu (SaaS B2B). Operada por MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) - CNPJ 70.099.118/0001-02.",
};

export default function TermosDeUsoPage() {
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
              Documento Jurídico Oficial
            </span>
          </div>
        </div>
      </header>

      {/* HERO / CABEÇALHO DO DOCUMENTO */}
      <div className="bg-white border-b border-slate-200 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-3">
                <FileText className="w-3.5 h-3.5" />
                <span>Termos e Condições Gerais de Uso (SaaS B2B)</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
                Termos de Uso do MAYaMenu
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                Este instrumento disciplina o licenciamento de software como serviço (SaaS), direitos, deveres e limites operacionais para estabelecimentos gastronômicos cadastrados na plataforma MAYaMenu.
              </p>
            </div>

            {/* BOX INSTITUCIONAL DA OPERADORA */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 shrink-0 sm:max-w-xs shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider text-rose-600">
                <Building className="w-3.5 h-3.5" /> Operadora do Serviço
              </div>
              <p className="font-semibold text-slate-950">
                MAYARANAS SISTEMAS INOVA SIMPLES (I.S.)
              </p>
              <p className="text-slate-600">CNPJ: 70.099.118/0001-02</p>
              <p className="text-slate-600">Sede & Foro: Horizonte, Ceará, Brasil</p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                Última atualização: {dataAtualizacao}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL COM SUMÁRIO E ARTIGOS */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SUMÁRIO NAVEGÁVEL (STICKY NA LATERAL EM TELAS GRANDES) */}
          <aside className="lg:col-span-4 order-2 lg:order-1">
            <div className="sticky top-24 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Sumário do Contrato
              </h3>
              <nav className="flex flex-col space-y-1.5 text-xs font-medium text-slate-600">
                <a href="#art1" className="hover:text-rose-600 py-1 transition-colors">
                  1. Identificação e Objeto
                </a>
                <a href="#art2" className="hover:text-rose-600 py-1 transition-colors">
                  2. Elegibilidade e Cadastro B2B
                </a>
                <a href="#art3" className="hover:text-rose-600 py-1 transition-colors">
                  3. Modalidades: Plano Free e Pro
                </a>
                <a href="#art4" className="hover:text-rose-600 py-1 transition-colors">
                  4. Isenção Operacional do Salão
                </a>
                <a href="#art5" className="hover:text-rose-600 py-1 transition-colors">
                  5. Propriedade Intelectual
                </a>
                <a href="#art6" className="hover:text-rose-600 py-1 transition-colors">
                  6. Nível de Serviço e Garantias
                </a>
                <a href="#art7" className="hover:text-rose-600 py-1 transition-colors">
                  7. Cancelamento e Descumprimento
                </a>
                <a href="#art8" className="hover:text-rose-600 py-1 transition-colors">
                  8. Foro de Eleição e Legislação
                </a>
              </nav>

              <div className="pt-3 border-t border-slate-200">
                <Link
                  href="/politica-de-privacidade"
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Ver Política de Privacidade (LGPD)</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* ARTIGOS E CLÁUSULAS LEGAIS */}
          <article className="lg:col-span-8 order-1 lg:order-2 space-y-10 text-sm leading-relaxed text-slate-700">
            {/* 1. IDENTIFICAÇÃO E OBJETO */}
            <section id="art1" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                Identificação da Operadora e Objeto do SaaS
              </h2>
              <p>
                <strong>1.1. Operadora:</strong> A plataforma <strong>MAYaMenu</strong> é desenvolvida, mantida e operada com exclusividade pela empresa <strong>MAYARANAS SISTEMAS INOVA SIMPLES (I.S.)</strong>, pessoa jurídica de direito privado sob o CNPJ nº <strong>70.099.118/0001-02</strong>, com sede e domicílio no Município de Horizonte, Estado do Ceará, Brasil (doravante denominada simplesmente &ldquo;CONCEDENTE&rdquo; ou &ldquo;MAYARANAS SISTEMAS&rdquo;).
              </p>
              <p>
                <strong>1.2. Objeto:</strong> O presente instrumento tem por objeto a concessão de licença de uso temporária, não exclusiva, intransferível e revogável do software na nuvem (Software as a Service - SaaS) denominado <strong>MAYaMenu</strong>. A plataforma destina-se à digitalização de cardápios via Progressive Web App (PWA), geração de QR Codes dinâmicos de mesa, painel de administração de salão, gestão de pedidos em tempo real para cozinha (KDS) e aplicativo mobile para garçons.
              </p>
              <p>
                <strong>1.3. Ausência de Cessão de Código:</strong> O presente contrato não transfere, sob hipótese alguma, a propriedade intelectual, o código-fonte, marcas ou bancos de dados da plataforma à LICENCIADA, conferindo tão somente o direito de acesso e fruição das funcionalidades contratadas.
              </p>
            </section>

            {/* 2. ELEGIBILIDADE E CADASTRO */}
            <section id="art2" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                Elegibilidade, Cadastro e Responsabilidade de Acesso (B2B)
              </h2>
              <p>
                <strong>2.1. Natureza Empresarial (B2B):</strong> A contratação do MAYaMenu é destinada a estabelecimentos comerciais do setor de alimentação fora do lar (bares, restaurantes, lanchonetes, cafeterias, choperias, buffets, pizzarias e similares), geridos por empresários individuais, microempreendedores (MEI) ou pessoas jurídicas regularmente constituídas.
              </p>
              <p>
                <strong>2.2. Veracidade das Informações:</strong> O responsável pelo estabelecimento declara, sob as penas da lei, que as informações fornecidas no cadastro (nome empresarial, CNPJ/CPF, WhatsApp comercial e e-mail) são exatas, completas e atualizadas.
              </p>
              <p>
                <strong>2.3. Guarda das Credenciais:</strong> A senha e os links de acesso administrativo são de uso estritamente confidencial do estabelecimento. Toda operação, alteração de preço, exclusão de itens de menu ou exclusão de comandas efetuada mediante uso da credencial será imputada juridicamente ao respectivo titular da conta.
              </p>
            </section>

            {/* 3. REGRAS DO PLANO FREE E PRO */}
            <section id="art3" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                Modelo de Negócio Freemium: Regras do Plano Free e Plano Pro
              </h2>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 3.1. Do Plano Free (Degustação Contínua)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O Plano Free é disponibilizado de forma gratuita, por tempo indeterminado, para permitir a experimentação da tecnologia. A MAYARANAS SISTEMAS reserva-se o direito técnico e comercial de, mediante notificação prévia de 30 (trinta) dias no painel ou por e-mail, ajustar as cotas operacionais gratuitas (número de mesas ativas e itens de menu cadastrados), descontinuar recursos experimentais ou estipular limites de armazenamento, não gerando direito à permanência eterna de condições gratuitas inalteradas.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-700">
                  <Sparkles className="w-4 h-4 text-rose-600" /> 3.2. Do Plano Pro (Assinatura Recorrente)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A adesão ao Plano Pro é opcional e confere capacidade ampliada de mesas simultâneas (até 30 mesas), cardápio estendido (até 60 itens de menu), painel KDS de cozinha, módulo do garçom e relatórios de vendas. A contratação é cobrada de forma pré-paga nas opções mensal ou semestral, via gateway regulado (Mercado Pago ou PayPal), com cancelamento a qualquer momento sem incidência de multa de fidelidade.
                </p>
              </div>

              <p>
                <strong>3.3. Emissão de Notas Fiscais (NFS-e):</strong> Para todas as assinaturas pagas do Plano Pro, a MAYARANAS SISTEMAS emitirá a correspondente Nota Fiscal de Serviços Eletrônica (NFS-e) de licenciamento de software, nos termos da legislação tributária municipal de Horizonte/CE e nacional, enviando-a para o e-mail cadastrado pelo estabelecimento.
              </p>
              <p>
                <strong>3.4. Manutenção de Acordos Adquiridos (Grandfathering):</strong> Em respeito à boa-fé objetiva e à segurança jurídica contratual, os estabelecimentos que aderirem a safras promocionais do Plano Pro terão os seus limites e valores vigentes rigorosamente preservados enquanto mantiverem a renovação tempestiva da assinatura, aplicando-se reajustes de novos planos exclusivamente para novas adesões.
              </p>
            </section>

            {/* 4. ISENÇÃO OPERACIONAL */}
            <section id="art4" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                Isenção de Responsabilidade Operacional sobre o Salão e Pedidos
              </h2>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  O MAYaMenu é uma ferramenta tecnológica de comunicação e transmissão de pedidos. A responsabilidade por alimentos, bebidas, preços e recebimento financeiro é inteira do estabelecimento.
                </span>
              </div>
              <p>
                <strong>4.1. Responsabilidade Integral do Restaurante:</strong> O estabelecimento é o único e exclusivo responsável:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                <li>Pela exatidão dos preços, tributos, taxas de serviço, descrições e fotografias cadastradas no cardápio;</li>
                <li>Pela indicação expressa de ingredientes alergênicos e restrições alimentares de seus produtos;</li>
                <li>Pela procedência, armazenamento higiênico-sanitário, preparo e entrega dos alimentos e bebidas aos clientes finais;</li>
                <li>Pela cobrança, conferência, recebimento e emissão de notas fiscais de consumo dos pedidos do salão.</li>
              </ul>
              <p>
                <strong>4.2. Inexistência de Intermediação Financeira sobre Comandas:</strong> A MAYARANAS SISTEMAS não retém, não custodia, não audita e não cobra porcentagem sobre as vendas de comida e bebida do estabelecimento. Caso o restaurante configure chave Pix direta na mesa ou realize a cobrança no balcão/maquininha, todo o fluxo financeiro ocorre diretamente entre o consumidor final e o restaurante.
              </p>
            </section>

            {/* 5. PROPRIEDADE INTELECTUAL */}
            <section id="art5" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                Propriedade Intelectual e Proteção Autoral
              </h2>
              <p>
                <strong>5.1. Titularidade Exclusiva:</strong> Todos os elementos da plataforma MAYaMenu — incluindo código-fonte, arquitetura de software, interfaces gráficas, logotipos, marcas, layout, bancos de dados e documentação — são de propriedade exclusiva da <strong>MAYARANAS SISTEMAS INOVA SIMPLES (I.S.)</strong>, protegidos pela Lei Federal nº 9.609/1998 (Lei do Software) e pela Lei Federal nº 9.610/1998 (Direitos Autorais).
              </p>
              <p>
                <strong>5.2. Vedação Expressa:</strong> É estritamente vedado ao estabelecimento e a terceiros: fazer engenharia reversa, descompilar, copiar, revender, sublicenciar ou criar obras derivadas com base no código, rotinas ou identidade visual da plataforma MAYaMenu sem autorização prévia por escrito.
              </p>
            </section>

            {/* 6. DISPONIBILIDADE */}
            <section id="art6" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  6
                </span>
                Disponibilidade do Serviço em Nuvem e Limitação de Danos
              </h2>
              <p>
                <strong>6.1. Infraestrutura Resiliente:</strong> O MAYaMenu é hospedado em provedores de nuvem de padrão internacional (Google Cloud / Firebase), empregando protocolos modernos de tolerância a falhas.
              </p>
              <p>
                <strong>6.2. Limitação de Responsabilidade por Fatores Externos:</strong> A CONCEDENTE não será responsabilizada por interrupções causadas por:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                <li>Quedas, instabilidades ou oscilações de conexão de internet provida por operadoras de telecomunicação no salão do estabelecimento;</li>
                <li>Incompatibilidade ou avarias nos aparelhos celulares, tablets ou roteadores Wi-Fi utilizados pelo estabelecimento ou clientes;</li>
                <li>Manutenções programadas indispensáveis de segurança, previamente comunicadas através do painel.</li>
              </ul>
            </section>

            {/* 7. CANCELAMENTO */}
            <section id="art7" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  7
                </span>
                Cancelamento, Rescisão e Descontinuidade
              </h2>
              <p>
                <strong>7.1. Cancelamento Voluntário pelo Estabelecimento:</strong> A LICENCIADA poderá cancelar sua assinatura a qualquer tempo diretamente pelo painel administrativo, sem cobrança de taxas de rescisão. O acesso aos recursos Pro permanecerá disponível até o término do ciclo mensal ou semestral vigente já liquidado.
              </p>
              <p>
                <strong>7.2. Rescisão por Infração:</strong> A MAYARANAS SISTEMAS reserva-se o direito de suspender ou banir imediatamente a conta do estabelecimento que utilizar a plataforma para práticas fraudulentas, veiculação de conteúdos ofensivos, comércio ilegal ou ataques à segurança do sistema.
              </p>
            </section>

            {/* 8. FORO */}
            <section id="art8" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  8
                </span>
                Legislação Aplicável e Foro de Eleição
              </h2>
              <p>
                <strong>8.1. Legislação Vigente:</strong> O presente Contrato é regido e interpretado segundo as Leis da República Federativa do Brasil, em especial o Código Civil Brasileiro, a Lei do Software e o Marco Civil da Internet.
              </p>
              <p>
                <strong>8.2. Foro de Eleição:</strong> Para dirimir quaisquer litígios, conflitos ou controvérsias decorrentes deste contrato, as partes elegem expressamente o <strong>Foro da Comarca de Horizonte, Estado do Ceará, Brasil</strong>, com expressa renúncia a qualquer outro, por mais privilegiado ou especial que seja ou venha a ser.
              </p>
            </section>

            {/* CANAL DE DÚVIDAS */}
            <div className="p-6 rounded-3xl bg-rose-50/40 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-950 text-sm">Ficou com alguma dúvida jurídica?</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nossa equipe de suporte e compliance está à disposição para esclarecimentos.
                </p>
              </div>
              <a
                href="mailto:contato@mayamenu.com.br"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>contato@mayamenu.com.br</span>
              </a>
            </div>
          </article>
        </div>
      </main>

      {/* RODAPÉ SIMPLES */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) - CNPJ 70.099.118/0001-02</p>
          <div className="flex items-center gap-4">
            <Link href="/politica-de-privacidade" className="hover:text-rose-600 underline underline-offset-2">
              Política de Privacidade (LGPD)
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


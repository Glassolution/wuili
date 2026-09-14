import { LegalLayout, LegalList, LegalSection } from "./legal/LegalLayout";

const PrivacyPage = () => (
  <LegalLayout title="Política de Privacidade" updatedAt="julho de 2025">
    <LegalSection title="Introdução">
      <p>
        Esta Política de Privacidade descreve como a Velo coleta, usa, armazena e protege os dados
        pessoais dos Usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº
        13.709/2018).
      </p>
    </LegalSection>

    <LegalSection title="1. Controlador dos Dados">
      <p>Os dados pessoais coletados pela Plataforma são controlados por:</p>
      <p>
        Luis Felipe Ferreira Xavier
        <br />
        CPF: 071.774.332-28
        <br />
        Email: contato@velods.com.br
        <br />
        Localização: Marabá/PA, Brasil
      </p>
    </LegalSection>

    <LegalSection title="2. Dados Coletados">
      <p>A Velo coleta os seguintes dados pessoais:</p>
      <p className="font-medium text-white">Dados fornecidos pelo Usuário:</p>
      <LegalList
        items={[
          "Nome completo",
          "Endereço de email",
          "Dados de pagamento (processados por terceiros — a Velo não armazena número completo do cartão)",
          "Credenciais de integração com marketplaces (ex.: token de acesso ao Mercado Livre)",
        ]}
      />
      <p className="font-medium text-white">Dados coletados automaticamente:</p>
      <LegalList
        items={[
          "Endereço IP",
          "Dados de uso da Plataforma (páginas acessadas, funcionalidades utilizadas)",
          "Logs de acesso (data, hora, ações realizadas)",
        ]}
      />
    </LegalSection>

    <LegalSection title="3. Finalidade do Tratamento">
      <p>Os dados são utilizados para:</p>
      <LegalList
        items={[
          "Criação e gerenciamento da conta do Usuário",
          "Processamento de pagamentos e cobrança de assinaturas",
          "Prestação dos serviços da Plataforma (publicação de produtos, integrações com marketplaces)",
          "Envio de comunicações transacionais (confirmação de cadastro, notificações de cobrança, alertas de produto)",
          "Envio de comunicações de marketing, desde que o Usuário tenha dado consentimento",
          "Cumprimento de obrigações legais",
          "Prevenção de fraudes e segurança da Plataforma",
        ]}
      />
    </LegalSection>

    <LegalSection title="4. Base Legal">
      <p>O tratamento dos dados pessoais é fundamentado nas seguintes bases legais da LGPD:</p>
      <LegalList
        items={[
          "Execução de contrato (art. 7º, V): para prestação dos serviços contratados",
          "Cumprimento de obrigação legal (art. 7º, II): para fins fiscais e regulatórios",
          "Legítimo interesse (art. 7º, IX): para segurança, prevenção a fraudes e melhoria da Plataforma",
          "Consentimento (art. 7º, I): para comunicações de marketing",
        ]}
      />
    </LegalSection>

    <LegalSection title="5. Compartilhamento de Dados">
      <p>A Velo pode compartilhar dados com:</p>
      <LegalList
        items={[
          "Processadora de pagamento ValidaPay: para processar cobranças de assinaturas de forma segura",
          "Fornecedores e catálogo de produtos (ex.: C7Drop): para disponibilizar e sincronizar produtos na plataforma",
          "Provedores de infraestrutura (ex.: Supabase, Vercel): para hospedagem e banco de dados",
          "Provedores de email (ex.: Resend): para envio de comunicações transacionais",
          "Mercado Livre e outros marketplaces: apenas os dados necessários para a integração (ex.: token de acesso fornecido pelo próprio Usuário)",
        ]}
      />
      <p className="font-medium text-white">Não vendemos dados pessoais a terceiros.</p>
    </LegalSection>

    <LegalSection title="6. Armazenamento e Segurança">
      <p>6.1. Os dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS/TLS) e em repouso.</p>
      <p>6.2. O acesso aos dados é restrito a sistemas e pessoas autorizadas.</p>
      <p>
        6.3. Em caso de incidente de segurança que possa afetar os Usuários, a Velo notificará os
        afetados e a Autoridade Nacional de Proteção de Dados (ANPD) nos prazos legais.
      </p>
    </LegalSection>

    <LegalSection title="7. Retenção dos Dados">
      <p>
        Os dados pessoais são mantidos pelo período necessário para a prestação dos serviços e
        cumprimento de obrigações legais. Após o cancelamento da conta, os dados são excluídos em
        até 90 (noventa) dias, salvo quando a retenção for exigida por lei (ex.: dados fiscais,
        que seguem prazo legal de 5 anos).
      </p>
    </LegalSection>

    <LegalSection title="8. Direitos do Titular">
      <p>Nos termos da LGPD, o Usuário tem os seguintes direitos em relação aos seus dados pessoais:</p>
      <LegalList
        items={[
          "Confirmação e acesso: saber quais dados são tratados e acessá-los",
          "Correção: solicitar a correção de dados incompletos ou incorretos",
          "Anonimização ou eliminação: solicitar a anonimização ou exclusão de dados desnecessários",
          "Portabilidade: solicitar a transferência dos dados a outro fornecedor de serviço",
          "Revogação do consentimento: retirar o consentimento dado para tratamentos baseados nessa base legal",
          "Oposição: opor-se a tratamentos realizados com base em legítimo interesse",
        ]}
      />
      <p>
        Para exercer seus direitos, entre em contato pelo email:{" "}
        <a href="mailto:contato@velods.com.br" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white">
          contato@velods.com.br
        </a>
        . Responderemos em até 15 (quinze) dias úteis.
      </p>
    </LegalSection>

    <LegalSection title="9. Cookies">
      <p>
        A Plataforma utiliza cookies essenciais para funcionamento (autenticação de sessão) e
        cookies analíticos para melhoria da experiência. O Usuário pode desativar cookies
        analíticos nas configurações do navegador, sem prejuízo do uso da Plataforma.
      </p>
    </LegalSection>

    <LegalSection title="10. Alterações nesta Política">
      <p>
        Esta Política pode ser atualizada periodicamente. A data de "Última atualização" no topo
        indica a versão vigente. Alterações relevantes serão comunicadas por email.
      </p>
    </LegalSection>

    <LegalSection title="11. Contato e Canal de Privacidade">
      <p>Para dúvidas, solicitações ou reclamações relacionadas à privacidade e proteção de dados:</p>
      <p>
        Email:{" "}
        <a href="mailto:contato@velods.com.br" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white">
          contato@velods.com.br
        </a>
      </p>
      <p>
        Caso não obtenha resposta satisfatória, o Usuário pode contatar a Autoridade Nacional de
        Proteção de Dados (ANPD):{" "}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white">
          www.gov.br/anpd
        </a>
        .
      </p>
    </LegalSection>
  </LegalLayout>
);

export default PrivacyPage;

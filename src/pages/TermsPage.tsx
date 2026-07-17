import { LegalLayout, LegalList, LegalSection } from "./legal/LegalLayout";

const TermsPage = () => (
  <LegalLayout title="Termos de Uso" updatedAt="julho de 2025">
    <LegalSection title="1. Aceitação dos Termos">
      <p>
        Ao acessar ou utilizar a plataforma Velo ("Plataforma"), disponível em velods.com.br,
        você ("Usuário") concorda integralmente com estes Termos de Uso. Caso não concorde, não
        utilize a Plataforma.
      </p>
    </LegalSection>

    <LegalSection title="2. Sobre a Plataforma">
      <p>
        A Velo é uma plataforma SaaS de dropshipping que permite ao Usuário importar produtos de
        fornecedores nacionais e publicá-los automaticamente em marketplaces como o Mercado Livre.
        A Plataforma é operada por Luis Felipe Ferreira Xavier, pessoa física, CPF 071.774.332-28,
        residente em Marabá/Pará.
      </p>
    </LegalSection>

    <LegalSection title="3. Cadastro e Conta">
      <p>3.1. Para utilizar a Plataforma, o Usuário deve criar uma conta fornecendo informações verdadeiras, completas e atualizadas.</p>
      <p>3.2. O Usuário é integralmente responsável pela segurança de suas credenciais de acesso (email e senha) e por todas as ações realizadas em sua conta.</p>
      <p>3.3. É vedado compartilhar, vender ou transferir o acesso à conta para terceiros.</p>
      <p>3.4. A Velo reserva o direito de suspender ou encerrar contas que violem estes Termos.</p>
    </LegalSection>

    <LegalSection title="4. Planos e Pagamento">
      <p>
        4.1. A Velo oferece planos pagos com cobrança mensal recorrente (Base a R$39,90/mês, Pro a R$79,80/mês ou
        Business a R$159,60/mês), renovando-se automaticamente a cada ciclo, salvo cancelamento
        expresso pelo Usuário antes do vencimento.
      </p>
      <p>
        4.2. Os pagamentos são processados por terceiros (processadoras de pagamento) e estão
        sujeitos aos termos dessas plataformas. A Velo não armazena dados completos de cartão de
        crédito.
      </p>
      <p>
        4.3. Não há reembolso após o início do ciclo de cobrança mensal, exceto nos casos
        previstos pelo Código de Defesa do Consumidor (CDC) — direito de arrependimento em até 7
        dias corridos após a primeira contratação, conforme art. 49 do CDC.
      </p>
      <p>4.4. A Velo reserva o direito de alterar os valores dos planos mediante aviso prévio de 30 (trinta) dias ao Usuário.</p>
    </LegalSection>

    <LegalSection title="5. Uso Permitido">
      <p>5.1. O Usuário compromete-se a utilizar a Plataforma apenas para fins lícitos e de acordo com estes Termos.</p>
      <p>5.2. É expressamente vedado:</p>
      <LegalList
        items={[
          "Utilizar a Plataforma para publicar produtos falsificados, ilegais ou que violem direitos de terceiros",
          "Realizar engenharia reversa, descompilar ou tentar acessar o código-fonte da Plataforma",
          "Utilizar robôs, scrapers ou qualquer meio automatizado não autorizado para acessar a Plataforma",
          "Revender o acesso à Plataforma sem autorização prévia por escrito",
          "Praticar qualquer ato que prejudique a infraestrutura ou outros usuários da Plataforma",
        ]}
      />
    </LegalSection>

    <LegalSection title="6. Responsabilidades do Usuário">
      <p>
        6.1. O Usuário é o único responsável pelos anúncios criados e publicados via Plataforma,
        incluindo a veracidade das informações, conformidade com as políticas dos marketplaces
        (ex.: Mercado Livre) e legislação vigente.
      </p>
      <p>6.2. O Usuário é responsável por cumprir suas obrigações fiscais decorrentes das vendas realizadas.</p>
      <p>
        6.3. A Velo não é parte nas transações realizadas entre o Usuário e seus compradores, não
        assumindo qualquer responsabilidade por disputas, devoluções ou reclamações de
        consumidores finais.
      </p>
    </LegalSection>

    <LegalSection title="7. Limitação de Responsabilidade">
      <p>
        7.1. A Velo não garante disponibilidade ininterrupta da Plataforma e não se responsabiliza
        por perdas decorrentes de interrupções, falhas técnicas ou indisponibilidade de APIs de
        terceiros (como Mercado Livre).
      </p>
      <p>
        7.2. Em nenhuma hipótese a responsabilidade total da Velo excederá o valor pago pelo
        Usuário nos últimos 3 (três) meses de assinatura.
      </p>
    </LegalSection>

    <LegalSection title="8. Propriedade Intelectual">
      <p>
        8.1. Todo o conteúdo da Plataforma — incluindo código, design, textos, logotipos e
        funcionalidades — é de propriedade exclusiva da Velo e protegido pela legislação de
        propriedade intelectual.
      </p>
      <p>8.2. O Usuário não adquire nenhum direito de propriedade sobre a Plataforma ao assinar qualquer plano.</p>
    </LegalSection>

    <LegalSection title="9. Cancelamento">
      <p>
        9.1. O Usuário pode cancelar sua assinatura a qualquer momento pelo painel da Plataforma.
        O acesso permanece ativo até o fim do período já pago.
      </p>
      <p>9.2. A Velo pode encerrar a conta do Usuário por violação destes Termos, sem reembolso do período remanescente.</p>
    </LegalSection>

    <LegalSection title="10. Alterações nos Termos">
      <p>
        A Velo pode atualizar estes Termos a qualquer momento. Alterações relevantes serão
        comunicadas por email com antecedência mínima de 15 (quinze) dias. O uso continuado da
        Plataforma após as alterações implica aceitação dos novos Termos.
      </p>
    </LegalSection>

    <LegalSection title="11. Lei Aplicável e Foro">
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de
        Marabá/PA para dirimir quaisquer controvérsias, salvo disposição legal em contrário.
      </p>
    </LegalSection>

    <LegalSection title="12. Contato">
      <p>
        Para dúvidas sobre estes Termos, entre em contato pelo email:{" "}
        <a href="mailto:contato@velods.com.br" className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white">
          contato@velods.com.br
        </a>
        .
      </p>
    </LegalSection>
  </LegalLayout>
);

export default TermsPage;

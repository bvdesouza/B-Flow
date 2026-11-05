import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | B-Flow',
  description: 'Como o B-Flow coleta, usa e protege os seus dados.',
};

const CONTACT_EMAIL = 'gerenciamento.bflow@gmail.com';
const UPDATED_AT = '5 de novembro de 2026';

export default function PrivacyPolicy() {
  return (
    <main className="w-full max-w-3xl mx-auto px-5 py-10 text-on-surface leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade do B-Flow</h1>
      <p className="text-sm text-on-surface-variant mb-8">Última atualização: {UPDATED_AT}</p>

      <section className="space-y-3 mb-8">
        <p>
          O B-Flow é um aplicativo de gestão para personal trainers e professores: cadastro de alunos e turmas,
          agenda de aulas, controle de presença e acompanhamento financeiro. Esta política explica quais dados o
          app coleta, para que eles são usados e quais são os seus direitos, de acordo com a Lei Geral de Proteção
          de Dados (Lei nº 13.709/2018, LGPD).
        </p>
        <p>
          Responsável pelo app: Bruno Souza. Contato:{' '}
          <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <h2 className="text-xl font-bold mb-3">1. Dados que coletamos</h2>
      <section className="space-y-3 mb-8">
        <p><strong>Dados da sua conta (usuário do app):</strong> nome completo, nome de preferência, e-mail, telefone,
          senha (armazenada de forma criptografada pelo nosso provedor de autenticação) e, se você quiser, uma foto de perfil.</p>
        <p><strong>Dados que você cadastra sobre seus alunos e turmas:</strong> nome e foto do aluno, plano contratado,
          valores, horários de aula, presença e faltas, situação de pagamento e comprovantes de pagamento que você anexar.
          Você é o responsável por ter autorização dos seus alunos para registrar esses dados.</p>
        <p><strong>Configurações locais:</strong> preferências como lembretes de aula e exibição de valores ficam salvas
          apenas no seu aparelho.</p>
        <p>O B-Flow <strong>não</strong> coleta localização, contatos da agenda do celular, dados de saúde, nem usa
          ferramentas de publicidade ou de rastreamento.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">2. Para que usamos os dados</h2>
      <section className="space-y-3 mb-8">
        <p>Os dados são usados apenas para fazer o app funcionar: entrar na sua conta, mostrar sua agenda, alunos e
          relatórios financeiros, e permitir que você gerencie suas aulas. Não vendemos, alugamos nem compartilhamos
          seus dados para fins de publicidade.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">3. Onde os dados ficam e com quem são compartilhados</h2>
      <section className="space-y-3 mb-8">
        <p>Os dados são armazenados no Supabase, serviço de banco de dados e autenticação usado pelo B-Flow, com
          transmissão criptografada (HTTPS). Cada conta só tem acesso aos próprios dados. O app também é hospedado
          pela Vercel. Esses provedores tratam os dados apenas para prestar o serviço ao B-Flow.</p>
        <p>Quando você usa o botão de enviar mensagem pelo WhatsApp, o texto é aberto no WhatsApp e passa a seguir
          as regras de privacidade dele.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">4. Por quanto tempo guardamos</h2>
      <section className="space-y-3 mb-8">
        <p>Os dados ficam guardados enquanto sua conta existir. Você pode apagar alunos, turmas e registros a qualquer
          momento dentro do app. Ao excluir a conta, todos os dados ligados a ela são apagados.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">5. Seus direitos e exclusão da conta</h2>
      <section className="space-y-3 mb-8">
        <p>Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento. Para excluir sua conta e
          todos os dados, veja as instruções em{' '}
          <Link className="text-primary underline" href="/excluir-conta">Excluir minha conta</Link>.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">6. Crianças</h2>
      <section className="space-y-3 mb-8">
        <p>O B-Flow é destinado a profissionais maiores de 18 anos e não é direcionado a crianças.</p>
      </section>

      <h2 className="text-xl font-bold mb-3">7. Alterações</h2>
      <section className="space-y-3 mb-8">
        <p>Esta política pode ser atualizada. A data no topo da página indica a versão mais recente.</p>
      </section>
    </main>
  );
}

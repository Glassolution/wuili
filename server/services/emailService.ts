import { Resend } from 'resend';

// ── Inicialização segura do Resend ────────────────────────────────────────────
// A chave da API NUNCA deve ser exposta no frontend ou em logs
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Interface para envio de email ─────────────────────────────────────────────
interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// ── Função principal de envio de email ───────────────────────────────────────
/**
 * Envia um email transacional usando o Resend
 * 
 * SEGURANÇA:
 * - Esta função deve ser chamada APENAS do backend
 * - NUNCA exponha a API key do Resend no frontend
 * - NUNCA logue a API key em erros ou responses
 * 
 * @param to - Email do destinatário
 * @param subject - Assunto do email
 * @param html - Conteúdo HTML do email
 * @returns Promise com o resultado do envio
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams) {
  try {
    // Validação básica
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada');
    }

    if (!to || !subject || !html) {
      throw new Error('Parâmetros obrigatórios ausentes');
    }

    // Envio do email
    const result = await resend.emails.send({
      from: 'Velo <noreply@velods.com.br>',
      to,
      subject,
      html,
    });

    return result;
  } catch (error) {
    // SEGURANÇA: Não exponha a API key em logs de erro
    console.error('Erro ao enviar email:', {
      to,
      subject,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
    throw error;
  }
}

// ── Função auxiliar para validar configuração ────────────────────────────────
/**
 * Verifica se o serviço de email está configurado corretamente
 * @returns true se configurado, false caso contrário
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

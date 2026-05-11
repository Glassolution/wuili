/**
 * Exemplos de templates de email
 * 
 * IMPORTANTE: Estes são apenas exemplos.
 * Os templates reais serão definidos posteriormente.
 */

// ── Template de Boas-vindas ──────────────────────────────────────────────────
export function welcomeEmailTemplate(userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FFA640; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { background: #111111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo à Velo!</h1>
          </div>
          <div class="content">
            <p>Olá ${userName},</p>
            <p>Estamos felizes em ter você conosco!</p>
            <p>
              <a href="https://velods.com.br/dashboard" class="button">
                Acessar Dashboard
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ── Template de Recuperação de Senha ─────────────────────────────────────────
export function passwordResetTemplate(resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #111111; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { background: #FFA640; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; }
          .warning { color: #DC2626; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperação de Senha</h1>
          </div>
          <div class="content">
            <p>Você solicitou a recuperação de senha.</p>
            <p>Clique no botão abaixo para redefinir sua senha:</p>
            <p>
              <a href="${resetLink}" class="button">
                Redefinir Senha
              </a>
            </p>
            <p class="warning">
              ⚠️ Este link expira em 1 hora.<br>
              Se você não solicitou esta recuperação, ignore este email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ── Template de Notificação de Pedido ────────────────────────────────────────
export function orderNotificationTemplate(orderNumber: string, orderTotal: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16A34A; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .order-info { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .button { background: #111111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Pedido Confirmado</h1>
          </div>
          <div class="content">
            <p>Seu pedido foi confirmado com sucesso!</p>
            <div class="order-info">
              <p><strong>Número do Pedido:</strong> ${orderNumber}</p>
              <p><strong>Valor Total:</strong> ${orderTotal}</p>
            </div>
            <p>
              <a href="https://velods.com.br/dashboard/pedidos" class="button">
                Ver Detalhes do Pedido
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * NOTA: Estes são apenas exemplos.
 * Os templates reais serão implementados conforme necessário.
 * 
 * Para usar:
 * 
 * import { sendEmail } from './emailService';
 * import { welcomeEmailTemplate } from './emailTemplates.example';
 * 
 * await sendEmail({
 *   to: 'usuario@example.com',
 *   subject: 'Bem-vindo à Velo',
 *   html: welcomeEmailTemplate('João Silva'),
 * });
 */

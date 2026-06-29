import type { PaymentHandler, PaymentHandlerRequest } from '@contextvm/sdk/payments';
import { BOLD, CYAN, DIM, RESET, TEXT } from '../constants/ui.ts';

/**
 * CLI payment handler for transparent mode.
 *
 * - Lets the SDK advertise the PMI via `pmi` tags (CEP-8 discovery)
 * - Captures `payment_required` and renders the invoice in the terminal
 * - Does NOT attempt to pay (human pays out-of-band)
 */
export class CliPaymentHandler implements PaymentHandler {
  public readonly pmi: string;

  constructor(options: { pmi: string }) {
    this.pmi = options.pmi;
  }

  canHandle(_req: PaymentHandlerRequest): boolean {
    return true;
  }

  async handle(req: PaymentHandlerRequest): Promise<void> {
    console.error();
    console.error(`${BOLD}⚡ Payment Required${RESET}`);
    console.error(`${DIM}${'─'.repeat(50)}${RESET}`);
    console.error(`  ${CYAN}Amount:${RESET}      ${req.amount}`);
    if (req.description) {
      console.error(`  ${CYAN}Description:${RESET} ${req.description}`);
    }
    console.error(`  ${CYAN}PMI:${RESET}         ${req.pmi}`);
    if (req.ttl) {
      console.error(`  ${CYAN}Expires in:${RESET}  ${req.ttl}s`);
    }
    console.error(`${DIM}${'─'.repeat(50)}${RESET}`);
    console.error(`  ${CYAN}Invoice:${RESET}`);
    console.error(`  ${TEXT}${req.pay_req}${RESET}`);
    console.error(`${DIM}${'─'.repeat(50)}${RESET}`);
    console.error();
    console.error(`${DIM}Pay the invoice above. The CLI is waiting for confirmation...${RESET}`);
  }
}

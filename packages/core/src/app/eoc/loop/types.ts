// EOC Types
/* eslint-disable prettier/prettier */

export const LOOP_NAMESPACE = 'loop_checkout_plus';
export const FEE_DISPLAY_NAME = 'Checkout+ Returns Coverage';
export const LOOP_EMPTY_VALUE = 'declined';
export const DEFAULT_GHOST_SKU = 'LOOP';
export interface CartMetafield {
  id: string;
  value: string;
}

export interface CartMetadataResp {
  body: {
    data?: {
      resource_id: string;
    };
  };
}

export interface LoopQuote {
  sessionId: string;
  mode: string[];
  chargeInstructions: {
    amount: number;
    currencyCode: string;
    method: string;
  };
  eligible: boolean;
}

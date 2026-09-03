// EOC Types
/* eslint-disable prettier/prettier */
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

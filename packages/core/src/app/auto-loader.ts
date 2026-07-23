// EOC Override: This file has been modified for custom checkout
import type { BrowserOptions } from '@sentry/browser';

import { loadFiles } from './loader';

export interface ManageShippingMethods {
  isEnabled: boolean;
  showRecommendedMethod?: boolean;
  hideFreeShippingGroups?: number[];
  withdrawalTermsUrl?: string;
  enableLoop: boolean;
  loopHideGroups: number[];
  loopUpchargeGroups: number[];
  loopUpchargeRate?: string;
  loopModalText?: string;
  loopFormTitle?: string;
  loopFieldLabel?: string;
}

enum OrderPermalinkStatus {
  Valid = 'valid',
  Expired = 'expired',
  RateLimited = 'rate_limited',
}

export interface CustomCheckoutWindow extends Window {
  checkoutConfig: {
    containerId: string;
    orderId?: number;
    checkoutId?: string;
    publicPath?: string;
    sentryConfig?: BrowserOptions;
    permalinkStatus?: OrderPermalinkStatus | null;
    manageShippingMethods?: ManageShippingMethods;
  };
}

function isCustomCheckoutWindow(window: Window): window is CustomCheckoutWindow {
  const customCheckoutWindow: CustomCheckoutWindow = window as CustomCheckoutWindow;

  return !!customCheckoutWindow.checkoutConfig;
}

(async function autoLoad() {
  if (!isCustomCheckoutWindow(window)) {
    throw new Error('Checkout config is missing.');
  }

  console.log('Manage Shipping Methods v3.0.0:::', window.checkoutConfig);

  const { renderOrderConfirmation, renderCheckout } = await loadFiles();

  const { orderId, checkoutId, ...appProps } = window.checkoutConfig;

  if (orderId) {
    renderOrderConfirmation({ ...appProps, orderId });
  } else if (checkoutId) {
    renderCheckout({ ...appProps, checkoutId });
  }
})();

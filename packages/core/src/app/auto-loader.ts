import type { BrowserOptions } from '@sentry/browser';

import { loadFiles } from './loader';

enum OrderPermalinkStatus {
  Valid = 'valid',
  Expired = 'expired',
  RateLimited = 'rate_limited',
}

// eoc custom interface
export interface ReturnsUpcharge {
  id: string;
  returnsUpchargeGroup: number[];
  returnsUpchargeRate: string;
}

// eoc custom interface
export interface EOCCheckoutConfig {
  isEnabled: boolean;
  showRecommendedMethod?: boolean;
  hideFreeShippingGroups?: number[];
  withdrawalTermsUrl?: string;
  enableReturns: boolean;
  returnsHideGroups: number[];
  returnsUpchargeRates?: ReturnsUpcharge[];
  returnsModalText?: string;
  returnsFormTitle?: string;
  returnsFieldLabel?: string;
}

export interface CustomCheckoutWindow extends Window {
  checkoutConfig: {
    containerId: string;
    orderId?: number;
    checkoutId?: string;
    publicPath?: string;
    sentryConfig?: BrowserOptions;
    permalinkStatus?: OrderPermalinkStatus | null;
    manageShippingMethods?: EOCCheckoutConfig; // eoc custom field
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

  // eslint-disable-next-line no-console
  console.log('EOC Custom Checkout v4.0.0', window.checkoutConfig); // eoc custom log

  const { renderOrderConfirmation, renderCheckout } = await loadFiles();

  const { orderId, checkoutId, ...appProps } = window.checkoutConfig;

  if (orderId) {
    renderOrderConfirmation({ ...appProps, orderId });
  } else if (checkoutId) {
    renderCheckout({ ...appProps, checkoutId });
  }
})();

// EOC Override: This file has been modified for custom checkout
import type { BrowserOptions } from '@sentry/browser';

import { loadFiles } from './loader';

// EOC custom interface
export interface ManageShippingMethods {
  isEnabled: boolean;
  showRecommendedMethod?: boolean;
  hideFreeShippingGroups?: number[];
  withdrawalTermsUrl?: string;
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
    manageShippingMethods?: ManageShippingMethods; // eoc custom field
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

  console.log('EOC Custom Checkout v3.0.0', window.checkoutConfig); // eoc custom log

  const { renderOrderConfirmation, renderCheckout } = await loadFiles();

  const { orderId, checkoutId, ...appProps } = window.checkoutConfig;

  if (orderId) {
    renderOrderConfirmation({ ...appProps, orderId });
  } else if (checkoutId) {
    renderCheckout({ ...appProps, checkoutId });
  }
})();

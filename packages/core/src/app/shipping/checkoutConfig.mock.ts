import { CustomCheckoutWindow } from '../auto-loader';

export function getCustomCheckoutWindow(): CustomCheckoutWindow {
  return {
    checkoutConfig: {
      containerId: '1234',
    },
  } as CustomCheckoutWindow;
}
